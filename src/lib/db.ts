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
    const { data, error } = await withTimeout(
      supabase.from('profiles').select('*').eq('id', id).single(),
      6000,
      'selectProfile'
    )
    if (!error && data) {
      // roleOverride 仅用于登录时首次写入（演示用：新建账号时赋予角色）
      return rowToProfile(data)
    }

    // 拉不到 → 试着 insert 一个（匿名游客注册）；insert 也限时，失败直接返回本地兜底
    const insertPayload = roleOverride ? { ...fallback, role: roleOverride } : fallback
    const ins = await withTimeout(
      supabase.from('profiles').insert(profileToRow(insertPayload)).select().single(),
      6000,
      'insertProfile'
    ).catch(() => ({ data: null as any, error: { message: 'insert timeout' } }))
    return (ins?.data as Profile) || fallback
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
    const { data, error } = await withTimeout(
      supabase.from('profiles').select('*').eq('id', id).single(),
      6000, 'loginSelect'
    )
    if (!error && data) {
      // 已有档案：补登 QQ 号 + 角色
      const upd: Record<string, any> = { phone: qq }
      if (roleOverride) upd.role = roleOverride
      const { data: u } = await withTimeout(
        supabase.from('profiles').update(upd).eq('id', id).select().single(),
        6000, 'loginUpdate'
      ).catch(() => ({ data: null as any }))
      return u ? rowToProfile(u) : { ...rowToProfile(data), ...(roleOverride ? { role: roleOverride } : {}) }
    }
    // 没有档案：插入（带 QQ 号）
    const ins = await withTimeout(
      supabase.from('profiles').insert(profileToRow(prof)).select().single(),
      6000, 'loginInsert'
    ).catch(() => ({ data: null as any }))
    return ins?.data ? rowToProfile(ins.data) : prof
  } catch {
    return prof
  }
}

// ─── 注册 / 密码登录 ─────────────────────────────────────────
// 真正注册：写入 QQ + 密码哈希（前端 SHA-256(qq:password)）。
// 走 insert（RLS 允许 anyone insert），完全避开 update 的 RLS 限制。
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

  // 1) 是否已注册该 QQ
  const { data: exist } = await withTimeout(
    supabase.from('profiles').select('id, password_hash').eq('phone', qq).maybeSingle(),
    6000, 'regCheck'
  ).catch(() => ({ data: null as any }))

  if (exist) {
    if (exist.password_hash) throw new Error('该 QQ 已注册，请直接登录')
    // 老游客账号（有 phone 无密码）：尝试补密码；若 RLS 拒绝则提示换 QQ
    const upd = await withTimeout(
      supabase.from('profiles').update({ password_hash: hash }).eq('id', exist.id),
      6000, 'regBackfill'
    ).catch(() => ({ error: { message: 'update denied' } as any }))
    if (upd?.error) throw new Error('该 QQ 已存在但未设置密码，请使用其他 QQ 注册')
    const { data } = await withTimeout(
      supabase.from('profiles').select('*').eq('id', exist.id).single(),
      6000, 'regBackfillGet'
    ).catch(() => ({ data: null as any }))
    if (data) {
      const prof = rowToProfile(data)
      try { localStorage.setItem(STORAGE_KEY, prof.id) } catch {}
      return prof
    }
  }

  // 2) 全新注册：用新 uuid 插入（不与游客 localStorage id 冲突）
  const id = (crypto as any)?.randomUUID?.() || `u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const payload: Record<string, any> = {
    id, phone: qq, nickname, avatar: '', role: 'user', balance: 0, frozen: 0, status: 'active', password_hash: hash
  }
  const { data, error } = await withTimeout(
    supabase.from('profiles').insert(profileToRow(payload)).select().single(),
    6000, 'regInsert'
  )
  if (error) throw new Error('注册失败：' + (error.message || '未知错误'))
  const prof = rowToProfile(data)
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
  const { data, error } = await supabase!
    .from('tasks')
    .insert(task)
    .select()
    .single()
  if (error) throw error
  return data as Task
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase!
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Task
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
  const { data, error } = await supabase!
    .from('txns')
    .insert(txn)
    .select()
    .single()
  if (error) throw error
  return data as WalletTxn
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
  const { data, error } = await supabase!
    .from('goods')
    .insert(goods)
    .select()
    .single()
  if (error) throw error
  return data as Goods
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
  const { data, error } = await supabase!
    .from('posts')
    .insert(post)
    .select()
    .single()
  if (error) throw error
  return data as Post
}

export async function updatePost(id: string, updates: Partial<Post>): Promise<Post> {
  const { data, error } = await supabase!
    .from('posts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Post
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
  const { data, error } = await supabase!
    .from('comments')
    .insert(comment)
    .select()
    .single()
  if (error) throw error
  return data as Comment
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
  const { data, error } = await supabase!
    .from('messages')
    .insert(msg)
    .select()
    .single()
  if (error) throw error
  return data as Message
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
  await supabase!
    .from('notifications')
    .update({ read: true })
    .eq('id', notifId)
}

export async function createNotification(notif: Partial<Notification>): Promise<Notification> {
  const { data, error } = await supabase!
    .from('notifications')
    .insert(notif)
    .select()
    .single()
  if (error) throw error
  return data as Notification
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
  const { data, error } = await supabase!
    .from('withdrawals')
    .insert(wd)
    .select()
    .single()
  if (error) throw error
  return data as Withdrawal
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
  const { data, error } = await supabase!
    .from('arbitrations')
    .insert(arb)
    .select()
    .single()
  if (error) throw error
  return data as Arbitration
}

export async function updateArbitration(id: string, updates: Partial<Arbitration>): Promise<Arbitration> {
  const { data, error } = await supabase!
    .from('arbitrations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Arbitration
}

// ─── 平台配置 ───────────────────────────────────────────────────

export async function fetchPlatformConfig(): Promise<PlatformConfig> {
  const { data } = await supabase!
    .from('platform_config')
    .select('*')
    .single()
  if (!data) return { commission_rate: 0.10, top_price: { d1: 2, d3: 5, d7: 10 }, announce: '' }
  return {
    commission_rate: data.commission_rate,
    top_price: { d1: data.top_price_d1, d3: data.top_price_d3, d7: data.top_price_d7 },
    announce: data.announce
  } as PlatformConfig
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

export async function adminApproveWithdrawal(wdId: string, userId: string, amount: number) {
  // 1. 扣余额
  await supabase!.rpc('decrement_balance', { user_id: userId, amount })
  // 2. 更新提现状态
  await supabase!
    .from('withdrawals')
    .update({ status: 'approved', handled_at: new Date().toISOString() })
    .eq('id', wdId)
}

export async function adminRejectWithdrawal(wdId: string, reason: string) {
  await supabase!
    .from('withdrawals')
    .update({ status: 'rejected', reason, handled_at: new Date().toISOString() })
    .eq('id', wdId)
}

// ─── 业务闭环（带事务性保障） ───────────────────────────────────

// 发布任务：冻结余额 + 创建任务 + 记流水
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
  const me = await getCurrentUser()
  const available = me.balance - me.frozen
  if (available < input.amount) {
    throw new Error(`可用余额不足，无法冻结 ¥${input.amount}`)
  }

  // 原子操作：用 supabase RPC 或顺序调用（真实事务需要 DB 函数）
  // 这里顺序调用，失败时抛出（简单版，真实事务用 Edge Function 更好）
  const task = await createTask({
    ...input,
    status: 'open',
    accepted_id: null,
    accepted_name: null,
    top_until: null
  } as Partial<Task>)

  await addTxn({
    user_id: input.poster_id,
    type: 'freeze',
    amount: -input.amount,
    balance_after: me.balance,  // 不变
    remark: `发布任务冻结（${input.title}）`
  })

  // 更新冻结金额
  await supabase!
    .from('profiles')
    .update({ frozen: me.frozen + input.amount })
    .eq('id', input.poster_id)

  return task
}

// 接单
export async function takeTask(taskId: string) {
  const me = await getCurrentUser()
  const { data: task } = await supabase!
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single()
  if (!task || task.status !== 'open') throw new Error('任务不可接')

  await updateTask(taskId, {
    status: 'accepted',
    accepted_id: me.id,
    accepted_name: me.nickname
  })

  // 通知雇主
  await createNotification({
    user_id: task.poster_id,
    type: 'task_taken',
    title: '有人接单',
    content: `${me.nickname} 已接下「${task.title}」`
  })
}

// 验收通过：结算
export async function reviewPass(taskId: string) {
  const { data: task } = await supabase!
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single()
  if (!task) throw new Error('任务不存在')

  const config = await fetchPlatformConfig()
  const commission = task.amount * config.commission_rate
  const net = task.amount - commission

  // 解冻雇主余额
  const { data: employer } = await supabase!
    .from('profiles')
    .select('*')
    .eq('id', task.poster_id)
    .single()
  await supabase!
    .from('profiles')
    .update({ frozen: employer.frozen - task.amount })
    .eq('id', task.poster_id)

  // 给接单者加余额
  await supabase!.rpc('increment_balance', { user_id: task.accepted_id, amount: net })
  await addTxn({
    user_id: task.accepted_id!,
    type: 'income',
    amount: net,
    balance_after: 0, // 前端会重新拉取
    remark: `任务完成收入（${task.title}，平台抽佣 ¥${commission}）`
  })

  // 更新任务状态
  await updateTask(taskId, { status: 'done' })

  // 通知双方
  await createNotification({
    user_id: task.accepted_id!,
    type: 'task_status',
    title: '任务已完成',
    content: `「${task.title}」已结算，收入 ¥${net}`
  })
}
