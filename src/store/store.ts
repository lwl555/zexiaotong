import { create } from 'zustand'
import type {
  Profile, Task, Goods, Post, Message, WalletTxn, Withdrawal,
  Arbitration, Notification, Category, Banner, PlatformConfig,
  TaskStatus, GoodsStatus, PostStatus
} from '../lib/types'
import * as db from '../lib/db'

const now = () => new Date().toISOString()
const round = (n: number) => Math.round(n * 100) / 100

interface State {
  // 加载状态
  loading: boolean
  error: string

  // 当前用户
  me: Profile | null

  // 数据
  users: Profile[]
  tasks: Task[]
  goods: Goods[]
  posts: Post[]
  messages: Message[]
  txns: WalletTxn[]
  withdrawals: Withdrawal[]
  arbitrations: Arbitration[]
  notifications: Notification[]
  categories: Category[]
  banners: Banner[]
  config: PlatformConfig | null

  // 初始化
  init: () => Promise<void>

  // 用户
  login: (phone?: string) => Promise<void>
  logout: () => void
  switchRole: () => void
  getUser: (id: string) => Profile | undefined
  // 紧急兜底：网络长时间卡住时，用户手动把 me 切成本地游客，避免「加载中...」无限转
  setMeFallback: () => void

  // 任务
  publishTask: (input: { title: string; category: any; amount: number; deadline: string; description: string; images: string[] }) => Promise<{ ok: boolean; msg: string }>
  takeTask: (taskId: string) => Promise<void>
  deliverTask: (taskId: string, text: string) => Promise<void>
  reviewPass: (taskId: string) => Promise<void>
  reviewReject: (taskId: string) => Promise<void>
  applyArbitration: (taskId: string, reason: string) => Promise<void>
  adminDecide: (arbId: string, winner: 'plaintiff' | 'defendant' | 'split', result: string) => Promise<void>

  // 钱包
  recharge: (amount: number) => Promise<void>
  withdraw: (amount: number) => Promise<{ ok: boolean; msg: string }>

  // 二手 / 社区
  publishGoods: (input: any) => Promise<void>
  publishPost: (input: any) => Promise<void>
  likePost: (id: string) => Promise<void>
  collectPost: (id: string) => Promise<void>

  // 私信 / 通知
  sendMessage: (toId: string, content: string) => Promise<void>
  markRead: (id: string) => Promise<void>

  // 后台
  banUser: (id: string) => Promise<void>
  unbanUser: (id: string) => Promise<void>
  removeTask: (id: string) => Promise<void>
  removeGoods: (id: string) => Promise<void>
  removePost: (id: string) => Promise<void>
  setTaskStatus: (id: string, status: TaskStatus) => Promise<void>
  setGoodsStatus: (id: string, status: GoodsStatus) => Promise<void>
  setPostStatus: (id: string, status: PostStatus) => Promise<void>
  topTask: (id: string, days: 1 | 3 | 7) => Promise<{ ok: boolean; msg: string }>
  approveWithdrawal: (id: string) => Promise<void>
  rejectWithdrawal: (id: string, reason: string) => Promise<void>
  setConfig: (c: PlatformConfig) => Promise<void>
}

export const useStore = create<State>((set, get) => ({
  loading: false,
  error: '',
  me: null,
  users: [],
  tasks: [],
  goods: [],
  posts: [],
  messages: [],
  txns: [],
  withdrawals: [],
  arbitrations: [],
  notifications: [],
  categories: [],
  banners: [],
  config: null,

  // ─── 初始化：从 Supabase 拉取所有数据 ───
  init: async () => {
    if (get().loading) return // 已经在拉，避免重复触发（HMR / StrictMode 双调）
    set({ loading: true, error: '' })

    // 总兜底：即便 supabase 全部卡死，12 秒后也强制进入 App（用本地游客兜底）
    // 这样 MobileLayout 的「加载中...」最多转 12 秒，不会无限卡死。
    const hardStop = setTimeout(() => {
      const s = get()
      if (s.loading) {
        const guestId = (typeof localStorage !== 'undefined' && (localStorage.getItem('zex:user_id') || 'guest')) || 'guest'
        const fallback: any = {
          id: guestId, phone: '', nickname: '游客' + String(guestId).slice(-4),
          avatar: '', role: 'user', balance: 0, frozen: 0, status: 'active',
          created_at: new Date().toISOString()
        }
        set({
          me: s.me || fallback,
          loading: false,
          error: s.error || '网络较慢，已进入访客模式（部分功能可能暂不可用）'
        })
      }
    }, 12000)

    try {
      // 先拿用户（getCurrentUser 自身已带 6 秒超时 + 失败回退本地，不会死锁）
      const me = await db.getCurrentUser()
      set({ me })

      // 数据列表也限时：最多 9 秒。拉不到就保留空数组，让 UI 至少能进
      const fetchAll = Promise.all([
        db.fetchTasks(),
        db.fetchGoods(),
        db.fetchPosts(),
        db.fetchTxns(me.id),
        db.fetchWithdrawals(me.id),
        db.fetchArbitrations(me.id),
        db.fetchNotifications(me.id),
        db.fetchCategories(),
        db.fetchBanners(),
        db.fetchPlatformConfig()
      ])
      let bundle: any = null
      try {
        bundle = await Promise.race([
          fetchAll,
          new Promise((_, rej) => setTimeout(() => rej(new Error('fetchData timeout')), 9000))
        ])
      } catch {
        bundle = null
      }
      const [tasks, goods, posts, txns, withdrawals, arbitrations, notifications, categories, banners, config] =
        bundle || Array(10).fill([])
      set({ tasks, goods, posts, txns, withdrawals, arbitrations, notifications, categories, banners, config, loading: false })
    } catch (e: any) {
      set({ error: e?.message || '加载失败', loading: false })
    } finally {
      clearTimeout(hardStop)
    }
  },

  // ─── 用户 ───
  login: async (phone) => {
    const me = await db.getCurrentUser()
    set({ me })
  },

  logout: () => {
    db.logoutUser()
    set({ me: null })
  },

  // 网络长时间卡住 / Supabase 故障时，让用户手动跳出"加载中..."
  setMeFallback: () => {
    const s = get()
    if (s.me) return
    let id = ''
    try { id = localStorage.getItem('zex:user_id') || '' } catch {}
    if (!id) id = `guest-${Date.now().toString(36)}`
    const fallback: any = {
      id, phone: '', nickname: '游客' + id.slice(-4),
      avatar: '', role: 'user', balance: 0, frozen: 0, status: 'active',
      created_at: new Date().toISOString()
    }
    set({ me: fallback, loading: false, error: '已进入访客模式（部分功能可能暂不可用）' })
  },

  switchRole: () => {
    const me = get().me
    if (me) {
      set({ me: { ...me, role: me.role === 'admin' ? 'user' : 'admin' } })
    }
  },

  getUser: (id) => get().users.find(u => u.id === id),

  // ─── 任务 ───
  publishTask: async (input) => {
    const me = get().me
    if (!me) return { ok: false, msg: '请先登录' }
    try {
      await db.publishTask({
        ...input,
        poster_id: me.id,
        poster_name: me.nickname,
        poster_avatar: me.avatar
      })
      const tasks = await db.fetchTasks()
      set({ tasks })
      return { ok: true, msg: '发布成功，金额已冻结' }
    } catch (e: any) {
      return { ok: false, msg: e?.message || '发布失败' }
    }
  },

  takeTask: async (taskId) => {
    await db.takeTask(taskId)
    const tasks = await db.fetchTasks()
    const notifs = await db.fetchNotifications(get().me?.id || '')
    set({ tasks, notifications: notifs })
  },

  deliverTask: async (taskId, text) => {
    await db.updateTask(taskId, { status: 'review' })
    const tasks = await db.fetchTasks()
    set({ tasks })
  },

  reviewPass: async (taskId) => {
    await db.reviewPass(taskId)
    const tasks = await db.fetchTasks()
    const txns = await db.fetchTxns(get().me?.id || '')
    const notifs = await db.fetchNotifications(get().me?.id || '')
    set({ tasks, txns, notifications: notifs })
  },

  reviewReject: async (taskId) => {
    await db.updateTask(taskId, { status: 'doing' })
    const tasks = await db.fetchTasks()
    set({ tasks })
  },

  applyArbitration: async (taskId, reason) => {
    const me = get().me!
    const task = get().tasks.find(t => t.id === taskId)!
    await db.createArbitration({
      task_id: taskId,
      task_title: task.title,
      plaintiff_id: me.id,
      plaintiff_name: me.nickname,
      defendant_id: task.accepted_id,
      defendant_name: task.accepted_name,
      reason
    })
    await db.updateTask(taskId, { status: 'arbitration' })
    const [tasks, arbitrations] = await Promise.all([
      db.fetchTasks(),
      db.fetchArbitrations()
    ])
    set({ tasks, arbitrations })
  },

  adminDecide: async (arbId, winner, result) => {
    await db.updateArbitration(arbId, { status: 'closed', winner, result })
    const arbitrations = await db.fetchArbitrations()
    set({ arbitrations })
  },

  // ─── 钱包 ───
  recharge: async (amount) => {
    const me = get().me!
    await db.addTxn({
      user_id: me.id,
      type: 'recharge',
      amount,
      balance_after: me.balance + amount,
      remark: '账户充值'
    })
    // 更新余额
    const { data } = await db.supabase!
      .from('profiles')
      .update({ balance: me.balance + amount })
      .eq('id', me.id)
    const txns = await db.fetchTxns(me.id)
    set(s => ({ me: { ...me, balance: me.balance + amount }, txns }))
  },

  withdraw: async (amount) => {
    const me = get().me!
    if (me.balance < amount) return { ok: false, msg: '余额不足' }
    await db.createWithdrawal({
      user_id: me.id,
      user_name: me.nickname,
      amount,
      status: 'pending'
    })
    const withdrawals = await db.fetchWithdrawals(me.id)
    set({ withdrawals })
    return { ok: true, msg: '提现申请已提交，等待管理员审核' }
  },

  // ─── 二手 / 社区 ───
  publishGoods: async (input) => {
    const me = get().me!
    await db.createGoods({
      ...input,
      seller_id: me.id,
      seller_name: me.nickname
    })
    const goods = await db.fetchGoods()
    set({ goods })
  },

  publishPost: async (input) => {
    const me = get().me!
    await db.createPost({
      ...input,
      author_id: me.id,
      author_name: me.nickname,
      author_avatar: me.avatar
    })
    const posts = await db.fetchPosts()
    set({ posts })
  },

  likePost: async (id) => {
    const post = get().posts.find(p => p.id === id)
    if (!post) return
    const newLiked = !post.liked
    const newLikes = post.likes + (newLiked ? 1 : -1)
    await db.updatePost(id, { liked: newLiked, likes: newLikes })
    set(s => ({ posts: s.posts.map(p => p.id === id ? { ...p, liked: newLiked, likes: newLikes } : p) }))
  },

  collectPost: async (id) => {
    const post = get().posts.find(p => p.id === id)
    if (!post) return
    const newCollected = !post.collected
    const newCollects = post.collects + (newCollected ? 1 : -1)
    await db.updatePost(id, { collected: newCollected, collects: newCollects })
    set(s => ({ posts: s.posts.map(p => p.id === id ? { ...p, collected: newCollected, collects: newCollects } : p) }))
  },

  // ─── 私信 / 通知 ───
  sendMessage: async (toId, content) => {
    const me = get().me!
    const conv = [me.id, toId].sort().join('_')
    await db.sendMessage({
      conv_id: conv,
      sender_id: me.id,
      receiver_id: toId,
      content,
      type: 'text'
    })
    await db.createNotification({
      user_id: toId,
      type: 'message',
      title: '新私信',
      content: `${me.nickname}：${content}`
    })
  },

  markRead: async (id) => {
    await db.markRead(id)
    set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) }))
  },

  // ─── 后台 ───
  banUser: async (id) => {
    await db.supabase!.from('profiles').update({ status: 'banned' }).eq('id', id)
    set(s => ({ users: s.users.map(u => u.id === id ? { ...u, status: 'banned' as const } : u) }))
  },

  unbanUser: async (id) => {
    await db.supabase!.from('profiles').update({ status: 'active' }).eq('id', id)
    set(s => ({ users: s.users.map(u => u.id === id ? { ...u, status: 'active' as const } : u) }))
  },

  removeTask: async (id) => {
    await db.updateTask(id, { status: 'closed' })
    const tasks = await db.fetchTasks()
    set({ tasks })
  },

  removeGoods: async (id) => {
    await db.supabase!.from('goods').update({ status: 'removed' }).eq('id', id)
    const goods = await db.fetchGoods()
    set({ goods })
  },

  removePost: async (id) => {
    await db.updatePost(id, { status: 'removed' })
    const posts = await db.fetchPosts()
    set({ posts })
  },

  setTaskStatus: async (id, status) => {
    await db.updateTask(id, { status })
    const tasks = await db.fetchTasks()
    set({ tasks })
  },

  setGoodsStatus: async (id, status) => {
    await db.supabase!.from('goods').update({ status }).eq('id', id)
    const goods = await db.fetchGoods()
    set({ goods })
  },

  setPostStatus: async (id, status) => {
    await db.updatePost(id, { status })
    const posts = await db.fetchPosts()
    set({ posts })
  },

  topTask: async (id, days) => {
    const me = get().me!
    const config = get().config
    if (!config) return { ok: false, msg: '配置未加载' }
    const price = config.top_price['d' + days as 'd1' | 'd3' | 'd7']
    if (me.balance < price) return { ok: false, msg: `余额不足，需 ¥${price}` }
    const until = new Date(Date.now() + days * 86400000).toISOString()
    await db.updateTask(id, { top_until: until })
    await db.addTxn({
      user_id: me.id,
      type: 'pay',
      amount: -price,
      balance_after: me.balance - price,
      remark: `付费置顶 ${days} 天`
    })
    const [tasks, txns] = await Promise.all([db.fetchTasks(), db.fetchTxns(me.id)])
    set(s => ({ tasks, txns, me: { ...me, balance: me.balance - price } }))
    return { ok: true, msg: `已置顶 ${days} 天，扣费 ¥${price}` }
  },

  approveWithdrawal: async (id) => {
    const wd = get().withdrawals.find(w => w.id === id)!
    await db.adminApproveWithdrawal(id, wd.user_id, wd.amount)
    const withdrawals = await db.fetchWithdrawals(get().me?.id || '')
    set({ withdrawals })
  },

  rejectWithdrawal: async (id, reason) => {
    await db.adminRejectWithdrawal(id, reason)
    const withdrawals = await db.fetchWithdrawals(get().me?.id || '')
    set({ withdrawals })
  },

  setConfig: async (c) => {
    await db.supabase!.from('platform_config').update({
      commission_rate: c.commission_rate,
      top_price_d1: c.top_price.d1,
      top_price_d3: c.top_price.d3,
      top_price_d7: c.top_price.d7,
      announce: c.announce
    }).eq('id', 1)
    set({ config: c })
  }
}))
