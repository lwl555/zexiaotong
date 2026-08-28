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
  Profile, Task, Goods, Post, Comment, Message, WalletTxn, Withdrawal,
  Arbitration, Notification, Category, Banner, PlatformConfig, Role,
  TaskStatus, GoodsStatus, PostStatus
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
  const d = await dbWrite('register', { qq, password_hash: hash, nickname })
  // [DEBUG] 临时排查 uid 与 DB 不一致
  try { console.log('[DEBUG registerUser] resp=', JSON.stringify(d), 'storedId=', d?.profile?.id) } catch {}
  const prof = rowToProfile(d.profile)
  try { localStorage.setItem(STORAGE_KEY, prof.id) } catch {}
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

export async function createTask(task: Partial<Task>): Promise<Task> {
  const d = await dbWrite('insert', { table: 'tasks', row: task })
  return d.row as Task
}

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

export async function addTxn(txn: Partial<WalletTxn>): Promise<WalletTxn> {
  const d = await dbWrite('insert', { table: 'txns', row: txn })
  return d.row as WalletTxn
}

export async function fetchTxns(userId: string): Promise<WalletTxn[]> {
  const { data, error } = await supabase!
    .from('txns')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as WalletTxn[]
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

export async function createGoods(goods: Partial<Goods>): Promise<Goods> {
  const d = await dbWrite('insert', { table: 'goods', row: goods })
  return d.row as Goods
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

export async function createPost(post: Partial<Post>): Promise<Post> {
  const d = await dbWrite('insert', { table: 'posts', row: post })
  return d.row as Post
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

export async function fetchMessages(convId: string): Promise<Message[]> {
  const { data, error } = await supabase!
    .from('messages')
    .select('*')
    .eq('conv_id', convId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []) as Message[]
}

export async function sendMessage(msg: Partial<Message>): Promise<Message> {
  const d = await dbWrite('insert', { table: 'messages', row: msg })
  return d.row as Message
}

// ─── 通知 ───────────────────────────────────────────────────────

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase!
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Notification[]
}

export async function markRead(notifId: string): Promise<void> {
  await dbWrite('update', { table: 'notifications', id: notifId, updates: { read: true }, uid: currentUid() })
}

export async function createNotification(notif: Partial<Notification>): Promise<Notification> {
  const d = await dbWrite('insert', { table: 'notifications', row: notif })
  return d.row as Notification
}

// ─── 提现 ───────────────────────────────────────────────────────

export async function fetchWithdrawals(userId: string): Promise<Withdrawal[]> {
  const { data, error } = await supabase!
    .from('withdrawals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Withdrawal[]
}

export async function createWithdrawal(wd: Partial<Withdrawal>): Promise<Withdrawal> {
  const d = await dbWrite('insert', { table: 'withdrawals', row: wd })
  return d.row as Withdrawal
}

// ─── 仲裁 ───────────────────────────────────────────────────────

export async function fetchArbitrations(userId?: string): Promise<Arbitration[]> {
  let query = supabase!.from('arbitrations').select('*').order('created_at', { ascending: false })
  if (userId) query = query.or(`plaintiff_id.eq.${userId},defendant_id.eq.${userId}`)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as Arbitration[]
}

export async function createArbitration(arb: Partial<Arbitration>): Promise<Arbitration> {
  const d = await dbWrite('insert', { table: 'arbitrations', row: arb })
  return d.row as Arbitration
}

export async function updateArbitration(id: string, updates: Partial<Arbitration>): Promise<Arbitration> {
  const d = await dbWrite('update', { table: 'arbitrations', id, updates, uid: currentUid() })
  return (d.row || { id, ...updates }) as Arbitration
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
  return (data || []) as Category[]
}

export async function fetchBanners(): Promise<Banner[]> {
  const { data, error } = await supabase!.from('banners').select('*')
  if (error) throw error
  return (data || []) as Banner[]
}

// ─── 管理员操作 ─────────────────────────────────────────────────

export async function adminApproveWithdrawal(wdId: string, userId: string, amount: number, operatorId: string) {
  await dbWrite('approve_wd', { wdId, userId, amount, uid: operatorId })
}

export async function adminRejectWithdrawal(wdId: string, reason: string, operatorId: string) {
  await dbWrite('reject_wd', { wdId, reason, uid: operatorId })
}

// ─── 供 store 直接调用（替代原本绕过 db 层的裸 supabase!.from 写操作）───

// 充值：走 db-write 的 recharge action（绕过 RLS 写限制，后端改余额 + 记流水）
export async function recharge(uid: string, amount: number): Promise<number> {
  const d = await dbWrite('recharge', { uid, amount })
  return d.balance as number
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

// 列出用户（分页，page 从 0 开始）
export async function adminListUsers(page = 0): Promise<Profile[]> {
  const data = await adminInvoke('list', { page })
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
