import { create } from 'zustand'
import type {
  Profile, Task, Goods, Post, Message, WalletTxn, Withdrawal,
  Arbitration, Notification, Category, Banner, PlatformConfig,
  TaskStatus, GoodsStatus, PostStatus
} from '../lib/types'
import * as M from '../lib/mockData'

let seq = 1000
const nid = (p: string) => p + ++seq
const now = () => new Date().toISOString()
const round = (n: number) => Math.round(n * 100) / 100

interface State {
  session: { userId: string; isAdmin: boolean }
  users: Profile[]
  tasks: Task[]
  applications: any[]
  orders: any[]
  goods: Goods[]
  posts: Post[]
  messages: Message[]
  txns: WalletTxn[]
  withdrawals: Withdrawal[]
  arbitrations: Arbitration[]
  notifications: Notification[]
  categories: Category[]
  banners: Banner[]
  config: PlatformConfig

  // ===== 认证 / 身份 =====
  login: (phone?: string) => void
  logout: () => void
  switchRole: () => void
  getUser: (id: string) => Profile | undefined

  // ===== 任务核心闭环 =====
  publishTask: (input: { title: string; category: any; amount: number; deadline: string; description: string; images: string[] }) => { ok: boolean; msg: string }
  takeTask: (taskId: string) => void
  deliverTask: (taskId: string, text: string) => void
  reviewPass: (taskId: string) => void
  reviewReject: (taskId: string) => void
  applyArbitration: (taskId: string, reason: string) => void
  adminDecide: (arbId: string, winner: 'plaintiff' | 'defendant' | 'split', result: string) => void

  // ===== 钱包 =====
  recharge: (amount: number) => void
  withdraw: (amount: number) => { ok: boolean; msg: string }

  // ===== 二手 / 社区 =====
  publishGoods: (input: any) => void
  publishPost: (input: any) => void
  likePost: (id: string) => void
  collectPost: (id: string) => void

  // ===== 私信 / 通知 =====
  sendMessage: (toId: string, content: string) => void
  markRead: (id: string) => void

  // ===== 后台管理 =====
  banUser: (id: string) => void
  unbanUser: (id: string) => void
  removeTask: (id: string) => void
  removeGoods: (id: string) => void
  removePost: (id: string) => void
  setTaskStatus: (id: string, status: TaskStatus) => void
  setGoodsStatus: (id: string, status: GoodsStatus) => void
  setPostStatus: (id: string, status: PostStatus) => void
  topTask: (id: string, days: 1 | 3 | 7) => { ok: boolean; msg: string }
  approveWithdrawal: (id: string) => void
  rejectWithdrawal: (id: string, reason: string) => void
  setConfig: (c: PlatformConfig) => void
}

export const useStore = create<State>((set, get) => ({
  session: { userId: 'u_me', isAdmin: false },
  users: M.USERS,
  tasks: M.TASKS,
  applications: M.APPLICATIONS,
  orders: M.ORDERS,
  goods: M.GOODS,
  posts: M.POSTS,
  messages: M.MESSAGES,
  txns: M.TXNS,
  withdrawals: M.WITHDRAWALS,
  arbitrations: M.ARBITRATIONS,
  notifications: M.NOTIFICATIONS,
  categories: M.CATEGORIES,
  banners: M.BANNERS,
  config: M.PLATFORM_CONFIG,

  login: (phone) => set({ session: { userId: 'u_me', isAdmin: false } }),
  logout: () => set({ session: { userId: 'u_me', isAdmin: false } }),
  switchRole: () => set(s => {
    const toAdmin = !s.session.isAdmin
    return { session: { userId: toAdmin ? 'u_admin' : 'u_me', isAdmin: toAdmin } }
  }),
  getUser: (id) => get().users.find(u => u.id === id),

  // ---------- 任务 ----------
  publishTask: (input) => {
    const me = get().users.find(u => u.id === get().session.userId)!
    if (me.balance - me.frozen < input.amount)
      return { ok: false, msg: '可用余额不足，无法冻结发布金额（需 ¥' + input.amount + '）' }
    const users = get().users.map(u => u.id === me.id ? { ...u, frozen: round(u.frozen + input.amount) } : u)
    const task: Task = {
      id: nid('t'), title: input.title, category: input.category, amount: input.amount,
      deadline: input.deadline, description: input.description, images: input.images,
      poster_id: me.id, poster_name: me.nickname, poster_avatar: me.avatar,
      status: 'open', accepted_by: null, accepted_name: null, top_until: null, created_at: now()
    }
    const txn: WalletTxn = { id: nid('w'), user_id: me.id, type: 'freeze', amount: -input.amount, balance_after: me.balance, remark: '发布任务冻结（' + input.title + '）', created_at: now() }
    set(s => ({ users, tasks: [task, ...s.tasks], txns: [txn, ...s.txns] }))
    return { ok: true, msg: '发布成功，金额已冻结' }
  },

  takeTask: (taskId) => {
    const me = get().users.find(u => u.id === get().session.userId)!
    const tasks = get().tasks.map(t => t.id === taskId && t.status === 'open'
      ? { ...t, status: 'accepted' as const, accepted_by: me.id, accepted_name: me.nickname } : t)
    const task = get().tasks.find(t => t.id === taskId)!
    const noti: Notification = { id: nid('n'), user_id: task.poster_id, type: 'task_taken', title: '有人接单', content: me.nickname + ' 已接下「' + task.title + '」，等待其交付', read: false, created_at: now() }
    set(s => ({ tasks, notifications: [noti, ...s.notifications] }))
  },

  deliverTask: (taskId, text) => {
    const tasks = get().tasks.map(t => t.id === taskId && (t.status === 'accepted' || t.status === 'doing')
      ? { ...t, status: 'review' as const } : t)
    const task = get().tasks.find(t => t.id === taskId)!
    const noti: Notification = { id: nid('n'), user_id: task.poster_id, type: 'task_review', title: '任务待验收', content: task.accepted_name + ' 已交付成果，请验收「' + task.title + '」', read: false, created_at: now() }
    set(s => ({ tasks, notifications: [noti, ...s.notifications] }))
  },

  reviewPass: (taskId) => {
    const me = get().users.find(u => u.id === get().session.userId)!
    const task = get().tasks.find(t => t.id === taskId)!
    const employer = get().users.find(u => u.id === task.poster_id)!
    const worker = get().users.find(u => u.id === task.accepted_by!)!
    const rate = get().config.commission_rate
    const comm = round(task.amount * rate)
    const net = round(task.amount - comm)
    const users = get().users.map(u => {
      if (u.id === employer.id) return { ...u, frozen: round(u.frozen - task.amount) }
      if (u.id === worker.id) return { ...u, balance: round(u.balance + net) }
      return u
    })
    const order = { id: nid('o'), task_id: task.id, task_title: task.title, employer_id: employer.id, worker_id: worker.id, amount: task.amount, commission: comm, status: 'done', created_at: task.created_at, finished_at: now() }
    const txnW: WalletTxn = { id: nid('w'), user_id: worker.id, type: 'income', amount: net, balance_after: round(worker.balance + net), remark: '任务完成收入（' + task.title + '，平台抽佣 ¥' + comm + '）', created_at: now() }
    const txnE: WalletTxn = { id: nid('w'), user_id: employer.id, type: 'unfreeze', amount: task.amount, balance_after: employer.balance, remark: '任务完成解冻（' + task.title + '）', created_at: now() }
    const tasks = get().tasks.map(t => t.id === taskId ? { ...t, status: 'done' as const } : t)
    const n1: Notification = { id: nid('n'), user_id: worker.id, type: 'task_status', title: '任务已完成', content: '「' + task.title + '」已结算，收入 ¥' + net, read: false, created_at: now() }
    const n2: Notification = { id: nid('n'), user_id: employer.id, type: 'task_status', title: '任务已完成', content: '「' + task.title + '」已结算，平台抽佣 ¥' + comm, read: false, created_at: now() }
    set(s => ({ users, tasks, orders: [order, ...s.orders], txns: [txnW, txnE, ...s.txns], notifications: [n1, n2, ...s.notifications] }))
  },

  reviewReject: (taskId) => {
    const tasks = get().tasks.map(t => t.id === taskId && t.status === 'review' ? { ...t, status: 'doing' as const } : t)
    const task = get().tasks.find(t => t.id === taskId)!
    const noti: Notification = { id: nid('n'), user_id: task.accepted_by!, type: 'task_status', title: '交付被驳回', content: '「' + task.title + '」验收未通过，请重新交付或申请仲裁', read: false, created_at: now() }
    set(s => ({ tasks, notifications: [noti, ...s.notifications] }))
  },

  applyArbitration: (taskId, reason) => {
    const task = get().tasks.find(t => t.id === taskId)!
    const employer = get().users.find(u => u.id === task.poster_id)!
    const worker = get().users.find(u => u.id === task.accepted_by!)!
    const arb: Arbitration = { id: nid('arb'), task_id: task.id, task_title: task.title, order_id: '', plaintiff_id: employer.id, plaintiff_name: employer.nickname, defendant_id: worker.id, defendant_name: worker.nickname, reason, evidence: '', result: '', winner: null, status: 'open', created_at: now() }
    const tasks = get().tasks.map(t => t.id === taskId ? { ...t, status: 'arbitration' as const } : t)
    const n1: Notification = { id: nid('n'), user_id: worker.id, type: 'arbitration', title: '已发起仲裁', content: '雇主对「' + task.title + '」提起仲裁，等待管理员判定', read: false, created_at: now() }
    const n2: Notification = { id: nid('n'), user_id: 'u_admin', type: 'arbitration', title: '新仲裁待处理', content: '「' + task.title + '」进入仲裁，请尽快判定', read: false, created_at: now() }
    set(s => ({ arbitrations: [arb, ...s.arbitrations], tasks, notifications: [n1, n2, ...s.notifications] }))
  },

  adminDecide: (arbId, winner, result) => {
    const arb = get().arbitrations.find(a => a.id === arbId)!
    const task = get().tasks.find(t => t.id === arb.task_id)!
    const employer = get().users.find(u => u.id === task.poster_id)!
    const worker = get().users.find(u => u.id === task.accepted_by!)!
    const rate = get().config.commission_rate
    let users = get().users
    if (winner === 'defendant') {
      const comm = round(task.amount * rate); const net = round(task.amount - comm)
      users = get().users.map(u => {
        if (u.id === employer.id) return { ...u, frozen: round(u.frozen - task.amount) }
        if (u.id === worker.id) return { ...u, balance: round(u.balance + net) }
        return u
      })
    } else if (winner === 'plaintiff') {
      users = get().users.map(u => u.id === employer.id ? { ...u, frozen: round(u.frozen - task.amount) } : u)
    } else {
      const half = round(task.amount / 2)
      users = get().users.map(u => {
        if (u.id === employer.id) return { ...u, frozen: round(u.frozen - task.amount) }
        if (u.id === worker.id) return { ...u, balance: round(u.balance + half) }
        return u
      })
    }
    const tasks = get().tasks.map(t => t.id === task.id ? { ...t, status: (winner === 'plaintiff' ? 'closed' : 'done') as const } : t)
    const arbs = get().arbitrations.map(a => a.id === arbId ? { ...a, status: 'closed' as const, result, winner } : a)
    const n1: Notification = { id: nid('n'), user_id: worker.id, type: 'arbitration', title: '仲裁结果', content: '「' + task.title + '」仲裁：' + result, read: false, created_at: now() }
    const n2: Notification = { id: nid('n'), user_id: employer.id, type: 'arbitration', title: '仲裁结果', content: '「' + task.title + '」仲裁：' + result, read: false, created_at: now() }
    set(s => ({ users, tasks, arbitrations: arbs, notifications: [n1, n2, ...s.notifications] }))
  },

  // ---------- 钱包 ----------
  recharge: (amount) => {
    const me = get().users.find(u => u.id === get().session.userId)!
    const users = get().users.map(u => u.id === me.id ? { ...u, balance: round(u.balance + amount) } : u)
    const txn: WalletTxn = { id: nid('w'), user_id: me.id, type: 'recharge', amount, balance_after: round(me.balance + amount), remark: '账户充值', created_at: now() }
    set(s => ({ users, txns: [txn, ...s.txns] }))
  },

  withdraw: (amount) => {
    const me = get().users.find(u => u.id === get().session.userId)!
    if (me.balance < amount) return { ok: false, msg: '余额不足' }
    const wd: Withdrawal = { id: nid('wd'), user_id: me.id, user_name: me.nickname, amount, status: 'pending', reason: '', created_at: now(), handled_at: null }
    set(s => ({ withdrawals: [wd, ...s.withdrawals] }))
    return { ok: true, msg: '提现申请已提交，等待管理员审核打款' }
  },

  // ---------- 二手 / 社区 ----------
  publishGoods: (input) => {
    const me = get().users.find(u => u.id === get().session.userId)!
    const g: Goods = { id: nid('g'), title: input.title, price: input.price, category: input.category, description: input.description, images: input.images, seller_id: me.id, seller_name: me.nickname, status: 'on', created_at: now() }
    set(s => ({ goods: [g, ...s.goods] }))
  },
  publishPost: (input) => {
    const me = get().users.find(u => u.id === get().session.userId)!
    const p: Post = { id: nid('p'), title: input.title, content: input.content, images: input.images, author_id: me.id, author_name: me.nickname, author_avatar: me.avatar, likes: 0, collects: 0, comments: 0, liked: false, collected: false, status: 'on', created_at: now() }
    set(s => ({ posts: [p, ...s.posts] }))
  },
  likePost: (id) => set(s => ({ posts: s.posts.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p) })),
  collectPost: (id) => set(s => ({ posts: s.posts.map(p => p.id === id ? { ...p, collected: !p.collected, collects: p.collects + (p.collected ? -1 : 1) } : p) })),

  // ---------- 私信 / 通知 ----------
  sendMessage: (toId, content) => {
    const me = get().users.find(u => u.id === get().session.userId)!
    const conv = [me.id, toId].sort().join('_')
    const msg: Message = { id: nid('m'), conv_id: conv, sender_id: me.id, receiver_id: toId, content, type: 'text', read: false, created_at: now() }
    const noti: Notification = { id: nid('n'), user_id: toId, type: 'message', title: '新私信', content: me.nickname + '：' + content, read: false, created_at: now() }
    set(s => ({ messages: [...s.messages, msg], notifications: [noti, ...s.notifications] }))
  },
  markRead: (id) => set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) })),

  // ---------- 后台 ----------
  banUser: (id) => set(s => ({ users: s.users.map(u => u.id === id ? { ...u, status: 'banned' as const } : u) })),
  unbanUser: (id) => set(s => ({ users: s.users.map(u => u.id === id ? { ...u, status: 'active' as const } : u) })),
  removeTask: (id) => set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'closed' as const } : t) })),
  removeGoods: (id) => set(s => ({ goods: s.goods.map(g => g.id === id ? { ...g, status: 'removed' as const } : g) })),
  removePost: (id) => set(s => ({ posts: s.posts.map(p => p.id === id ? { ...p, status: 'removed' as const } : p) })),
  approveWithdrawal: (id) => {
    const wd = get().withdrawals.find(w => w.id === id)!
    const users = get().users.map(u => u.id === wd.user_id ? { ...u, balance: round(u.balance - wd.amount) } : u)
    const txn: WalletTxn = { id: nid('w'), user_id: wd.user_id, type: 'withdraw', amount: -wd.amount, balance_after: round((get().users.find(u => u.id === wd.user_id)!.balance) - wd.amount), remark: '提现到账', created_at: now() }
    set(s => ({ users, withdrawals: s.withdrawals.map(w => w.id === id ? { ...w, status: 'approved' as const, handled_at: now() } : w), txns: [txn, ...s.txns] }))
  },
  rejectWithdrawal: (id, reason) => set(s => ({ withdrawals: s.withdrawals.map(w => w.id === id ? { ...w, status: 'rejected' as const, reason, handled_at: now() } : w) })),
  setConfig: (c) => set({ config: c }),

  // ---------- 状态微调 / 置顶 ----------
  setTaskStatus: (id, status) => set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, status } : t) })),
  setGoodsStatus: (id, status) => set(s => ({ goods: s.goods.map(g => g.id === id ? { ...g, status } : g) })),
  setPostStatus: (id, status) => set(s => ({ posts: s.posts.map(p => p.id === id ? { ...p, status } : p) })),
  topTask: (id, days) => {
    const me = get().users.find(u => u.id === get().session.userId)!
    const price = (get().config.top_price as any)['d' + days] as number
    if (me.balance < price) return { ok: false, msg: '可用余额不足，无法支付置顶费 ¥' + price }
    const until = new Date(Date.now() + days * 86400000).toISOString()
    const users = get().users.map(u => u.id === me.id ? { ...u, balance: round(u.balance - price) } : u)
    const tasks = get().tasks.map(t => t.id === id ? { ...t, top_until: until } : t)
    const txn: WalletTxn = { id: nid('w'), user_id: me.id, type: 'pay', amount: -price, balance_after: round(me.balance - price), remark: '付费置顶任务（' + days + ' 天）', created_at: now() }
    set(s => ({ users, tasks, txns: [txn, ...s.txns] }))
    return { ok: true, msg: '已置顶 ' + days + ' 天，扣费 ¥' + price }
  }
}))
