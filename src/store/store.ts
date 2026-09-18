import { create } from 'zustand'
import type {
  Profile, Role, Task, Goods, Post, Message, WalletTxn, Withdrawal, RechargeOrder,
  Arbitration, Notification, Category, Banner, PlatformConfig,
  TaskStatus, GoodsStatus, PostStatus, School, Bulletin, ActivityLog, CheckIn
} from '../lib/types'
import * as db from '../lib/db'
import { notifyNative } from '../lib/nativeNotify'

const now = () => new Date().toISOString()
const round = (n: number) => Math.round(n * 100) / 100

// ─── 通知栏轮询（仅原生壳内生效，普通浏览器静默 no-op）───
let notifyTimer: ReturnType<typeof setInterval> | null = null
let notifySeen = new Set<string>()
let notifyMeId = ''
// 通知类型 → 点击后跳转路由（HashRouter 的 hash 路径）
const NOTIFY_ROUTE: Record<string, string> = {
  message: '/messages',
  task_status: '/my-tasks',
  task_taken: '/my-tasks',
  task_review: '/my-tasks',
  arbitration: '/my-tasks',
  comment: '/community',
  announce: '/notifications',
}

// 提现列表加载：管理员取全量、普通用户取本人（后端 list_withdrawals 按 scope 校验权限）。
// 拉取失败返回空数组而不是抛错——单张表读不到不该把整个 store 的加载一起搞崩。
const loadWithdrawals = async (me: Profile | null): Promise<Withdrawal[]> => {
  if (!me) return []
  try {
    return me.role === 'admin'
      ? await db.fetchAllWithdrawals(me.id)
      : await db.fetchMyWithdrawals(me.id)
  } catch {
    return []
  }
}

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
  schools: School[]
  bulletins: Bulletin[]
  logs: ActivityLog[]

  // 初始化
  init: () => Promise<void>

  // 通知栏轮询：后台到达的站内消息弹手机通知栏（覆盖全部通知类型）
  startNotifyPoller: () => void

  // 用户
  login: (qq?: string, role?: Role) => Promise<void>
  register: (qq: string, password: string) => Promise<void>
  loginPwd: (qq: string, password: string) => Promise<void>
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

  // 钱包（充值走「下单 → 收银台支付 → 入账」三步，订单 id 即幂等键）
  createRechargeOrder: (amountYuan: number) => Promise<RechargeOrder>
  confirmRecharge: (orderId: string) => Promise<{ ok: boolean; msg: string; points: number; duplicate: boolean }>
  withdraw: (input: {
    amount: number
    channel: string
    account: string
    accountName?: string
  }) => Promise<{ ok: boolean; msg: string }>
  /** 重新拉取提现列表（管理端审核后、用户提交后刷新用） */
  refreshWithdrawals: () => Promise<void>

  // 二手 / 社区
  publishGoods: (input: any) => Promise<void>
  publishPost: (input: any) => Promise<void>
  likePost: (id: string) => Promise<void>
  /** 重新拉取社区帖子列表（智能体发帖后刷新用） */
  refreshPosts: () => Promise<void>
  /** 触发社区智能体发帖，返回本次真实新增条数（服务端限频，0 表示被限频/失败） */
  inviteCommunityBots: (count?: number) => Promise<number>
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

  // 院校 / 小黑板
  fetchSchools: () => Promise<void>
  fetchBulletins: (opts?: { schoolId?: string | null }) => Promise<void>
  publishBulletin: (input: { content: string; schoolId: string | null; schoolName: string; isAll: boolean; images?: string[] }) => Promise<{ ok: boolean; msg: string }>
  addBulletinComment: (bulletinId: string, content: string) => Promise<void>

  // 后台：积分 / 公告 / 日志
  adminAddPoints: (targetUserId: string, points: number, reason: string) => Promise<void>
  adminSendAnnounce: (title: string, content: string) => Promise<void>
  fetchLogs: (opts?: { actor_type?: string; action?: string }) => Promise<void>

  // 个人资料（昵称 / 头像）
  updateProfile: (updates: { nickname?: string; avatar?: string }) => Promise<{ ok: boolean; msg: string }>

  // 签到
  checkin: { checkedToday: boolean; streak: number; nextStreak: number; nextPoints: number; recent: CheckIn[] }
  checkIn: () => Promise<{ points: number; streak: number; weekBonus: number } | null>
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
  schools: [],
  bulletins: [],
  logs: [],
  checkin: { checkedToday: false, streak: 0, nextStreak: 1, nextPoints: 10, recent: [] },

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
          id: guestId, qq: '', nickname: '游客' + String(guestId).slice(-4),
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
        // 提现取全量：管理端「提现审核」要看所有人的申请（原实现只取自己的，
        // 导致管理员打开审核页永远是空的）；用户端在 Wallet 里按 user_id 过滤。
        loadWithdrawals(me),
        db.fetchArbitrations(me.id),
        db.fetchNotifications(me.id),
        db.fetchCategories(),
        db.fetchBanners(),
        db.fetchPlatformConfig(),
        db.fetchSchools()
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
      const [tasks, goods, posts, txns, withdrawals, arbitrations, notifications, categories, banners, config, schools] =
        bundle || Array(11).fill([])
      set({ tasks, goods, posts, txns, withdrawals, arbitrations, notifications, categories, banners, config, schools, loading: false })
      // 启动通知栏轮询（App 后台时把新到达的站内消息弹到手机通知栏）
      get().startNotifyPoller()
    } catch (e: any) {
      set({ error: e?.message || '加载失败', loading: false })
    } finally {
      clearTimeout(hardStop)
    }
  },

  // ─── 通知栏轮询：每 15s 拉一次站内通知，新到达且未读的弹手机通知栏 ───
  startNotifyPoller: () => {
    const me = get().me
    if (me && notifyMeId !== me.id) {
      // 以当前账号已有通知为基准，避免把历史通知当新消息弹
      notifyMeId = me.id
      notifySeen = new Set(get().notifications.map(n => n.id))
    }
    if (notifyTimer) return
    notifyTimer = setInterval(async () => {
      const m = get().me
      if (!m) return
      if (notifyMeId !== m.id) {
        // 切换账号：重新以当前通知为基准
        notifyMeId = m.id
        notifySeen = new Set(get().notifications.map(n => n.id))
        return
      }
      let list: any[] = []
      try {
        list = await db.fetchNotifications(m.id)
      } catch {
        return
      }
      set({ notifications: list })
      const fresh = list.filter((n: any) => !notifySeen.has(n.id))
      // 仅在 App 切到后台时弹系统通知，避免前台刷屏；站内通知中心在前台已可见
      if (typeof document !== 'undefined' && document.hidden) {
        for (const n of fresh) {
          if (n.read) continue
          const route = NOTIFY_ROUTE[n.type] || '/notifications'
          notifyNative(n.title || '择校通', n.content || '', route)
        }
      }
      fresh.forEach((n: any) => notifySeen.add(n.id))
    }, 15000)
  },

  // ─── 用户 ───
  login: async (qq = '', role?: Role) => {
    const me = await db.loginUser(qq, role)
    set({ me })
  },

  register: async (qq, password) => {
    const me = await db.registerUser(qq, password)
    set({ me })
  },

  loginPwd: async (qq, password) => {
    const me = await db.loginUserWithPassword(qq, password)
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
      id, qq: '', nickname: '游客' + id.slice(-4),
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
      defendant_id: task.accepted_id ?? undefined,
      defendant_name: task.accepted_name ?? undefined,
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
  createRechargeOrder: async (amountYuan) => {
    const me = get().me!
    return await db.createRechargeOrder(me.id, amountYuan)
  },

  confirmRecharge: async (orderId) => {
    const me = get().me!
    try {
      const r = await db.confirmRecharge(me.id, orderId)
      const txns = await db.fetchTxns(me.id)
      set(s => ({ me: { ...(s.me as Profile), balance: r.balance }, txns }))
      return {
        ok: true,
        msg: r.duplicate ? '该订单已支付过，积分不会重复到账' : `支付成功，到账 ${r.points} 积分`,
        points: r.points,
        duplicate: r.duplicate
      }
    } catch (e: any) {
      return { ok: false, msg: e?.message || '支付失败，请重试', points: 0, duplicate: false }
    }
  },

  withdraw: async ({ amount, channel, account, accountName }) => {
    const me = get().me!
    const avail = Number(me.balance) - Number(me.frozen || 0)
    if (avail < amount) return { ok: false, msg: `可用积分不足（当前可用 ${avail} 积分）` }
    try {
      await db.submitWithdraw({
        userId: me.id,
        userName: me.nickname,
        amount,
        channel,
        account,
        accountName
      })
    } catch (e: any) {
      // 后端有明确规则（最低额 / 整数倍 / 可用不足 / 收款信息缺失），原话透传给用户
      return { ok: false, msg: e?.message || '提现申请提交失败' }
    }
    // 冻结在后端完成，这里刷新余额与提现列表保持一致
    const [withdrawals, profile] = await Promise.all([
      db.fetchMyWithdrawals(me.id),
      db.getCurrentUser().catch(() => null)
    ])
    set(s => ({
      withdrawals,
      me: profile
        ? { ...(s.me as Profile), balance: profile.balance, frozen: profile.frozen }
        : s.me
    }))
    return { ok: true, msg: '提现申请已提交，等待管理员审核' }
  },

  refreshWithdrawals: async () => {
    set({ withdrawals: await loadWithdrawals(get().me) })
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

  refreshPosts: async () => {
    const posts = await db.fetchPosts()
    set({ posts })
  },

  inviteCommunityBots: async (count = 1) => {
    const n = await db.triggerCommunityBots(count)
    if (n > 0) {
      const posts = await db.fetchPosts()
      set({ posts })
    }
    return n
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
    const me = get().me!
    await db.setProfileStatus(id, 'banned', me.id)
    set(s => ({ users: s.users.map(u => u.id === id ? { ...u, status: 'banned' as const } : u) }))
  },

  unbanUser: async (id) => {
    const me = get().me!
    await db.setProfileStatus(id, 'active', me.id)
    set(s => ({ users: s.users.map(u => u.id === id ? { ...u, status: 'active' as const } : u) }))
  },

  removeTask: async (id) => {
    const me = get().me!
    await db.setRecordStatus('tasks', id, 'closed', me.id)
    const tasks = await db.fetchTasks()
    set({ tasks })
  },

  removeGoods: async (id) => {
    const me = get().me!
    await db.setRecordStatus('goods', id, 'removed', me.id)
    const goods = await db.fetchGoods()
    set({ goods })
  },

  removePost: async (id) => {
    const me = get().me!
    await db.setRecordStatus('posts', id, 'removed', me.id)
    const posts = await db.fetchPosts()
    set({ posts })
  },

  setTaskStatus: async (id, status) => {
    const me = get().me!
    await db.setRecordStatus('tasks', id, status, me.id)
    const tasks = await db.fetchTasks()
    set({ tasks })
  },

  setGoodsStatus: async (id, status) => {
    const me = get().me!
    await db.setRecordStatus('goods', id, status, me.id)
    const goods = await db.fetchGoods()
    set({ goods })
  },

  setPostStatus: async (id, status) => {
    const me = get().me!
    await db.setRecordStatus('posts', id, status, me.id)
    const posts = await db.fetchPosts()
    set({ posts })
  },

  topTask: async (id, days) => {
    const me = get().me!
    const config = get().config
    if (!config) return { ok: false, msg: '配置未加载' }
    const price = config.top_price['d' + days as 'd1' | 'd3' | 'd7']
    if (me.balance < price) return { ok: false, msg: `积分不足，需 ${price} 积分` }
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
    return { ok: true, msg: `已置顶 ${days} 天，扣费 ${price} 积分` }
  },

  approveWithdrawal: async (id) => {
    const me = get().me!
    // 金额与收款人由后端按 wdId 反查并二次校验（仍 pending + 余额充足），前端只传单号
    await db.adminApproveWithdrawal(id, me.id)
    set({ withdrawals: await loadWithdrawals(get().me) })
  },

  rejectWithdrawal: async (id, reason) => {
    const me = get().me!
    await db.adminRejectWithdrawal(id, reason, me.id)
    set({ withdrawals: await loadWithdrawals(get().me) })
  },

  setConfig: async (c) => {
    const me = get().me!
    await db.setConfig(c, me.id)
    set({ config: c })
  },

  // ─── 院校 / 小黑板 ───
  fetchSchools: async () => {
    try {
      const schools = await db.fetchSchools()
      set({ schools })
    } catch { /* 院校列表非关键，失败静默 */ }
  },

  fetchBulletins: async (opts) => {
    try {
      const bulletins = await db.fetchBulletins(opts)
      set({ bulletins })
    } catch { /* 失败保留旧数据 */ }
  },

  publishBulletin: async (input) => {
    const me = get().me
    if (!me) return { ok: false, msg: '请先登录' }
    if (!input.content.trim()) return { ok: false, msg: '内容不能为空' }
    try {
      await db.createBulletin({
        school_id: input.isAll ? null : input.schoolId,
        school_name: input.isAll ? '全部院校' : input.schoolName,
        author_id: me.id,
        author_name: me.nickname,
        author_avatar: me.avatar,
        content: input.content.trim(),
        images: input.images || [],
        is_all_schools: input.isAll
      })
      const bulletins = await db.fetchBulletins()
      set({ bulletins })
      return { ok: true, msg: '已发布到小黑板' }
    } catch (e: any) {
      return { ok: false, msg: e?.message || '发布失败' }
    }
  },

  addBulletinComment: async (bulletinId, content) => {
    const me = get().me!
    await db.addBulletinComment({
      target_id: bulletinId,
      author_id: me.id,
      author_name: me.nickname,
      author_avatar: me.avatar,
      content
    })
    const bulletins = await db.fetchBulletins()
    set({ bulletins })
  },

  // ─── 后台：积分 / 公告 / 日志 ───
  adminAddPoints: async (targetUserId, points, reason) => {
    const me = get().me!
    await db.adminAddPoints(targetUserId, points, reason, me.id)
  },

  adminSendAnnounce: async (title, content) => {
    const me = get().me!
    await db.adminSendAnnounce(title, content, me.id)
  },

  fetchLogs: async (opts) => {
    const me = get().me
    if (!me) return
    try {
      const logs = await db.fetchActivityLogs({ ...opts, operatorId: me.id })
      set({ logs })
    } catch { /* 失败保留旧数据 */ }
  },

  // ─── 个人资料（昵称 / 头像）───
  // 走 db-write 通用 update 动作（profiles 已在白名单，后端校验只能改自己）。
  // 成功后同步刷新本地 me，避免各页面仍显示旧昵称/头像。
  updateProfile: async (updates) => {
    const me = get().me
    if (!me) return { ok: false, msg: '未登录' }
    try {
      const row = await db.updateProfile(me.id, updates)
      set({ me: { ...me, ...(row || {}), ...updates } as any })
      return { ok: true, msg: '已保存' }
    } catch (e: any) {
      return { ok: false, msg: e?.message || '保存失败' }
    }
  },

  // ─── 签到 ───
  checkIn: async () => {
    const me = get().me
    if (!me) return null
    const r = await db.checkIn(me.id)
    if (r?.error) throw new Error(r.error)
    if (r?.already) {
      // 已签过：只刷新状态，不重复发积分
      const status = await db.fetchCheckinStatus(me.id)
      set({ checkin: status })
      return { points: Number(r.points) || 0, streak: Number(r.streak) || 0, weekBonus: 0 }
    }
    const status = await db.fetchCheckinStatus(me.id)
    const txns = await db.fetchTxns(me.id)
    const newBal = typeof r?.balance === 'number' ? r.balance : me.balance
    set(s => ({ me: { ...(s.me as any), balance: newBal }, txns, checkin: status }))
    return { points: Number(r?.points) || 0, streak: Number(r?.streak) || 0, weekBonus: Number(r?.weekBonus) || 0 }
  }
}))
