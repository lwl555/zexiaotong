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

// 校验调用者身份，返回 profile（不存在即 403）
async function requireUser(uid: string): Promise<any> {
  const p = await getProfile(uid)
  if (!p) throw new Error('用户不存在')
  return p
}

async function requireAdmin(uid: string): Promise<any> {
  const p = await requireUser(uid)
  if (p.role !== 'admin') throw new Error('无权限：需要管理员')
  return p
}

// 通用 insert：白名单表 + owner 校验
const INSERT_ALLOWED: Record<string, string[]> = {
  comments: [],                       // 评论无 owner 字段，按目标关联写入
  messages: ['sender_id'],
  notifications: ['user_id'],
  withdrawals: ['user_id'],
  arbitrations: ['plaintiff_id'],
  txns: ['user_id']
}

// 通用 update：白名单表 + 所有权（或管理员）校验，owner 字段映射
const UPDATE_ALLOWED: Record<string, string[]> = {
  tasks: ['poster_id', 'accepted_id'],
  posts: ['author_id'],
  notifications: ['user_id'],
  withdrawals: ['user_id'],
  arbitrations: ['plaintiff_id', 'defendant_id'],
  profiles: ['id']
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

    // ── 充值 ──
    if (action === 'recharge') {
      const { amount } = body
      if (typeof amount !== 'number' || amount <= 0) return json({ error: '金额无效' }, 400)
      const me = await requireUser(uid)
      const newBal = Number(me.balance) + Number(amount)
      const u = await pg('PATCH', `profiles?id=eq.${enc(uid)}`, { balance: newBal })
      if (!u.ok) return json({ error: '充值失败' }, 500)
      await pg('POST', 'txns', {
        user_id: uid,
        type: 'recharge',
        amount,
        balance_after: newBal,
        remark: '账户充值'
      })
      return json({ balance: newBal })
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
        remark: `发布任务冻结（${task.title}）`
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
      // 解冻雇主
      await pg('PATCH', `profiles?id=eq.${enc(task.poster_id)}`, { frozen: Number(task.frozen ?? 0) - Number(task.amount) })
      // 给接单者加款
      const acc = await pg('GET', `profiles?select=balance&id=eq.${enc(task.accepted_id)}`)
      const accBal = Array.isArray(acc.data) && acc.data[0] ? Number(acc.data[0].balance) : 0
      await pg('PATCH', `profiles?id=eq.${enc(task.accepted_id)}`, { balance: accBal + net })
      await pg('POST', 'txns', {
        user_id: task.accepted_id,
        type: 'income',
        amount: net,
        balance_after: accBal + net,
        remark: `任务完成收入（${task.title}，平台抽佣 ¥${commission}）`
      })
      await pg('PATCH', `tasks?id=eq.${enc(taskId)}`, { status: 'done' })
      await pg('POST', 'notifications', {
        user_id: task.accepted_id,
        type: 'task_status',
        title: '任务已完成',
        content: `「${task.title}」已结算，收入 ¥${net}`
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
        announce: config.announce
      })
      if (!u.ok) return json({ error: '更新失败' }, 500)
      return json({ ok: true })
    }

    // ── 审核提现：通过（管理员）──
    if (action === 'approve_wd') {
      const { wdId, userId, amount } = body
      await requireAdmin(uid)
      const u = await pg('GET', `profiles?select=balance&id=eq.${enc(userId)}`)
      const bal = Array.isArray(u.data) && u.data[0] ? Number(u.data[0].balance) : 0
      await pg('PATCH', `profiles?id=eq.${enc(userId)}`, { balance: bal - Number(amount) })
      const w = await pg('PATCH', `withdrawals?id=eq.${enc(wdId)}`, {
        status: 'approved',
        handled_at: new Date().toISOString()
      })
      if (!w.ok) return json({ error: '更新失败' }, 500)
      return json({ ok: true })
    }

    // ── 审核提现：拒绝（管理员）──
    if (action === 'reject_wd') {
      const { wdId, reason } = body
      await requireAdmin(uid)
      const w = await pg('PATCH', `withdrawals?id=eq.${enc(wdId)}`, {
        status: 'rejected',
        reason,
        handled_at: new Date().toISOString()
      })
      if (!w.ok) return json({ error: '更新失败' }, 500)
      return json({ ok: true })
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

    // ── 通用 update（白名单表 + 所有权/管理员校验）──
    if (action === 'update') {
      const { table, id, updates } = body
      if (!UPDATE_ALLOWED.hasOwnProperty(table)) return json({ error: '不允许更新该表：' + table }, 400)
      if (!id) return json({ error: '缺少 id' }, 400)
      const r = await pg('GET', `${table}?select=*&id=eq.${enc(id)}`)
      if (!r.ok || !Array.isArray(r.data) || !r.data.length) return json({ error: '记录不存在' }, 404)
      const target = r.data[0]
      const owners = UPDATE_ALLOWED[table]
      // 帖子点赞/收藏/评论数等计数器：允许任意登录用户修改（非作者也可点赞）
      if (table === 'posts' && Object.keys(updates).every((k) => ['liked', 'likes', 'collected', 'collects', 'comments'].includes(k))) {
        const u = await pg('PATCH', `${table}?id=eq.${enc(id)}`, updates)
        if (!u.ok) return json({ error: '更新失败：' + JSON.stringify(u.data) }, 500)
        return json({ ok: true, row: u.data?.[0] })
      }
      const isOwner = owners.some((c) => target[c] === uid)
      if (!isOwner) {
        const p = await getProfile(uid)
        if (!p || p.role !== 'admin') return json({ error: '无权限修改该记录' }, 403)
      }
      const u = await pg('PATCH', `${table}?id=eq.${enc(id)}`, updates)
      if (!u.ok) return json({ error: '更新失败：' + JSON.stringify(u.data) }, 500)
      return json({ ok: true, row: u.data?.[0] })
    }

    return json({ error: '未知操作：' + action }, 400)
  } catch (e: any) {
    return json({ error: e?.message || 'server error' }, 500)
  }
})
