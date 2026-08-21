// Supabase 数据操作层
// 封装所有数据库查询/变更，store.ts 不再直接持有 Mock 数据
//
// 设计：
// - 不强制登录（游客模式也能用）
// - 用户 id 存在 localStorage，启动时自动匿名注册
// - 后续可升级为真实 Supabase Auth

import { supabase, type SupabaseClient } from './supabase'
import type {
  Profile, Task, Goods, Post, Message, WalletTxn, Withdrawal,
  Arbitration, Notification, Category, Banner, PlatformConfig,
  TaskStatus, GoodsStatus, PostStatus
} from './types'

export { supabase }
export type { SupabaseClient }


const STORAGE_KEY = 'zex:user_id'

function ensureUserId(): string {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    // 匿名游客：生成随机 id，写入 profiles
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

export async function getCurrentUser(): Promise<Profile> {
  const id = ensureUserId()
  const { data, error } = await supabase!
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    // 不存在则自动注册
    const newUser: Partial<Profile> = {
      id,
      phone: '',
      nickname: '游客' + id.slice(-4),
      avatar: '',
      role: 'user',
      balance: 0,
      frozen: 0,
      status: 'active'
    }
    const { data: created } = await supabase!
      .from('profiles')
      .insert(newUser)
      .select()
      .single()
    return created as Profile
  }
  return data as Profile
}

export function logoutUser() {
  localStorage.removeItem(STORAGE_KEY)
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
  })

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
  const me = await getCurrentUser()
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
