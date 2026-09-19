// Supabase 数据操作层
// 封装所有数据库查询/变更，store.ts 不再直接持有 Mock 数据
//
// 设计：
// - 不强制登录（游客模式也能用）
// - 用户 id 存在 localStorage，启动时自动匿名注册
// - 后续可升级为真实 Supabase Auth

import { supabase } from './supabase'
import { sha256Hex } from './hash'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Profile, Task, Goods, Post, Comment, Message, WalletTxn, Withdrawal, RechargeOrder,
  Arbitration, Notification, Category, Banner, PlatformConfig, Role,
  TaskStatus, GoodsStatus, PostStatus, School, Bulletin, ActivityLog, CheckIn,
  Report, ReportTarget, ReportStatus
} from './types'

export { supabase }
export type { SupabaseClient }


const STORAGE_KEY = 'zex:user_id'

// 网络不稳定 / 微信内置浏览器 / 隐私模式下，supabase 调用可能长时间不返回。
// 任何单次调用都强制限时：到点立刻拒掉，让 UI 立刻走兜底，不再"加载中..."无限转。
// 浏览器杀 setTimeout 不会泄：Promise.race 之后未完成的 promise 仍会被 GC 回收。
function withTimeout<T>(p: PromiseLike<T>, ms: number, label = 'query'): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`[db:${label}] 超时 ${ms}ms`)), ms)
    )
  ])
}

function ensureUserId(): string {
  let id = localStorage.getItem(STORAGE_KEY) || ''
  if (!id) {
    // 匿名游客：生成随机 id，写入 profiles
    id = (crypto as any)?.randomUUID?.() || `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

// 数据层映射：profiles 表的登录标识列历史命名为 phone（unique not null），
// 应用层统一用 qq 表示「QQ 号」。仅在 db 层做转换，避免改动数据库结构。
function rowToProfile(row: any): Profile {
  if (!row) return row
  // 剔除密码哈希，避免进入前端内存/UI
  const { password_hash, ...rest } = row
  return { ...rest, qq: (row.qq ?? row.phone ?? '') } as Profile
}
function profileToRow(p: Partial<Profile>): Record<string, any> {
  const row: Record<string, any> = { ...p }
  if ('qq' in row) {
    row.phone = row.qq
    delete row.qq
  }
  return row
}

// 本地兜底用户：网络彻底不通时也要让 UI 跑起来，不能一直卡在「加载中...」转圈
function localGuest(id: string): Profile {
  return {
    id,
    qq: '',
    nickname: '游客' + id.slice(-4),
    avatar: '',
    role: 'user',
    balance: 0,
    frozen: 0,
    status: 'active'
  } as Profile
}

export async function getCurrentUser(roleOverride?: Role): Promise<Profile> {
  const id = ensureUserId()
  const fallback = localGuest(id)
  if (!supabase) {
    // 无 supabase 时用本地兜底，但应用 roleOverride（演示模式）
    if (roleOverride) return { ...fallback, role: roleOverride }
    return fallback
  }

  // 拉 profile（最多等 6 秒；微信内置浏览器慢/连接被掐时不能干等）
  try {
    // 优化：maybeSingle() 替代 single()——无行时返回 data=null 而非 406，避免控制台刷"Failed to load resource 406"。
    // 注意：profiles 表里的列名是 phone，不是 qq（qq 是应用层 rowToProfile 的别名），这里必须用 phone。
    const { data, error } = await withTimeout(
      supabase.from('profiles').select('id, phone, nickname, avatar, role, balance, frozen, status, created_at').eq('id', id).maybeSingle(),
      6000,
      'selectProfile'
    )
    if (!error && data) {
      // roleOverride 仅用于登录时首次写入（演示用：新建账号时赋予角色）
      return rowToProfile(data)
    }
    // 没拉到记录：直接返回本地兜底。
    // 原逻辑还会试着 INSERT 一个匿名游客档案，但 RLS 对 anon 的 INSERT 一律拒（返回 409），
    // 既浪费时间又污染控制台。这里彻底跳过：访客的"档案"只在登录/注册时才真正落库。
    if (roleOverride) return { ...fallback, role: roleOverride }
    return fallback
  } catch {
    // 任何超时 / 异常 → 直接返回本地兜底，保证 init() 不卡死
    if (roleOverride) return { ...fallback, role: roleOverride }
    return fallback
  }
}

export function logoutUser() {
  localStorage.removeItem(STORAGE_KEY)
}

// 真正的登录：把用户填的 QQ 号写入 profile（匿名游客默认 qq 为空，登录后才算「已登录」）
// 用于区分「游客」与「已登录用户」——UI 以 me.qq 是否非空判断。
export async function loginUser(qq: string, roleOverride?: Role): Promise<Profile> {
  const id = ensureUserId()
  const base = localGuest(id)
  const nickname = qq ? qq.slice(0, 3) + '****' + qq.slice(-2) : base.nickname
  const prof: Profile = { ...base, qq, nickname, role: roleOverride ?? base.role }
  if (!supabase) return prof

  try {
    // 走 db-write（service_role 绕过 RLS，后端按 uid 写入 phone/role）
    const d = await dbWrite('login_set', { uid: id, qq, role: roleOverride })
    if (d?.profile) return rowToProfile(d.profile)
    return prof
  } catch {
    return prof
  }
}

// ─── 注册 / 密码登录 ─────────────────────────────────────────
// 真正注册：写入 QQ + 密码哈希（前端 SHA-256(qq:password)）。
// 走 db-write（service_role 绕过 RLS，后端做重复检查 + 插入）。
export async function registerUser(qq: string, password: string): Promise<Profile> {
  const hash = await sha256Hex(`${qq}:${password}`)
  const nickname = qq.slice(0, 3) + '****' + qq.slice(-2)

  if (!supabase) {
    // 无 supabase：本地兜底（不持久化密码，仅本次会话）
    const id = (crypto as any)?.randomUUID?.() || `u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const prof: Profile = { id, qq, nickname, avatar: '', role: 'user', balance: 0, frozen: 0, status: 'active' }
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
    return prof
  }

  // 走 db-write 的 register action（后端查重 + 插入，绕过 anon RLS 写限制）
  // 关键：把前端游客 uid 一并传过去，让后端用同一 id 落库，避免前后端 id 分裂。
  // 前端游客 id 即权威 profile id，注册后无需依赖后端返回值再同步 localStorage。
  const id = ensureUserId()
  const d = await dbWrite('register', { uid: id, qq, password_hash: hash, nickname })
  const prof = d?.profile
    ? rowToProfile(d.profile)
    : { id, qq, nickname, avatar: '', role: 'user', balance: 0, frozen: 0, status: 'active' } as Profile
  try { localStorage.setItem(STORAGE_KEY, id) } catch {}
  return prof
}

// 真正登录：按 QQ 查账号，比对密码哈希。select 受 RLS using(true) 放行。
export async function loginUserWithPassword(qq: string, password: string): Promise<Profile> {
  if (!supabase) throw new Error('网络未连接，无法登录')
  let data: any = null, error: any = null
  try {
    const r = await withTimeout(
      supabase.from('profiles')
        .select('id, phone, nickname, avatar, role, balance, frozen, status, created_at, password_hash')
        .eq('phone', qq)
        .maybeSingle(),
      6000, 'loginSelect'
    )
    data = r.data; error = r.error
  } catch (e: any) {
    error = e
  }
  if (error) {
    const msg = String(error?.message || '')
    if (error?.code === 'PGRST204' || msg.includes('password_hash') || msg.includes('column')) {
      throw new Error('数据库尚未升级，请先执行密码字段迁移 SQL（详见部署说明）')
    }
    throw new Error('登录失败：' + msg)
  }
  if (!data) throw new Error('账号不存在，请先注册')
  if (!data.password_hash) throw new Error('该账号未设置密码，请先注册')
  const hash = await sha256Hex(`${qq}:${password}`)
  if (hash !== data.password_hash) throw new Error('密码错误')
  const prof = rowToProfile(data)
  try { localStorage.setItem(STORAGE_KEY, prof.id) } catch {}
  return prof
}

// ─── 任务 ───────────────────────────────────────────────────────

export async function fetchTasks(status?: TaskStatus): Promise<Task[]> {
  let query = supabase!.from('tasks').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as Task[]
}

export async function fetchMyTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase!
    .from('tasks')
    .select('*')
    .eq('poster_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Task[]
}

// 说明：原 createTask（通用 insert 写 tasks）已删除 —— tasks 不在 insert 白名单，
// 调用它必然返回「不允许写入该表：tasks」。发布任务请用文件下方的 publishTask()（专用动作）。

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const d = await dbWrite('update', { table: 'tasks', id, updates, uid: currentUid() })
  return (d.row || { id, ...updates }) as Task
}

// ─── 钱包 ───────────────────────────────────────────────────────

export async function fetchBalance(userId: string): Promise<{ balance: number; frozen: number }> {
  const { data } = await supabase!
    .from('profiles')
    .select('balance, frozen')
    .eq('id', userId)
    .single()
  return { balance: data?.balance || 0, frozen: data?.frozen || 0 }
}

// 说明：原 addTxn（通用 insert 写 txns）已删除。
// txns 的 owner 是 user_id，通用 insert 必须传 uid 才能通过校验；而流水本就不该由前端随意写
// （等于随手给自己记账）。所有余额变动现在都在服务端动作里连带写流水
// （add_points / check_in / top_task / confirm_recharge / submit_withdraw / review_pass）。

// 走 db-write 的 my_txns：txns 的 RLS 读策略是 `auth.uid() = user_id`，本平台不走 Supabase Auth，
// anon 直连 auth.uid() 恒为 null → 直连查询永远返回 0 行（钱包「资金流水」因此一直是空的）。
export async function fetchTxns(userId: string): Promise<WalletTxn[]> {
  const d = await dbWrite('my_txns', { uid: userId })
  return (d.txns || []) as WalletTxn[]
}

// ─── 二手商品 ───────────────────────────────────────────────────

export async function fetchGoods(status: GoodsStatus = 'on'): Promise<Goods[]> {
  const { data, error } = await supabase!
    .from('goods')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Goods[]
}

// 发布商品必须走专用动作 publish_goods：goods 不在通用 insert 白名单内
// （通用 insert 会直接返回「不允许写入该表：goods」——这正是此前发布商品静默失败的原因）。
export async function createGoods(goods: Partial<Goods>): Promise<Goods> {
  const d = await dbWrite('publish_goods', { goods, uid: currentUid() })
  return d.goods as Goods
}

// ─── 社区帖子 ───────────────────────────────────────────────────

export async function fetchPosts(status: PostStatus = 'on'): Promise<Post[]> {
  const { data, error } = await supabase!
    .from('posts')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Post[]
}

// 发帖必须走专用动作 publish_post：posts 不在通用 insert 白名单内
// （通用 insert 会直接返回「不允许写入该表：posts」——这正是此前发帖静默失败的原因）。
// 后端会校验 post.author_id === uid，防冒名发帖。
export async function createPost(post: Partial<Post>): Promise<Post> {
  const d = await dbWrite('publish_post', { post, uid: currentUid() })
  return d.post as Post
}

/**
 * 触发社区智能体发帖（Edge Function `community-bots`）。
 * 生成文字 + 配图并真实入库，服务端内置限频（默认 30 分钟 2 条）与人设轮转。
 * 返回本次真实新增条数（被限频 / 失败时为 0），调用方据此决定是否刷新列表。
 */
export async function triggerCommunityBots(count = 1): Promise<number> {
  try {
    const r: any = await withTimeout(
      supabase!.functions.invoke('community-bots', { body: { count } }),
      120000,
      'community-bots'
    )
    const created = r?.data?.created
    return Array.isArray(created) ? created.length : 0
  } catch {
    return 0
  }
}

/**
 * 触发社区智能体自动互动（Edge Function `community-bots` 的 interact 模式）。
 * 让 bot 给最近帖子/小黑板留言 + 顺手点赞，制造「随处都有活人」的氛围。
 * 服务端内置限频（30 分钟窗口内达上限则跳过），前端也可放心反复调用。
 * 纯后台行为：不抛错、不阻塞 UI，返回是否真有互动发生。
 */
export async function botInteract(count = 1): Promise<boolean> {
  try {
    const r: any = await withTimeout(
      supabase!.functions.invoke('community-bots', { body: { mode: 'interact', count } }),
      60000,
      'community-bots-interact'
    )
    const data = r?.data || {}
    return !!data?.ok && !data?.skipped
  } catch {
    return false
  }
}

// 客户端节流：10 分钟内最多触发一次，配合服务端 30 分钟限频，避免来回切页面频繁打函数。
const BOT_INTERACT_KEY = 'zex:bot_interact_at'
export async function maybeBotInteract(count = 1): Promise<void> {
  try {
    const last = Number(localStorage.getItem(BOT_INTERACT_KEY) || 0)
    const now = Date.now()
    if (now - last < 10 * 60 * 1000) return
    localStorage.setItem(BOT_INTERACT_KEY, String(now))
    await botInteract(count)
  } catch {
    /* 静默失败，绝不阻塞页面 */
  }
}

export async function updatePost(id: string, updates: Partial<Post>): Promise<Post> {
  const d = await dbWrite('update', { table: 'posts', id, updates, uid: currentUid() })
  return (d.row || { id, ...updates }) as Post
}

// ─── 评论 ───────────────────────────────────────────────────────

export async function fetchComments(target_type: string, target_id: string): Promise<Comment[]> {
  const { data, error } = await supabase!
    .from('comments')
    .select('*')
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []) as Comment[]
}

export async function createComment(comment: Partial<Comment>): Promise<Comment> {
  const d = await dbWrite('insert', { table: 'comments', row: comment })
  return d.row as Comment
}

// ─── 私信 ───────────────────────────────────────────────────────

// 取当前用户参与的所有私信（私信页在前端按 conv_id 聚合）。messages 的 SELECT 策略用 auth.uid()，
// 自研登录下 anon 恒 null → 直连读 0 行，故走 db-write（service_role）按 uid 过滤。
export async function fetchMyMessages(uid: string): Promise<Message[]> {
  const d = await dbWrite('my_messages', { uid })
  return (d.messages || []) as Message[]
}

// 标记某条私信为已读：仅收件人可改（后端 UPDATE_ALLOWED.messages=receiver_id，列白名单仅 read）。
export async function markMessageRead(id: string): Promise<void> {
  await dbWrite('update', { table: 'messages', id, updates: { read: true }, uid: currentUid() })
}

// ⚠️ 必须带 uid：db-write 的 insert 对 messages 做 owner 校验（row.sender_id === uid）。
// 之前这里没传 uid，后端拿 undefined 比对恒不相等 → 发私信一直报「身份不匹配」，
// 而前端做了乐观更新，界面上「看起来发出去了」，实则未落库。
export async function sendMessage(msg: Partial<Message>): Promise<Message> {
  const d = await dbWrite('insert', { table: 'messages', row: msg, uid: currentUid() })
  return d.row as Message
}

// ─── 通知 ───────────────────────────────────────────────────────

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  // notifications 的 SELECT 策略用 auth.uid()，前端直连读 0 行，走 db-write 按 uid 过滤。
  const d = await dbWrite('my_notifications', { uid: userId })
  return (d.notifications || []) as Notification[]
}

export async function markRead(notifId: string): Promise<void> {
  await dbWrite('update', { table: 'notifications', id: notifId, updates: { read: true }, uid: currentUid() })
}

// 站内通知：收件人通常是「别人」（如"有人给你发私信"），无法用带 owner 校验的通用 insert
//（notifications 的 owner 是 user_id，而 user_id 不是当前登录用户，必然 403）。
// 故走专用动作 notify：后端要求调用者是真实登录用户，字段白名单收敛，read 强制 false。
export async function createNotification(notif: Partial<Notification>): Promise<void> {
  await dbWrite('notify', {
    uid: currentUid(),
    target_user_id: notif.user_id,
    type: notif.type,
    title: notif.title,
    content: notif.content,
  })
}

// ─── 提现 ───────────────────────────────────────────────────────

// 提现列表。withdrawals 含收款账号，RLS 读策略同样是 auth.uid() 且不打算对 anon 全表开放，
// 因此统一走 db-write 读取：本人只能取自己的（mine），全量必须管理员（all）。

/** 我的提现申请（用户端钱包用） */
export async function fetchMyWithdrawals(userId: string): Promise<Withdrawal[]> {
  const d = await dbWrite('list_withdrawals', { uid: userId, scope: 'mine' })
  return (d.withdrawals || []) as Withdrawal[]
}

/** 全部提现申请（管理端「提现审核」用，后端会校验管理员身份） */
export async function fetchAllWithdrawals(operatorId: string): Promise<Withdrawal[]> {
  const d = await dbWrite('list_withdrawals', { uid: operatorId, scope: 'all' })
  return (d.withdrawals || []) as Withdrawal[]
}

// 提交提现申请：走 db-write 的 submit_withdraw（后端冻结积分 + 校验规则 + 落收款信息）。
// 旧实现直接 insert，不冻结余额，可重复提交多笔导致管理员重复打款。
export async function submitWithdraw(input: {
  userId: string
  userName: string
  amount: number
  channel: string
  account: string
  accountName?: string
}): Promise<Withdrawal> {
  const d = await dbWrite('submit_withdraw', {
    uid: input.userId,
    amount: input.amount,
    channel: input.channel,
    account: input.account,
    accountName: input.accountName || ''
  })
  return d.withdrawal as Withdrawal
}

// ─── 仲裁 ───────────────────────────────────────────────────────

export async function fetchArbitrations(userId: string, scope: 'mine' | 'all' = 'mine'): Promise<Arbitration[]> {
  // arbitrations 的 SELECT 策略用 auth.uid()，前端直连读 0 行；管理员审核页需要全量。
  // 走 db-write：scope=mine 取本人相关，scope=all 必须管理员（后端校验 admin）。
  const d = await dbWrite('list_arbitrations', { uid: userId, scope })
  return (d.arbitrations || []) as Arbitration[]
}

// 同上：arbitrations 的 owner 是 plaintiff_id，insert 必须带 uid 才能通过校验。
export async function createArbitration(arb: Partial<Arbitration>): Promise<Arbitration> {
  const d = await dbWrite('insert', { table: 'arbitrations', row: arb, uid: currentUid() })
  return d.row as Arbitration
}

export async function updateArbitration(id: string, updates: Partial<Arbitration>): Promise<Arbitration> {
  const d = await dbWrite('update', { table: 'arbitrations', id, updates, uid: currentUid() })
  return (d.row || { id, ...updates }) as Arbitration
}

// ─── 举报 ───────────────────────────────────────────────────────
// reports 表**不开放 anon 读策略**（举报内容含双方身份，不应匿名可读）。
// 写入走 db-write 的 insert（表在 INSERT_ALLOWED，owner=reporter_id 校验，防伪造举报人）；
// 读取走 list_reports（service_role + 后端 requireAdmin），只有管理员能拿到全量。
export async function createReport(input: {
  target_type: ReportTarget
  target_id: string
  target_title?: string
  reason: string
  detail?: string
  reporter_id: string
  reporter_name: string
}): Promise<void> {
  await dbWrite('insert', { table: 'reports', row: input, uid: input.reporter_id })
}

export async function fetchReports(adminId: string): Promise<Report[]> {
  const d = await dbWrite('list_reports', { uid: adminId })
  return (d.reports || []) as Report[]
}

/** 管理员处理举报：标记已处理 / 驳回。列白名单只允许 status，行校验要求管理员。 */
export async function handleReport(id: string, status: ReportStatus, adminId: string): Promise<void> {
  await dbWrite('update', { table: 'reports', id, updates: { status }, uid: adminId })
}

// ─── 平台配置 ───────────────────────────────────────────────────

export async function fetchPlatformConfig(): Promise<PlatformConfig> {
  const DEFAULT_CFG: PlatformConfig = { commission_rate: 0.10, top_price: { d1: 2, d3: 5, d7: 10 }, announce: '' }
  if (!supabase) return DEFAULT_CFG
  try {
    // 优化：显式列 + maybeSingle()。原 select('*') 在 RLS 列级限制下返回 406（控制台报错且取不到配置）。
    const { data, error } = await withTimeout(
      supabase!.from('platform_config')
        .select('commission_rate, top_price_d1, top_price_d3, top_price_d7, announce')
        .maybeSingle(),
      6000, 'fetchConfig'
    )
    if (error || !data) return DEFAULT_CFG
    return {
      commission_rate: (data as any).commission_rate,
      top_price: { d1: (data as any).top_price_d1, d3: (data as any).top_price_d3, d7: (data as any).top_price_d7 },
      announce: (data as any).announce
    } as PlatformConfig
  } catch {
    return DEFAULT_CFG
  }
}

// ─── 分类 / 轮播 ───────────────────────────────────────────────

export async function fetchCategories(kind?: 'task' | 'goods'): Promise<Category[]> {
  let query = supabase!.from('categories').select('*')
  if (kind) query = query.eq('kind', kind)
  const { data, error } = await query
  if (error) throw error
  // 兜底去重：历史上种子迁移跑过两次导致同一 (kind,name) 重复入库，
  // 会让首页 tab / 发布任务 / 二手筛选出现「同一个分类出现两遍」。
  // DB 侧已加 UNIQUE(kind,name) 约束（迁移 0011），这里再兜一层，防止存量/异常数据漏网。
  const seen = new Set<string>()
  const uniq: Category[] = []
  for (const c of (data || []) as Category[]) {
    const key = `${c.kind}::${c.name}`
    if (seen.has(key)) continue
    seen.add(key)
    uniq.push(c)
  }
  return uniq
}

export async function fetchBanners(): Promise<Banner[]> {
  const { data, error } = await supabase!.from('banners').select('*')
  if (error) throw error
  return (data || []) as Banner[]
}

// ─── 院校 / 小黑板 / 运行日志 ───────────────────────────────────

export async function fetchSchools(): Promise<School[]> {
  const { data, error } = await supabase!
    .from('schools')
    .select('*')
    .order('name')
  if (error) throw error
  return (data || []) as School[]
}

// 小黑板列表：
//   - 全部模式：所有 status=on 的帖子
//   - 指定学校模式：该校专属帖子 + 标记为「全部院校」的全局帖子
export async function fetchBulletins(opts?: { schoolId?: string | null }): Promise<Bulletin[]> {
  let q = supabase!.from('bulletins').select('*').eq('status', 'on')
  if (opts?.schoolId && opts.schoolId !== 'all') {
    q = q.or(`school_id.eq.${opts.schoolId},is_all_schools.eq.true`)
  }
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Bulletin[]
}

export async function createBulletin(b: Partial<Bulletin>): Promise<Bulletin> {
  const d = await dbWrite('publish_bulletin', { bulletin: b })
  return d.bulletin as Bulletin
}

export async function fetchBulletinComments(bulletinId: string): Promise<Comment[]> {
  return fetchComments('bulletin', bulletinId)
}

export async function addBulletinComment(c: Partial<Comment>): Promise<Comment> {
  const d = await dbWrite('add_comment', { ...c, target_type: 'bulletin' })
  return d.comment as Comment
}

// 管理员手动增减积分
export async function adminAddPoints(targetUserId: string, points: number, reason: string, operatorId: string) {
  await dbWrite('add_points', { targetUserId, points, reason, uid: operatorId })
}

// 管理员代发全站公告
export async function adminSendAnnounce(title: string, content: string, operatorId: string) {
  await dbWrite('send_announce', { title, content, uid: operatorId })
}

// 后台运行日志（需管理员身份，后端校验）
export async function fetchActivityLogs(opts?: { actor_type?: string; action?: string; limit?: number; operatorId?: string }): Promise<ActivityLog[]> {
  const data = await dbWrite('admin_logs', {
    actor_type: opts?.actor_type,
    action: opts?.action,
    limit: opts?.limit || 200,
    uid: opts?.operatorId || ''
  })
  return (data?.logs || []) as ActivityLog[]
}

// 签到：走 db-write 的 check_in action（服务端算中国日期、连签、发积分、写流水）
export async function checkIn(uid: string): Promise<any> {
  return dbWrite('check_in', { uid })
}

// 读取当前用户签到状态（今日是否已签 + 当前连续天数 + 下次签到的连签/积分预览 + 最近记录）
// checkins 表 RLS 设为 select using (true)，anon 也可读，用于展示活跃度。
export async function fetchCheckinStatus(uid: string): Promise<{
  checkedToday: boolean
  streak: number
  nextStreak: number
  nextPoints: number
  recent: CheckIn[]
}> {
  const empty = { checkedToday: false, streak: 0, nextStreak: 1, nextPoints: 10, recent: [] as CheckIn[] }
  if (!uid) return empty
  try {
    const { data, error } = await withTimeout(
      supabase!
        .from('checkins')
        .select('id,user_id,checkin_date,points,streak')
        .eq('user_id', uid)
        .order('checkin_date', { ascending: false })
        .limit(31),
      8000,
      'checkin-status'
    )
    if (error) return empty
    const rows = (data as any[]) || []
    const now = new Date()
    const sh = new Date(now.getTime() + 8 * 3600 * 1000 - now.getTimezoneOffset() * 60000)
    const today = sh.toISOString().slice(0, 10)
    const dates = rows.map(r => r.checkin_date).sort()
    const lastDate = dates.length ? dates[dates.length - 1] : null
    const checkedToday = lastDate === today
    const set = new Set(dates)
    // 以最近一次签到日为终点往前数连续天数
    let streak = 0
    if (lastDate) {
      let cur = new Date(lastDate + 'T00:00:00Z')
      while (set.has(cur.toISOString().slice(0, 10))) {
        streak++
        cur.setUTCDate(cur.getUTCDate() - 1)
      }
    }
    const nextStreak = checkedToday ? streak : streak + 1
    const nextPoints = 10 + Math.min((nextStreak - 1) * 2, 20) + (nextStreak % 7 === 0 ? 50 : 0)
    return { checkedToday, streak, nextStreak, nextPoints, recent: rows as CheckIn[] }
  } catch {
    return empty
  }
}

// ─── 管理员操作 ─────────────────────────────────────────────────

// 打款：金额与收款人由后端按 wdId 反查，前端只传单号（防篡改指定任意扣款）
export async function adminApproveWithdrawal(wdId: string, operatorId: string) {
  await dbWrite('approve_wd', { wdId, uid: operatorId })
}

export async function adminRejectWithdrawal(wdId: string, reason: string, operatorId: string) {
  await dbWrite('reject_wd', { wdId, reason, uid: operatorId })
}

// ─── 钱包规则 · 资金对账 ───────────────────────────────────────

export interface WalletRules {
  rechargeTiers: number[]
  rechargeMaxYuan: number
  withdrawMin: number
  withdrawStep: number
  withdrawMaxPerTxn: number
  withdrawMaxPerDay: number
}

/** 钱包规则由后端下发（档位、提现门槛与上限），前端不再镜像常量，避免改一处忘一处 */
export async function fetchWalletRules(): Promise<WalletRules> {
  const d = await dbWrite('wallet_rules', {})
  return {
    rechargeTiers: Array.isArray(d.rechargeTiers) ? d.rechargeTiers.map(Number) : [1, 6, 30, 98, 298],
    rechargeMaxYuan: Number(d.rechargeMaxYuan) || 10000,
    withdrawMin: Number(d.withdrawMin) || 1000,
    withdrawStep: Number(d.withdrawStep) || 100,
    withdrawMaxPerTxn: Number(d.withdrawMaxPerTxn) || 50000,
    withdrawMaxPerDay: Number(d.withdrawMaxPerDay) || 100000
  }
}

export interface PointsHealth {
  generatedAt: string
  totalUsers: number
  totalBalance: number
  totalFrozen: number
  txnRows: number
  truncated: boolean
  alertThreshold: number
  anomalies: {
    id: string; nickname: string; phone: string
    balance: number; frozen: number; txnSum: number; diff: number
  }[]
  frozenAnomalies: {
    id: string; nickname: string; phone: string
    frozen: number; expected: number; diff: number
  }[]
  highBalance: {
    id: string; nickname: string; phone: string
    balance: number; frozen: number
  }[]
}

/** 资金对账（管理员）：余额−流水−冻结 的差异 + 余额超告警线的账号 */
export async function fetchPointsHealth(operatorId: string): Promise<PointsHealth> {
  const d = await dbWrite('points_health', { uid: operatorId })
  return d as PointsHealth
}

// ─── 充值（三步：下单 →（模拟）支付 → 入账）──────────────────────
// 旧实现是「点一下充值就加钱」，没有支付、没有订单、没有幂等，连点即无限刷积分。
// 现在下单只生成 pending 订单，入账只认订单且同一订单只能入账一次。

/** 第一步：下单。返回订单号（后续收银台凭它入账）。金额必须是后端档位白名单内的值。 */
export async function createRechargeOrder(uid: string, amountYuan: number): Promise<RechargeOrder> {
  const d = await dbWrite('create_recharge_order', { uid, amount: amountYuan })
  return {
    id: d.orderId,
    user_id: uid,
    amount_yuan: d.amountYuan,
    points: d.points,
    status: d.status || 'pending',
    channel: 'mock',
    paid_at: null,
    created_at: new Date().toISOString()
  } as RechargeOrder
}

/** 第二步：支付确认并入账。幂等——重复调用只会到账一次。 */
export async function confirmRecharge(
  uid: string,
  orderId: string,
  channel = 'mock'
): Promise<{ balance: number; points: number; duplicate: boolean }> {
  const d = await dbWrite('confirm_recharge', { uid, orderId, channel })
  return { balance: Number(d.balance) || 0, points: Number(d.points) || 0, duplicate: !!d.duplicate }
}

/** 读单笔订单（收银台刷新后靠 URL 里的订单号重新拉取） */
export async function fetchRechargeOrder(orderId: string): Promise<RechargeOrder | null> {
  const { data } = await supabase!
    .from('recharge_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()
  return (data as RechargeOrder) || null
}

/** 我的充值订单（钱包页展示最近几笔） */
export async function fetchRechargeOrders(userId: string): Promise<RechargeOrder[]> {
  const { data, error } = await supabase!
    .from('recharge_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data || []) as RechargeOrder[]
}

// 平台配置：仅管理员可改
export async function setConfig(config: PlatformConfig, operatorId: string) {
  await dbWrite('set_config', { config, uid: operatorId })
}

// 改 profiles 状态（封禁/解封），仅管理员
export async function setProfileStatus(targetId: string, status: string, operatorId: string) {
  await dbWrite('update', { table: 'profiles', id: targetId, updates: { status }, uid: operatorId })
}

// 改业务记录状态（任务/商品/帖子 下架/删除），owner 或管理员
export async function setRecordStatus(
  table: 'tasks' | 'goods' | 'posts',
  id: string,
  status: string,
  operatorId: string
) {
  await dbWrite('update', { table, id, updates: { status }, uid: operatorId })
}

// ─── 业务闭环（带事务性保障） ───────────────────────────────────

// 发布任务：冻结余额 + 创建任务 + 记流水（整段走 db-write 的 publish_task action，原子执行）
export async function publishTask(input: {
  title: string
  category: string
  amount: number
  deadline: string
  description: string
  images: string[]
  poster_id: string
  poster_name: string
  poster_avatar: string
}) {
  const d = await dbWrite('publish_task', {
    uid: input.poster_id,
    task: { ...input, status: 'open', accepted_id: null, accepted_name: null, top_until: null }
  })
  return d.task as Task
}

// 接单
export async function takeTask(taskId: string) {
  const me = await getCurrentUser()
  if (!me) throw new Error('请先登录')
  await dbWrite('take_task', { taskId, uid: me.id, nickname: me.nickname })
}

// 付费置顶：扣费/写流水/改置顶时间全部在服务端原子完成
// （前端无权改 profiles.balance，必须走后端动作；见 db-write 的 top_task）
export async function topTask(taskId: string, days: 1 | 3 | 7): Promise<{ ok: boolean; balance: number; top_until: string; price: number }> {
  const me = await getCurrentUser()
  if (!me) throw new Error('请先登录')
  const d = await dbWrite('top_task', { taskId, days, uid: me.id })
  return { ok: true, balance: d.balance, top_until: d.top_until, price: d.price }
}

// 验收通过：结算（整段走 db-write 的 review_pass action，原子执行）
export async function reviewPass(taskId: string) {
  const me = await getCurrentUser()
  if (!me) throw new Error('请先登录')
  await dbWrite('review_pass', { taskId, uid: me.id })
}

// ─── 管理员用户操作（真实删除 / 冻结 / 解冻 / 列出）────────────────────
// 走 admin-users Edge Function（service_role 绕过 RLS，后端校验操作者 admin 身份）。
// 任何失败都会抛出可读错误，由调用方（UI）捕获后 toast 提示。

type AdminAction = 'list' | 'freeze' | 'unfreeze' | 'delete'

async function adminInvoke(action: AdminAction, payload: Record<string, any> = {}) {
  if (!supabase) throw new Error('未连接到数据库')
  const { data, error } = await withTimeout(
    supabase.functions.invoke('admin-users', { body: { action, ...payload } }),
    12000,
    'adminUsers'
  )
  if (error) throw new Error(error.message || '管理员操作请求失败')
  if (data && (data as any).error) throw new Error((data as any).error)
  return data as any
}

// ─── 通用写操作：走 db-write Edge Function（service_role 绕过 RLS，后端复刻所有权校验）───
// 任何失败都会抛出可读错误，由调用方（UI）捕获后 toast 提示。
async function dbWrite(action: string, payload: Record<string, any> = {}): Promise<any> {
  if (!supabase) throw new Error('未连接到数据库')
  const { data, error } = await withTimeout(
    supabase.functions.invoke('db-write', { body: { action, ...payload } }),
    15000,
    'dbWrite:' + action
  )
  if (error) throw new Error(error.message || '写操作请求失败')
  if (data && (data as any).error) throw new Error((data as any).error)
  return data as any
}

// 当前本地用户 id（localStorage 中保存的 profile id，登录/注册时已落库）
function currentUid(): string {
  return ensureUserId()
}

// 更新本人资料（昵称 / 头像）。可改字段在 db-write 里由 UPDATE_ALLOWED 控制，
// 且后端会校验 profiles.id === uid（只能改自己的），无需新增 Edge Function 动作。
export async function updateProfile(
  uid: string,
  updates: { nickname?: string; avatar?: string }
): Promise<Partial<Profile> | null> {
  const data = await dbWrite('update', { table: 'profiles', id: uid, updates, uid })
  return (data?.row || null) as Partial<Profile> | null
}

// 列出用户（分页，page 从 0 开始）
// 注意：admin-users 函数强制要求 operator_id 并校验其 role='admin'，
// 此前漏传该参数 → 后端直接 400「缺少操作者身份」，导致用户管理页永远拉不到数据。
export async function adminListUsers(operatorId: string, page = 0): Promise<Profile[]> {
  const data = await adminInvoke('list', { operator_id: operatorId, page })
  const rows = (data?.users || []) as any[]
  // function 直接返回 PG 行（phone 即 QQ 号），这里映射到应用层 qq 字段
  return rows.map((r) => ({ ...r, qq: r.phone || '', password_hash: undefined })) as Profile[]
}

// 冻结账号（status -> 'banned'）
export async function adminFreezeUser(operatorId: string, targetId: string): Promise<void> {
  await adminInvoke('freeze', { operator_id: operatorId, target_id: targetId })
}

// 解冻账号（status -> 'active'）
export async function adminUnfreezeUser(operatorId: string, targetId: string): Promise<void> {
  await adminInvoke('unfreeze', { operator_id: operatorId, target_id: targetId })
}

// 真实删除账号（连同其任务/商品/帖子/消息/流水等一并删除）
export async function adminDeleteUser(operatorId: string, targetId: string): Promise<void> {
  await adminInvoke('delete', { operator_id: operatorId, target_id: targetId })
}
