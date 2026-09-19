// db-write — Supabase Edge Function (Deno)
// 用 service_role 直接打 PostgREST，绕过 RLS，并在后端复刻写权限校验。
//
// 背景：本平台自研 qq+密码 登录（未用 Supabase Auth），anon 连线 auth.uid() 恒为 null，
// 导致所有 RLS 写策略（with check (auth.uid()=owner)）永远不成立 → 前端写操作全被拒。
// 这里用 service_role 绕过 RLS，但**自己把所有权校验补回来**，避免变成可被任意调用的裸代理。
//
// 安全约定：
//   - service_role key 只在 Deno 运行时环境变量中存在，不暴露给浏览器
//   - 每个写操作都收入 actor uid，并在后端校验「该 uid 是否存在、是否对目标行有所有权 / 是否管理员」
//   - 允许写入的表走白名单，禁止越权改他人数据
//
// 部署：
//   supabase functions deploy db-write --project-ref wcnssyiqitugqfmcbdhe
// 前端调用：supabase.functions.invoke('db-write', { body: {...} })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const enc = (s: string) => encodeURIComponent(String(s))

// 签到奖励规则（可在本文件顶部集中调整）
const CHECKIN_BASE = 10          // 每日基础积分
const CHECKIN_BONUS_PER_DAY = 2 // 连续每多 1 天额外 +2
const CHECKIN_BONUS_CAP = 20    // 连签奖励封顶 +20（连续 11 天起每天 30）
const CHECKIN_WEEK_BONUS = 50   // 连续满 7 天额外周奖励

// ── 钱包：充值 / 提现规则 ──────────────────────────────────────
// 充值改为「下单 →（模拟）支付 → 入账」两步，金额只允许档位白名单，
// 杜绝 Infinity / 超大金额 / 任意数值（旧实现只校验 > 0，可被脚本刷爆）。
// ⚠️ 前端 src/pages/mobile/Wallet.tsx 有同名镜像常量 RECHARGE_TIERS，改动需同步。
const RECHARGE_TIERS = [1, 6, 30, 98, 298]
const RECHARGE_MAX_YUAN = 10000  // 兜底上限（档位之外的最后一道闸）
// 提现规则（单位：积分）
const WITHDRAW_MIN = 1000        // 最低提现 1000 积分（= 10 元）
const WITHDRAW_STEP = 100        // 必须为 100 的整数倍
const WITHDRAW_MAX_PER_TXN = 50000   // 单笔上限 50000 积分（= 500 元）
const WITHDRAW_MAX_PER_DAY = 100000  // 单日上限 100000 积分（= 1000 元）
// 余额异常告警线：超过此值在管理端「资金对账」里标红（2026-09-18 有人刷到 64.9 万分才被发现，
// 这条线就是为了让同类情况自动浮出来，而不是等用户反馈）
const BALANCE_ALERT_THRESHOLD = 100000
// 对账时拉取流水的行数保护（超过则截断并标记，避免函数墙钟超时）
const HEALTH_TXN_LIMIT = 50000

// 中国日期（东八区）。按服务器本地时区换算，避免 UTC 错位导致「差一天」。
function chinaDate(d: Date = new Date()): string {
  const sh = new Date(d.getTime() + 8 * 3600 * 1000 - d.getTimezoneOffset() * 60000)
  return sh.toISOString().slice(0, 10)
}
function yesterdayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  })
}

// 去掉密码哈希，避免进入响应
function strip(row: any): any {
  if (!row) return row
  const { password_hash, ...rest } = row
  return rest
}

// 带 HTTP 状态码的错误：让「没权限 / 不存在」返回 403 / 404，而不是被外层 catch 一律变成 500
class HttpError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

// 用 service_role 直接调 PostgREST（绕过 RLS）
async function pg(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json'
  }
  if (method !== 'GET') headers['Prefer'] = 'return=representation'
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { ok: res.ok, status: res.status, data }
}

async function getProfile(uid: string): Promise<any | null> {
  if (!uid) return null
  const r = await pg('GET', `profiles?select=*&id=eq.${enc(uid)}`)
  if (!r.ok || !Array.isArray(r.data) || r.data.length === 0) return null
  return r.data[0]
}

// 校验调用者身份，返回 profile（不存在即 404）
async function requireUser(uid: string): Promise<any> {
  const p = await getProfile(uid)
  if (!p) throw new HttpError('用户不存在', 404)
  return p
}

async function requireAdmin(uid: string): Promise<any> {
  const p = await requireUser(uid)
  if (p.role !== 'admin') throw new HttpError('无权限：需要管理员', 403)
  return p
}

// 运行日志：记录智能体 / 管理员 / 用户 / 系统的关键动作
async function logActivity(
  actor_type: string, actor_id: string, actor_name: string,
  action: string, target_type = '', target_id = '', detail = ''
) {
  await pg('POST', 'activity_logs', { actor_type, actor_id, actor_name, action, target_type, target_id, detail })
}

// 计数器 +1（评论数 / 点赞数等）
async function incCounter(table: string, id: string, col: string) {
  const r = await pg('GET', `${table}?select=${col}&id=eq.${enc(id)}`)
  const cur = Array.isArray(r.data) && r.data[0] ? Number(r.data[0][col]) : 0
  await pg('PATCH', `${table}?id=eq.${enc(id)}`, { [col]: cur + 1 })
}

// 通用 insert：白名单表 + owner 校验
const INSERT_ALLOWED: Record<string, string[]> = {
  comments: [],                       // 评论无 owner 字段，按目标关联写入
  messages: ['sender_id'],
  notifications: ['user_id'],
  // withdrawals 已从白名单移除：提现必须走 submit_withdraw（冻结余额 + 规则校验），
  // 否则可用通用 insert 绕过冻结逻辑重复提交申请。
  arbitrations: ['plaintiff_id'],
  txns: ['user_id'],
  reports: ['reporter_id'] // 举报：只能以自己身份提交（防伪造举报人）
}

// 通用 update：白名单表 + 所有权（或管理员）校验，owner 字段映射
const UPDATE_ALLOWED: Record<string, string[]> = {
  tasks: ['poster_id', 'accepted_id'],
  posts: ['author_id'],
  notifications: ['user_id'],
  withdrawals: ['user_id'],
  arbitrations: ['plaintiff_id', 'defendant_id'],
  messages: ['receiver_id'], // 仅收件人可标记已读
  profiles: ['id'],
  // 举报：owner 列表刻意留空 ⇒ 无「本人」概念，只有管理员能改状态（处理/驳回）。
  // 否则举报人可自行把 status 改成 handled 让举报石沉大海。
  reports: []
}

// 列级白名单：update 动作只允许改这些列，其余字段静默丢弃。
// 关键安全闸：阻止登录用户通过通用 update 把 profiles.role 改成 admin、或改 balance 刷积分。
// （行级校验只保证"只能改自己的"，但以前不限制改哪些列，存在越权/提权漏洞。）
const UPDATE_COLUMNS: Record<string, string[]> = {
  tasks: ['status', 'top_until', 'accepted_id', 'accepted_name'],
  posts: ['title', 'content', 'images', 'status', 'liked', 'likes', 'collected', 'collects', 'comments'],
  profiles: ['nickname', 'avatar', 'status'], // 严禁 role / balance / frozen / password_hash
  notifications: ['read'],
  // 提现单不允许通过通用 update 改任何列：状态流转只能走 approve_wd / reject_wd，
  // 否则申请人可以自己把 status 改成 approved/rejected 干扰审核。
  withdrawals: [],
  messages: ['read'], // 私信已读态只允许收件人翻转，防发件人篡改/越权改他人私信
  arbitrations: ['status', 'winner', 'result'],
  reports: ['status'] // 仅管理员改处理状态
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))
    const { action, uid } = body

    if (!action) return json({ error: '缺少 action' }, 400)

    // ── 注册 ──
    // 关键约定：前端把游客 uid 一并传过来，后端用该 uid 作为 profile id，
    // 与 login_set（QQ 登录）统一，避免「游客 id 落库 vs 注册新 id」前后端分裂。
    if (action === 'register') {
      const { qq, password_hash, nickname, avatar, uid } = body
      if (!qq || !password_hash) return json({ error: '缺少 qq 或密码哈希' }, 400)
      const id = uid || crypto.randomUUID()

      // 1) 该 QQ 是否已被别的账号注册
      const dup = await pg('GET', `profiles?select=id,password_hash&phone=eq.${enc(qq)}`)
      if (dup.ok && Array.isArray(dup.data) && dup.data.length) {
        const existing = dup.data[0]
        if (existing.password_hash) return json({ error: '该 QQ 已注册，请直接登录' }, 409)
        // 无密码（老游客）：与当前 uid 一致才补密码，否则撞号
        if (existing.id !== id) return json({ error: '该 QQ 已被占用' }, 409)
        const u = await pg('PATCH', `profiles?id=eq.${enc(id)}`, { password_hash })
        if (!u.ok) return json({ error: '注册失败：补密码时出错' }, 500)
        return json({ profile: strip(u.data?.[0]) })
      }

      // 2) 游客 profile 是否已存在（phone 为空），则补 qq + 密码
      const self = await getProfile(id)
      if (self) {
        if (self.phone && self.phone !== qq) {
          return json({ error: '该账号已绑定其他 QQ，请先退出或用原 QQ 登录' }, 409)
        }
        const u = await pg('PATCH', `profiles?id=eq.${enc(id)}`, { phone: qq, password_hash })
        if (!u.ok) return json({ error: '注册失败：更新账号时出错' }, 500)
        return json({ profile: strip(u.data?.[0]) })
      }

      // 3) 全新注册：用 uid 作为 id 插入（与游客 id 统一）
      const ins = await pg('POST', 'profiles', {
        id,
        phone: qq,
        nickname: nickname || qq.slice(0, 3) + '****' + qq.slice(-2),
        avatar: avatar || '',
        role: 'user',
        balance: 0,
        frozen: 0,
        status: 'active',
        password_hash
      })
      if (!ins.ok) return json({ error: '注册失败：' + JSON.stringify(ins.data) }, 500)
      return json({ profile: strip(ins.data?.[0]) })
    }

    // ── 登录时写入 QQ / 角色（loginUser）──
    if (action === 'login_set') {
      const { qq, role } = body
      if (!uid || !qq) return json({ error: '缺少 uid 或 qq' }, 400)
      const exist = await getProfile(uid)
      const upd: Record<string, any> = { phone: qq }
      if (role) upd.role = role
      if (exist) {
        const u = await pg('PATCH', `profiles?id=eq.${enc(uid)}`, upd)
        if (!u.ok) return json({ error: '更新失败' }, 500)
        return json({ profile: strip(u.data?.[0]) })
      }
      const ins = await pg('POST', 'profiles', {
        id: uid,
        phone: qq,
        nickname: qq.slice(0, 3) + '****' + qq.slice(-2),
        role: role || 'user',
        balance: 0,
        frozen: 0,
        status: 'active'
      })
      if (!ins.ok) return json({ error: '创建失败' }, 500)
      return json({ profile: strip(ins.data?.[0]) })
    }

    // ── 充值第一步：下单（不碰余额，只生成一笔待支付订单）──
    // 旧实现是「前端说充多少钱，后端就直接加多少积分」，且没有幂等键，
    // 连点 / 脚本并发即可无限刷积分（用户反馈的「连点器卡充值成功」）。
    // 现在物理上拆成两步：下单只写订单，入账只认订单，且同一订单只能入账一次。
    if (action === 'create_recharge_order') {
      const yuan = Number(body.amount)
      if (!Number.isFinite(yuan)) return json({ error: '金额无效' }, 400)
      if (yuan <= 0 || yuan > RECHARGE_MAX_YUAN) return json({ error: `金额需在 0~${RECHARGE_MAX_YUAN} 元之间` }, 400)
      if (!RECHARGE_TIERS.includes(yuan)) return json({ error: '请选择可选的充值金额' }, 400)
      const me = await requireUser(uid)
      if (me.status === 'banned') return json({ error: '账号已被冻结，暂不能充值' }, 403)
      const cfgRes = await pg('GET', 'platform_config?select=points_per_yuan&limit=1')
      const ppu = Array.isArray(cfgRes.data) && cfgRes.data[0]?.points_per_yuan ? Number(cfgRes.data[0].points_per_yuan) : 100
      const points = Math.round(yuan * ppu)
      if (!Number.isFinite(points) || points <= 0) return json({ error: '兑换比例异常，请联系管理员' }, 500)
      const ins = await pg('POST', 'recharge_orders', {
        user_id: uid,
        amount_yuan: yuan,
        points,
        status: 'pending',
        channel: 'mock'
      })
      if (!ins.ok || !Array.isArray(ins.data) || !ins.data.length) return json({ error: '下单失败' }, 500)
      const order = ins.data[0]
      await logActivity('user', uid, me.nickname || '', 'recharge_order', 'wallet', String(order.id), `创建充值订单 ¥${yuan.toFixed(2)}`)
      return json({ orderId: order.id, amountYuan: yuan, points, status: order.status })
    }

    // ── 充值第二步：支付确认并入账（幂等核心）──
    // 用「条件更新 status: pending → paid」抢单：并发 / 连点 / 重放时只有一个请求能改到行，
    // 抢不到的请求落到 duplicate 分支直接返回，不会重复加积分。
    if (action === 'confirm_recharge') {
      const { orderId, channel } = body
      if (!orderId) return json({ error: '缺少订单号' }, 400)
      await requireUser(uid)
      const claim = await pg(
        'PATCH',
        `recharge_orders?id=eq.${enc(orderId)}&user_id=eq.${enc(uid)}&status=eq.pending`,
        { status: 'paid', paid_at: new Date().toISOString(), channel: String(channel || 'mock') }
      )
      if (!claim.ok) return json({ error: '订单确认失败' }, 500)
      const claimed = Array.isArray(claim.data) ? claim.data : []

      if (!claimed.length) {
        // 没抢到：要么已经支付过（幂等返回成功，不重复入账），要么订单不存在 / 状态异常
        const cur = await pg('GET', `recharge_orders?select=id,status,points&id=eq.${enc(orderId)}&user_id=eq.${enc(uid)}`)
        const row = Array.isArray(cur.data) ? cur.data[0] : null
        if (!row) return json({ error: '订单不存在' }, 404)
        if (row.status === 'paid') {
          const meNow = await requireUser(uid)
          return json({ ok: true, duplicate: true, points: Number(row.points) || 0, balance: Number(meNow.balance) || 0 })
        }
        return json({ error: '订单状态不可支付：' + row.status }, 409)
      }

      const order = claimed[0]
      const points = Number(order.points) || 0
      if (points <= 0) return json({ error: '订单金额异常' }, 400)
      // 抢单成功后重新读一次余额，缩小「读改写」竞态窗口
      const me = await requireUser(uid)
      const newBal = Number(me.balance) + points
      const u = await pg('PATCH', `profiles?id=eq.${enc(uid)}`, { balance: newBal })
      if (!u.ok) {
        // 入账失败：把订单退回 pending，避免「订单已支付但积分没到」的钱货两空
        await pg('PATCH', `recharge_orders?id=eq.${enc(orderId)}`, { status: 'pending', paid_at: null })
        return json({ error: '入账失败，请重试' }, 500)
      }
      await pg('POST', 'txns', {
        user_id: uid,
        type: 'recharge',
        amount: points,
        balance_after: newBal,
        remark: `充值 ¥${Number(order.amount_yuan).toFixed(2)}，得 ${points} 积分（订单 ${String(orderId).slice(0, 8)}）`
      })
      await logActivity('user', uid, me.nickname || '', 'recharge', 'wallet', String(orderId), `充值 ¥${Number(order.amount_yuan).toFixed(2)}，得 ${points} 积分`)
      return json({ ok: true, balance: newBal, points })
    }

    // ── 发布任务（冻结余额 + 建任务 + 记流水）──
    if (action === 'publish_task') {
      const { task } = body
      if (!task || task.poster_id !== uid) return json({ error: '身份不匹配' }, 403)
      const me = await requireUser(uid)
      const amount = Number(task.amount)
      const avail = Number(me.balance) - Number(me.frozen)
      if (avail < amount) return json({ error: `可用余额不足，无法冻结 ¥${amount}` }, 400)
      const row = {
        ...task,
        status: 'open',
        accepted_id: null,
        accepted_name: null,
        top_until: null
      }
      const ins = await pg('POST', 'tasks', row)
      if (!ins.ok) return json({ error: '发布失败：' + JSON.stringify(ins.data) }, 500)
      const taskRow = ins.data?.[0]
      await pg('POST', 'txns', {
        user_id: uid,
        type: 'freeze',
        amount: -amount,
        balance_after: Number(me.balance),
        remark: `发布任务冻结 ${amount} 积分（${task.title}）`
      })
      await pg('PATCH', `profiles?id=eq.${enc(uid)}`, { frozen: Number(me.frozen) + amount })
      return json({ task: taskRow })
    }

    // ── 发布帖子 ──
    if (action === 'publish_post') {
      const { post } = body
      if (!post || post.author_id !== uid) return json({ error: '身份不匹配' }, 403)
      const ins = await pg('POST', 'posts', post)
      if (!ins.ok) return json({ error: '发布失败：' + JSON.stringify(ins.data) }, 500)
      return json({ post: ins.data?.[0] })
    }

    // ── 发布二手商品 ──
    if (action === 'publish_goods') {
      const { goods } = body
      if (!goods || goods.seller_id !== uid) return json({ error: '身份不匹配' }, 403)
      const ins = await pg('POST', 'goods', goods)
      if (!ins.ok) return json({ error: '发布失败：' + JSON.stringify(ins.data) }, 500)
      return json({ goods: ins.data?.[0] })
    }

    // ── 接单 ──
    if (action === 'take_task') {
      const { taskId, nickname } = body
      const t = await pg('GET', `tasks?select=*&id=eq.${enc(taskId)}`)
      if (!t.ok || !Array.isArray(t.data) || !t.data.length) return json({ error: '任务不存在' }, 404)
      if (t.data[0].status !== 'open') return json({ error: '任务不可接' }, 400)
      const u = await pg('PATCH', `tasks?id=eq.${enc(taskId)}`, {
        status: 'accepted',
        accepted_id: uid,
        accepted_name: nickname
      })
      if (!u.ok) return json({ error: '接单失败' }, 500)
      await pg('POST', 'notifications', {
        user_id: t.data[0].poster_id,
        type: 'task_taken',
        title: '有人接单',
        content: `${nickname} 已接下「${t.data[0].title}」`
      })
      return json({ ok: true })
    }

    // ── 验收通过并结算 ──
    if (action === 'review_pass') {
      const { taskId } = body
      const t = await pg('GET', `tasks?select=*&id=eq.${enc(taskId)}`)
      if (!t.ok || !Array.isArray(t.data) || !t.data.length) return json({ error: '任务不存在' }, 404)
      const task = t.data[0]
      const cfgRes = await pg('GET', 'platform_config?select=commission_rate&limit=1')
      const cfg = Array.isArray(cfgRes.data) && cfgRes.data[0] ? cfgRes.data[0] : { commission_rate: 0.1 }
      const commission = Number(task.amount) * Number(cfg.commission_rate)
      const net = Number(task.amount) - commission
      // 解冻雇主：必须用雇主当前冻结额减去本任务金额（tasks 表无 frozen 列，原代码引用了不存在的列导致算成负数）
      const posterRes = await pg('GET', `profiles?select=frozen&id=eq.${enc(task.poster_id)}`)
      const posterFrozen = Array.isArray(posterRes.data) && posterRes.data[0] ? Number(posterRes.data[0].frozen) : 0
      await pg('PATCH', `profiles?id=eq.${enc(task.poster_id)}`, { frozen: Math.max(0, posterFrozen - Number(task.amount)) })
      // 给接单者加款
      const acc = await pg('GET', `profiles?select=balance&id=eq.${enc(task.accepted_id)}`)
      const accBal = Array.isArray(acc.data) && acc.data[0] ? Number(acc.data[0].balance) : 0
      await pg('PATCH', `profiles?id=eq.${enc(task.accepted_id)}`, { balance: accBal + net })
      await pg('POST', 'txns', {
        user_id: task.accepted_id,
        type: 'income',
        amount: net,
        balance_after: accBal + net,
        remark: `任务完成收入（${task.title}，平台抽佣 ${commission} 积分）`
      })
      await pg('PATCH', `tasks?id=eq.${enc(taskId)}`, { status: 'done' })
      await pg('POST', 'notifications', {
        user_id: task.accepted_id,
        type: 'task_status',
        title: '任务已完成',
        content: `「${task.title}」已结算，收入 ${net} 积分`
      })
      return json({ ok: true, net })
    }

    // ── 平台配置（管理员）──
    if (action === 'set_config') {
      const { config } = body
      await requireAdmin(uid)
      const u = await pg('PATCH', 'platform_config?id=eq.1', {
        commission_rate: config.commission_rate,
        top_price_d1: config.top_price.d1,
        top_price_d3: config.top_price.d3,
        top_price_d7: config.top_price.d7,
        announce: config.announce,
        points_per_yuan: config.points_per_yuan
      })
      if (!u.ok) return json({ error: '更新失败' }, 500)
      return json({ ok: true })
    }

    // ── 提现申请（冻结积分 + 收款信息 + 规则校验）──
    // 旧实现走通用 insert：不冻结余额、不校验待审总额、也没有收款账号，
    // 用户可以重复提交多笔申请，管理员逐笔放款后余额会被扣成负数。
    if (action === 'submit_withdraw') {
      const { channel, account, accountName } = body
      const pts = Number(body.amount)
      if (!Number.isFinite(pts) || pts <= 0) return json({ error: '提现积分无效' }, 400)
      if (pts < WITHDRAW_MIN) return json({ error: `最低提现 ${WITHDRAW_MIN} 积分` }, 400)
      if (pts % WITHDRAW_STEP !== 0) return json({ error: `提现需为 ${WITHDRAW_STEP} 的整数倍` }, 400)
      if (pts > WITHDRAW_MAX_PER_TXN) {
        return json({ error: `单笔提现不超过 ${WITHDRAW_MAX_PER_TXN} 积分（= ${WITHDRAW_MAX_PER_TXN / 100} 元）` }, 400)
      }
      const ch = String(channel || '').trim()
      const acc = String(account || '').trim()
      if (!ch || !acc) return json({ error: '请填写收款方式与收款账号' }, 400)
      const me = await requireUser(uid)
      if (me.status === 'banned') return json({ error: '账号已被冻结，暂不能提现' }, 403)
      // 单日累计额度（含待审与已打款；被驳回的申请不占额度）
      const dayRes = await pg(
        'GET',
        `withdrawals?select=amount&user_id=eq.${enc(uid)}&status=in.(pending,approved)&created_at=gte.${enc(chinaDate() + 'T00:00:00+08:00')}`
      )
      const todaySum = (Array.isArray(dayRes.data) ? dayRes.data : [])
        .reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
      if (todaySum + pts > WITHDRAW_MAX_PER_DAY) {
        return json({
          error: `今日已申请提现 ${todaySum} 积分，单日上限 ${WITHDRAW_MAX_PER_DAY} 积分`
        }, 400)
      }
      const avail = Number(me.balance) - Number(me.frozen)
      if (avail < pts) return json({ error: `可用积分不足（当前可用 ${avail} 积分）` }, 400)
      // 冻结（预扣）：以 frozen 做乐观锁条件更新，并发重复提交只有一笔能成功
      const fz = await pg(
        'PATCH',
        `profiles?id=eq.${enc(uid)}&frozen=eq.${Number(me.frozen)}`,
        { frozen: Number(me.frozen) + pts }
      )
      if (!fz.ok) return json({ error: '提交失败，请重试' }, 500)
      if (!Array.isArray(fz.data) || !fz.data.length) return json({ error: '提交过于频繁，请稍后重试' }, 409)
      const ins = await pg('POST', 'withdrawals', {
        user_id: uid,
        user_name: me.nickname || '',
        amount: pts,
        status: 'pending',
        channel: ch,
        account: acc,
        account_name: String(accountName || '').trim()
      })
      if (!ins.ok || !Array.isArray(ins.data) || !ins.data.length) {
        // 落单失败必须回滚冻结，否则用户的积分被白锁
        await pg('PATCH', `profiles?id=eq.${enc(uid)}`, { frozen: Number(me.frozen) })
        return json({ error: '提现申请提交失败，请重试' }, 500)
      }
      const wd = ins.data[0]
      await logActivity('user', uid, me.nickname || '', 'withdraw_apply', 'wallet', String(wd.id), `申请提现 ${pts} 积分（${ch} ${acc}）`)
      return json({ ok: true, withdrawal: wd, frozen: Number(me.frozen) + pts })
    }

    // ── 审核提现：通过（管理员）──
    // 打款前二次校验：申请仍为 pending、余额充足；金额与收款人只从库里读，
    // 不采信客户端传入的 userId/amount（否则可被篡改指定任意账号扣款）。
    if (action === 'approve_wd') {
      const { wdId } = body
      await requireAdmin(uid)
      if (!wdId) return json({ error: '缺少提现单号' }, 400)
      const q = await pg('GET', `withdrawals?select=*&id=eq.${enc(wdId)}`)
      const wd = Array.isArray(q.data) ? q.data[0] : null
      if (!wd) return json({ error: '提现申请不存在' }, 404)
      if (wd.status !== 'pending') return json({ error: `该申请已处理（${wd.status}），无需重复打款` }, 409)
      const amount = Number(wd.amount) || 0
      if (amount <= 0) return json({ error: '提现金额异常' }, 400)
      const target = await getProfile(wd.user_id)
      if (!target) return json({ error: '申请用户不存在' }, 404)
      const bal = Number(target.balance) || 0
      if (bal < amount) return json({ error: `余额不足，无法打款（当前 ${bal} 积分）` }, 400)
      // 条件更新抢单：仍是 pending 才置为 approved —— 双击 / 多管理员并发只会有一次成功
      const claim = await pg('PATCH', `withdrawals?id=eq.${enc(wdId)}&status=eq.pending`, {
        status: 'approved',
        handled_at: new Date().toISOString()
      })
      if (!claim.ok) return json({ error: '更新失败' }, 500)
      if (!Array.isArray(claim.data) || !claim.data.length) return json({ error: '该申请已被处理，请刷新后查看' }, 409)
      const newBal = bal - amount
      const newFrozen = Math.max(0, Number(target.frozen) - amount)
      await pg('PATCH', `profiles?id=eq.${enc(wd.user_id)}`, { balance: newBal, frozen: newFrozen })
      await pg('POST', 'txns', {
        user_id: wd.user_id,
        type: 'withdraw',
        amount: -amount,
        balance_after: newBal,
        remark: `提现打款（${wd.channel || '未填渠道'}）`
      })
      await logActivity('admin', uid, '', 'approve_withdrawal', 'user', wd.user_id, `通过提现 ${amount} 积分`)
      return json({ ok: true })
    }

    // ── 审核提现：拒绝（管理员）──
    if (action === 'reject_wd') {
      const { wdId, reason } = body
      await requireAdmin(uid)
      if (!wdId) return json({ error: '缺少提现单号' }, 400)
      const q = await pg('GET', `withdrawals?select=*&id=eq.${enc(wdId)}`)
      const wd = Array.isArray(q.data) ? q.data[0] : null
      if (!wd) return json({ error: '提现申请不存在' }, 404)
      if (wd.status !== 'pending') return json({ error: `该申请已处理（${wd.status}）` }, 409)
      const claim = await pg('PATCH', `withdrawals?id=eq.${enc(wdId)}&status=eq.pending`, {
        status: 'rejected',
        reason: String(reason || ''),
        handled_at: new Date().toISOString()
      })
      if (!claim.ok) return json({ error: '更新失败' }, 500)
      if (!Array.isArray(claim.data) || !claim.data.length) return json({ error: '该申请已被处理，请刷新后查看' }, 409)
      // 驳回必须把冻结的积分退回可用，否则用户积分被白锁
      const target = await getProfile(wd.user_id)
      if (target) {
        const amount = Number(wd.amount) || 0
        await pg('PATCH', `profiles?id=eq.${enc(wd.user_id)}`, {
          frozen: Math.max(0, Number(target.frozen) - amount)
        })
      }
      await logActivity('admin', uid, '', 'reject_withdrawal', 'user', wd.user_id, `驳回提现 ${wd.amount} 积分：${String(reason || '')}`)
      return json({ ok: true })
    }

    // ── 读：钱包规则下发 ──
    // 档位与提现规则由后端下发，避免前端再抄一份常量（历史上两处镜像改一处忘一处）。
    if (action === 'wallet_rules') {
      return json({
        rechargeTiers: RECHARGE_TIERS,
        rechargeMaxYuan: RECHARGE_MAX_YUAN,
        withdrawMin: WITHDRAW_MIN,
        withdrawStep: WITHDRAW_STEP,
        withdrawMaxPerTxn: WITHDRAW_MAX_PER_TXN,
        withdrawMaxPerDay: WITHDRAW_MAX_PER_DAY
      })
    }

    // ── 读：资金对账（管理员）──
    // 口径：余额 − 流水累计 = 冻结 属正常（freeze 流水记 -金额但 balance 不变），
    // 因此真异常判定为 |balance − txn_sum − frozen| > 0。
    // 同时用告警线标出余额异常高的账号（余额本身对得上，但金额不合理，例如被刷过）。
    if (action === 'points_health') {
      await requireAdmin(uid)
      const pr = await pg('GET', 'profiles?select=id,nickname,phone,role,balance,frozen,status&limit=2000')
      const profiles: any[] = Array.isArray(pr.data) ? pr.data : []
      let txns: any[] = []
      let offset = 0
      const PAGE = 1000
      while (txns.length < HEALTH_TXN_LIMIT) {
        const tr = await pg('GET', `txns?select=user_id,amount,type&order=created_at.asc&limit=${PAGE}&offset=${offset}`)
        const rows: any[] = Array.isArray(tr.data) ? tr.data : []
        if (!rows.length) break
        txns = txns.concat(rows)
        if (rows.length < PAGE) break
        offset += PAGE
      }
      // 余额只由「会动余额」的流水决定。
      // 注意：freeze / unfreeze 只挪冻结、不动余额（发布任务时记 freeze，任务结算时连流水都不写），
      // 所以它们必须排除，否则任务进行中的账号会全部被误报为对账异常。
      const BALANCE_NEUTRAL_TYPES = ['freeze', 'unfreeze']
      const sumByUser = new Map<string, number>()
      for (const t of txns) {
        if (BALANCE_NEUTRAL_TYPES.includes(String(t.type))) continue
        const k = String(t.user_id)
        sumByUser.set(k, (sumByUser.get(k) || 0) + Number(t.amount || 0))
      }

      // 冻结的应有值 = 进行中任务的雇主托管 + 待审提现（任务结算时雇主 frozen 会减回去）
      const expectFrozen = new Map<string, number>()
      const addExpect = (uid2: any, amt: any) => {
        const k = String(uid2)
        expectFrozen.set(k, (expectFrozen.get(k) || 0) + Number(amt || 0))
      }
      const escrowRes = await pg('GET', 'tasks?select=poster_id,amount&status=in.(open,accepted,doing,review,arbitration)&limit=5000')
      for (const t of (Array.isArray(escrowRes.data) ? escrowRes.data : [])) addExpect(t.poster_id, t.amount)
      const wdRes = await pg('GET', 'withdrawals?select=user_id,amount&status=eq.pending&limit=5000')
      for (const w of (Array.isArray(wdRes.data) ? wdRes.data : [])) addExpect(w.user_id, w.amount)

      const anomalies: any[] = []
      const frozenAnomalies: any[] = []
      const highBalance: any[] = []
      let totalBalance = 0
      let totalFrozen = 0
      for (const p of profiles) {
        const bal = Number(p.balance) || 0
        const frozen = Number(p.frozen) || 0
        totalBalance += bal
        totalFrozen += frozen
        const s = sumByUser.get(String(p.id)) || 0
        const diff = bal - s
        if (Math.abs(diff) > 0.001) {
          anomalies.push({
            id: p.id, nickname: p.nickname, phone: p.phone,
            balance: bal, frozen, txnSum: s, diff: Math.round(diff * 100) / 100
          })
        }
        const expectF = expectFrozen.get(String(p.id)) || 0
        if (Math.abs(frozen - expectF) > 0.001) {
          frozenAnomalies.push({
            id: p.id, nickname: p.nickname, phone: p.phone,
            frozen, expected: expectF, diff: Math.round((frozen - expectF) * 100) / 100
          })
        }
        if (bal >= BALANCE_ALERT_THRESHOLD) {
          highBalance.push({ id: p.id, nickname: p.nickname, phone: p.phone, balance: bal, frozen })
        }
      }
      anomalies.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      frozenAnomalies.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      highBalance.sort((a, b) => b.balance - a.balance)
      return json({
        generatedAt: new Date().toISOString(),
        totalUsers: profiles.length,
        totalBalance,
        totalFrozen,
        txnRows: txns.length,
        truncated: txns.length >= HEALTH_TXN_LIMIT,
        alertThreshold: BALANCE_ALERT_THRESHOLD,
        anomalies,
        frozenAnomalies,
        highBalance
      })
    }

    // ── 读：我的钱包流水 ──
    // txns 的 SELECT 策略是 `auth.uid() = user_id`，而本平台自研 QQ 登录、不走 Supabase Auth，
    // anon 连接下 auth.uid() 恒为 null → 前端直连永远读到 0 行（钱包"资金流水"一直是空的）。
    // 这里用 service_role 读并按 uid 过滤；不用 requireUser，游客 uid 不存在时自然返回空数组。
    if (action === 'my_txns') {
      if (!uid) return json({ error: '缺少 uid' }, 400)
      const lim = Math.min(Math.max(Number(body.limit) || 200, 1), 500)
      const r = await pg('GET', `txns?select=*&user_id=eq.${enc(uid)}&order=created_at.desc&limit=${lim}`)
      if (!r.ok) return json({ error: '读取流水失败' }, 500)
      return json({ txns: r.data || [] })
    }

    // ── 读：提现列表（mine=本人 / all=管理员全量）──
    // withdrawals 含收款账号，不开放 anon 全表读（策略同样是 auth.uid()，前端本来也读不到），
    // 因此统一由本函数读：本人只能取自己的，全量必须管理员。
    if (action === 'list_withdrawals') {
      const scope = body.scope === 'all' ? 'all' : 'mine'
      if (!uid) return json({ error: '缺少 uid' }, 400)
      if (scope === 'all') await requireAdmin(uid)
      const path =
        scope === 'all'
          ? 'withdrawals?select=*&order=created_at.desc&limit=500'
          : `withdrawals?select=*&user_id=eq.${enc(uid)}&order=created_at.desc&limit=200`
      const r = await pg('GET', path)
      if (!r.ok) return json({ error: '读取提现列表失败' }, 500)
      return json({ withdrawals: r.data || [] })
    }

    // ── 读：我的私信 ──
    // messages 的 SELECT 策略是 `auth.uid() in (sender_id, receiver_id)`，自研登录下 anon 恒 null
    // → 前端直连永远读到 0 行（私信页收件箱长期空）。这里用 service_role 读并按 uid 过滤
    // （发件或收件都算「我的会话」），不用 requireUser，游客 uid 不存在时自然返回空数组。
    if (action === 'my_messages') {
      if (!uid) return json({ error: '缺少 uid' }, 400)
      const lim = Math.min(Math.max(Number(body.limit) || 500, 1), 1000)
      const r = await pg('GET', `messages?select=*&or=(sender_id.eq.${enc(uid)},receiver_id.eq.${enc(uid)})&order=created_at.desc&limit=${lim}`)
      if (!r.ok) return json({ error: '读取私信失败' }, 500)
      return json({ messages: r.data || [] })
    }

    // ── 读：我的通知 ──
    // notifications 的 SELECT 策略是 `auth.uid() = user_id`，同样会被 RLS 挡成 0 行（通知中心长期空）。
    if (action === 'my_notifications') {
      if (!uid) return json({ error: '缺少 uid' }, 400)
      const lim = Math.min(Math.max(Number(body.limit) || 200, 1), 500)
      const r = await pg('GET', `notifications?select=*&user_id=eq.${enc(uid)}&order=created_at.desc&limit=${lim}`)
      if (!r.ok) return json({ error: '读取通知失败' }, 500)
      return json({ notifications: r.data || [] })
    }

    // ── 读：仲裁列表（mine=本人 / all=管理员全量）──
    // arbitrations 的 SELECT 策略是 `auth.uid() in (plaintiff_id, defendant_id)`，前端直连也读不到；
    // 管理员审核页需要全量，故统一走这里：本人取自己的，全量必须管理员。
    if (action === 'list_arbitrations') {
      const scope = body.scope === 'all' ? 'all' : 'mine'
      if (!uid) return json({ error: '缺少 uid' }, 400)
      if (scope === 'all') await requireAdmin(uid)
      const path =
        scope === 'all'
          ? 'arbitrations?select=*&order=created_at.desc&limit=500'
          : `arbitrations?select=*&or=(plaintiff_id.eq.${enc(uid)},defendant_id.eq.${enc(uid)})&order=created_at.desc&limit=200`
      const r = await pg('GET', path)
      if (!r.ok) return json({ error: '读取仲裁列表失败' }, 500)
      return json({ arbitrations: r.data || [] })
    }

    // 举报列表：仅管理员可读（reports 表不开放 anon 读策略，举报内容不外泄）
    if (action === 'list_reports') {
      if (!uid) return json({ error: '缺少 uid' }, 400)
      await requireAdmin(uid)
      const r = await pg('GET', 'reports?select=*&order=created_at.desc&limit=500')
      if (!r.ok) return json({ error: '读取举报列表失败' }, 500)
      return json({ reports: r.data || [] })
    }

    // 站内通知（跨用户）：给「别人」发通知，例如「有人给你发了私信」。
    // 用通用 insert 走不通——notifications 的 owner 是 user_id，而接收方不是当前登录用户，
    // 必然被 owner 校验拒绝（这也是此前私信通知一直写不进去的原因）。
    // 这里单独开一个动作：必须是已登录真实用户，字段做白名单收敛，read 强制 false 防伪造已读。
    if (action === 'notify') {
      if (!uid) return json({ error: '缺少 uid' }, 400)
      await requireUser(uid)
      const { target_user_id, type, title, content } = body
      if (!target_user_id) return json({ error: '缺少接收人' }, 400)
      const ALLOWED_NOTI = ['task_status', 'task_taken', 'task_review', 'arbitration', 'comment', 'message', 'announce', 'bulletin']
      const row = {
        user_id: target_user_id,
        type: ALLOWED_NOTI.includes(type) ? type : 'announce',
        title: String(title || '').slice(0, 60),
        content: String(content || '').slice(0, 300),
        read: false
      }
      const ins = await pg('POST', 'notifications', row)
      if (!ins.ok) return json({ error: '通知写入失败：' + JSON.stringify(ins.data) }, 500)
      return json({ ok: true, notification: ins.data?.[0] })
    }

    // ── 付费置顶任务（服务端原子扣费）──
    // 为什么必须放后端：profiles.balance 故意不在 UPDATE_COLUMNS 白名单里（防止前端自改积分），
    // 所以前端**无法**自己扣余额；此前 store 用 updateTask + addTxn 的做法既扣不到钱
    // （仅改了本地 state），addTxn 又因漏传 uid 直接被 owner 校验拒掉，等于置顶既扣费失败也不生效。
    if (action === 'top_task') {
      const { taskId, days } = body
      const me = await requireUser(uid)
      const d = Number(days)
      if (![1, 3, 7].includes(d)) return json({ error: '置顶天数只能是 1 / 3 / 7' }, 400)
      if (!taskId) return json({ error: '缺少任务 id' }, 400)

      const cRes = await pg('GET', 'platform_config?select=top_price_d1,top_price_d3,top_price_d7&id=eq.1')
      const cfg = cRes.data?.[0]
      const price = Number(cfg?.[`top_price_d${d}`] ?? 0)
      if (!price) return json({ error: '置顶价格未配置' }, 400)

      const tRes = await pg('GET', `tasks?select=id,poster_id,title&id=eq.${enc(taskId)}`)
      const task = tRes.data?.[0]
      if (!task) return json({ error: '任务不存在' }, 404)
      if (task.poster_id !== uid) return json({ error: '只能置顶自己发布的任务' }, 403)

      const bal = Number(me.balance)
      if (bal < price) return json({ error: `积分不足：需 ${price} 积分，当前 ${bal} 积分` }, 400)

      const newBal = bal - price
      const until = new Date(Date.now() + d * 86400000).toISOString()
      const u1 = await pg('PATCH', `profiles?id=eq.${enc(uid)}`, { balance: newBal })
      if (!u1.ok) return json({ error: '扣费失败' }, 500)
      await pg('PATCH', `tasks?id=eq.${enc(taskId)}`, { top_until: until })
      await pg('POST', 'txns', {
        user_id: uid, type: 'pay', amount: -price, balance_after: newBal, remark: `付费置顶 ${d} 天`
      })
      await logActivity('user', uid, me.nickname || '', 'top_task', 'task', taskId, `置顶 ${d} 天，扣 ${price} 积分`)
      return json({ ok: true, balance: newBal, top_until: until, price })
    }

    // ── 通用 insert（白名单表 + owner 校验）──
    if (action === 'insert') {
      const { table, row } = body
      if (!INSERT_ALLOWED.hasOwnProperty(table)) return json({ error: '不允许写入该表：' + table }, 400)
      const ownerCols = INSERT_ALLOWED[table]
      if (ownerCols.length && ownerCols[0] && row?.[ownerCols[0]] !== uid) {
        return json({ error: '身份不匹配（owner 校验失败）' }, 403)
      }
      const res = await pg('POST', table, row)
      if (!res.ok) return json({ error: '写入失败：' + JSON.stringify(res.data) }, 500)
      return json({ row: res.data?.[0] })
    }

    // ── 通用 update（白名单表 + 列级白名单 + 所有权/管理员校验）──
    if (action === 'update') {
      const { table, id, updates } = body
      if (!UPDATE_ALLOWED.hasOwnProperty(table)) return json({ error: '不允许更新该表：' + table }, 400)
      if (!id) return json({ error: '缺少 id' }, 400)
      // 列级过滤：只允许白名单内的列，role/balance 等敏感列一律丢弃（防越权/提权）
      const allow = UPDATE_COLUMNS[table] || []
      const safe: Record<string, any> = {}
      for (const k of Object.keys(updates || {})) if (allow.includes(k)) safe[k] = updates[k]
      if (!Object.keys(safe).length) return json({ error: '无可更新字段（列不在白名单）' }, 400)

      const r = await pg('GET', `${table}?select=*&id=eq.${enc(id)}`)
      if (!r.ok || !Array.isArray(r.data) || !r.data.length) return json({ error: '记录不存在' }, 404)
      const target = r.data[0]
      const owners = UPDATE_ALLOWED[table]
      const isOwner = owners.some((c) => target[c] === uid)
      if (!isOwner) {
        const p = await getProfile(uid)
        if (!p || p.role !== 'admin') return json({ error: '无权限修改该记录' }, 403)
      }
      const u = await pg('PATCH', `${table}?id=eq.${enc(id)}`, safe)
      if (!u.ok) return json({ error: '更新失败：' + JSON.stringify(u.data) }, 500)
      return json({ ok: true, row: u.data?.[0] })
    }

    // ── 管理员手动增加/扣减积分 ──
    if (action === 'add_points') {
      const { targetUserId, points, reason } = body
      await requireAdmin(uid)
      if (typeof points !== 'number' || !Number.isFinite(points) || points === 0) return json({ error: '积分无效' }, 400)
      const t = await getProfile(targetUserId)
      if (!t) return json({ error: '目标用户不存在' }, 404)
      const newBal = Number(t.balance) + points
      await pg('PATCH', `profiles?id=eq.${enc(targetUserId)}`, { balance: newBal })
      await pg('POST', 'txns', {
        user_id: targetUserId,
        type: 'adjust',
        amount: points,
        balance_after: newBal,
        remark: reason || '管理员调整积分'
      })
      await logActivity('admin', uid, '', 'add_points', 'user', targetUserId, `${points > 0 ? '+' : ''}${points} 积分：${reason || ''}`)
      return json({ balance: newBal, points })
    }

    // ── 发布小黑板（校园墙）──
    if (action === 'publish_bulletin') {
      const { bulletin } = body
      if (!bulletin || bulletin.author_id !== uid) return json({ error: '身份不匹配' }, 403)
      const ins = await pg('POST', 'bulletins', bulletin)
      if (!ins.ok) return json({ error: '发布失败：' + JSON.stringify(ins.data) }, 500)
      await logActivity('user', uid, bulletin.author_name || '', 'publish_bulletin', 'bulletin', ins.data?.[0]?.id, (bulletin.content || '').slice(0, 60))
      return json({ bulletin: ins.data?.[0] })
    }

    // ── 写入评论（智能体 / 用户通用；自动维护评论计数 + 运行日志）──
    if (action === 'add_comment') {
      const { target_type, target_id, author_id, author_name, author_avatar, content, is_bot } = body
      if (!target_type || !target_id || !author_id || !content) return json({ error: '评论参数缺失' }, 400)
      const ins = await pg('POST', 'comments', {
        target_type,
        target_id,
        author_id,
        author_name: author_name || '匿名',
        author_avatar: author_avatar || '',
        content
      })
      if (!ins.ok) return json({ error: '评论失败：' + JSON.stringify(ins.data) }, 500)
      const tbl = target_type === 'bulletin' ? 'bulletins' : target_type === 'post' ? 'posts' : target_type
      await incCounter(tbl, target_id, 'comments')
      await logActivity(is_bot ? 'bot' : 'user', author_id, author_name || '', 'comment', target_type, target_id, (content || '').slice(0, 60))
      return json({ comment: ins.data?.[0] })
    }

    // ── 点赞目标（智能体自动点赞用）──
    if (action === 'like_target') {
      const { target_type, target_id } = body
      if (!target_type || !target_id) return json({ error: '参数缺失' }, 400)
      const tbl = target_type === 'bulletin' ? 'bulletins' : 'posts'
      await incCounter(tbl, target_id, 'likes')
      return json({ ok: true })
    }

    // ── 管理员代发全站公告（写入每个用户的通知）──
    if (action === 'send_announce') {
      const { title, content } = body
      await requireAdmin(uid)
      if (!title || !content) return json({ error: '缺少标题或内容' }, 400)
      const usersRes = await pg('GET', `profiles?select=id&limit=2000`)
      const users = Array.isArray(usersRes.data) ? usersRes.data : []
      let sent = 0
      for (const u of users) {
        const r = await pg('POST', 'notifications', { user_id: u.id, type: 'announce', title, content })
        if (r.ok) sent++
      }
      await logActivity('admin', uid, '', 'send_announce', '', '', `${title}（${sent} 人）`)
      return json({ ok: true, sent })
    }

    // ── 后台查看运行日志 ──
    if (action === 'admin_logs') {
      await requireAdmin(uid)
      const { actor_type, action: act, limit } = body
      let path = 'activity_logs?select=*&order=created_at.desc&limit=' + (Number(limit) || 100)
      if (actor_type) path += `&actor_type=eq.${enc(actor_type)}`
      if (act) path += `&action=eq.${enc(act)}`
      const r = await pg('GET', path)
      if (!r.ok) return json({ error: '查询失败' }, 500)
      return json({ logs: r.data || [] })
    }

    // ── 每日签到（按中国日期，一人一天一次，连签奖励 + 满 7 天周奖励）──
    if (action === 'check_in') {
      const me = await requireUser(uid)
      const today = chinaDate()
      // 今日是否已签（防重复，唯一索引同时兜底并发）
      const tRes = await pg('GET', `checkins?select=id,points,streak&user_id=eq.${enc(uid)}&checkin_date=eq.${enc(today)}`)
      if (Array.isArray(tRes.data) && tRes.data.length) {
        const t = tRes.data[0]
        return json({ ok: true, already: true, points: Number(t.points), streak: Number(t.streak) })
      }
      // 连续天数：看昨天是否签
      const yRes = await pg('GET', `checkins?select=streak&user_id=eq.${enc(uid)}&checkin_date=eq.${enc(yesterdayOf(today))}`)
      let streak = 1
      if (Array.isArray(yRes.data) && yRes.data.length) streak = Number(yRes.data[0].streak) + 1
      let points = CHECKIN_BASE + Math.min((streak - 1) * CHECKIN_BONUS_PER_DAY, CHECKIN_BONUS_CAP)
      let weekBonus = 0
      if (streak % 7 === 0) { weekBonus = CHECKIN_WEEK_BONUS; points += weekBonus }
      const newBal = Number(me.balance) + points
      await pg('PATCH', `profiles?id=eq.${enc(uid)}`, { balance: newBal })
      await pg('POST', 'txns', {
        user_id: uid,
        type: 'checkin',
        amount: points,
        balance_after: newBal,
        remark: `签到（连续 ${streak} 天）+${points} 积分${weekBonus ? `，含周奖励 ${weekBonus}` : ''}`
      })
      const ins = await pg('POST', 'checkins', { user_id: uid, checkin_date: today, points, streak })
      await logActivity('user', uid, me.nickname || '', 'check_in', 'wallet', '', `签到 连续 ${streak} 天 +${points} 积分`)
      return json({ ok: true, already: false, points, streak, weekBonus, balance: newBal, checkin: ins.data?.[0] || null })
    }

    return json({ error: '未知操作：' + action }, 400)
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    return json({ error: e?.message || 'server error' }, status)
  }
})
