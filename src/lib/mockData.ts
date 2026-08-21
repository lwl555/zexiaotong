import type {
  Profile, Task, Goods, Post, Message, WalletTxn, Withdrawal,
  Arbitration, Notification, Category, Banner, PlatformConfig
} from './types'

// ===== 离线占位图（SVG data URI，无需联网） =====
export function img(text: string, w = 400, h = 300, c = '#06bf83'): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
    <rect width='100%' height='100%' fill='#eef2f1'/>
    <rect x='0' y='0' width='100%' height='10' fill='${c}'/>
    <text x='50%' y='54%' font-size='22' fill='#6b7280' text-anchor='middle' font-family='sans-serif'>${text}</text>
  </svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export function avatarFor(name: string): string {
  const colors = ['#06bf83', '#e8732a', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#0ea5e9']
  const c = colors[name.charCodeAt(0) % colors.length]
  const ch = name.slice(-1)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
    <rect width='80' height='80' rx='40' fill='${c}'/>
    <text x='50%' y='56%' font-size='34' fill='white' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif'>${ch}</text>
  </svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

// ===== 用户 =====
export const ME: Profile = {
  id: 'u_me', phone: '13800001234', nickname: '我（阿杰）', avatar: avatarFor('杰'),
  role: 'user', balance: 256.8, frozen: 30, status: 'active', created_at: '2026-08-01'
}
export const ADMIN: Profile = {
  id: 'u_admin', phone: '13900005678', nickname: '平台管理员', avatar: avatarFor('管'),
  role: 'admin', balance: 0, frozen: 0, status: 'active', created_at: '2026-01-01'
}
export const USERS: Profile[] = [
  ME, ADMIN,
  { id: 'u_2', phone: '13700002222', nickname: '学委小李', avatar: avatarFor('李'), role: 'user', balance: 88.0, frozen: 0, status: 'active', created_at: '2026-08-03' },
  { id: 'u_3', phone: '13600003333', nickname: '设计系阿May', avatar: avatarFor('May'), role: 'user', balance: 412.5, frozen: 0, status: 'active', created_at: '2026-07-20' },
  { id: 'u_4', phone: '13500004444', nickname: '跑腿王哥', avatar: avatarFor('王'), role: 'user', balance: 60.0, frozen: 50, status: 'active', created_at: '2026-08-10' },
  { id: 'u_5', phone: '13400005555', nickname: '问卷小能手', avatar: avatarFor('问'), role: 'user', balance: 15.2, frozen: 0, status: 'banned', created_at: '2026-06-15' }
]

// ===== 任务（覆盖各状态） =====
export const TASKS: Task[] = [
  {
    id: 't1', title: '代取快递到宿舍楼下（两件）', category: '跑腿', amount: 8,
    deadline: '2026-08-25T18:00:00', description: '菜鸟驿站两个中通包裹，送到 3 号楼 502，麻烦了！',
    images: [img('快递代取', 400, 240)], poster_id: 'u_me', poster_name: '我（阿杰）', poster_avatar: ME.avatar,
    status: 'open', accepted_by: null, accepted_name: null, top_until: null, created_at: '2026-08-21T09:00:00'
  },
  {
    id: 't2', title: '帮忙做一份活动海报（PS/AI）', category: '文档设计', amount: 60,
    deadline: '2026-08-28T20:00:00', description: '社团招新海报，A4 竖版，要青春活泼风格，提供素材。',
    images: [img('海报设计', 400, 240, '#e8732a')], poster_id: 'u_2', poster_name: '学委小李', poster_avatar: USERS[2].avatar,
    status: 'accepted', accepted_by: 'u_3', accepted_name: '设计系阿May', top_until: null, created_at: '2026-08-20T14:00:00'
  },
  {
    id: 't3', title: '陪跑 3 公里并拍照打卡', category: '跑腿', amount: 20,
    deadline: '2026-08-23T07:00:00', description: '体测前需要有人陪跑，操场集合。',
    images: [], poster_id: 'u_4', poster_name: '跑腿王哥', poster_avatar: USERS[4].avatar,
    status: 'review', accepted_by: 'u_me', accepted_name: '我（阿杰）', top_until: null, created_at: '2026-08-19T10:00:00'
  },
  {
    id: 't4', title: '整理《数据结构》第 5 章思维导图', category: '文档设计', amount: 35,
    deadline: '2026-08-26T22:00:00', description: '考前复习用，要求 XMind 或手绘扫描，清晰即可。',
    images: [], poster_id: 'u_me', poster_name: '我（阿杰）', poster_avatar: ME.avatar,
    status: 'done', accepted_by: 'u_2', accepted_name: '学委小李', top_until: null, created_at: '2026-08-15T11:00:00'
  },
  {
    id: 't5', title: '代填 50 份校园满意度问卷', category: '问卷', amount: 25,
    deadline: '2026-08-24T12:00:00', description: '问卷星链接已附，需真实填写不同答案，不要雷同。',
    images: [], poster_id: 'u_3', poster_name: '设计系阿May', poster_avatar: USERS[3].avatar,
    status: 'arbitration', accepted_by: 'u_4', accepted_name: '跑腿王哥', top_until: null, created_at: '2026-08-17T09:00:00'
  },
  {
    id: 't6', title: '【置顶】期末帮忙占图书馆座位（一周）', category: '跑腿', amount: 40,
    deadline: '2026-08-30T08:00:00', description: '每天早 8 点占三楼靠窗位，连续一周。',
    images: [img('占座', 400, 240, '#3b82f6')], poster_id: 'u_2', poster_name: '学委小李', poster_avatar: USERS[2].avatar,
    status: 'open', accepted_by: null, accepted_name: null, top_until: '2026-08-24T00:00:00', created_at: '2026-08-21T08:00:00'
  }
]

// ===== 接单申请 / 订单 =====
export const APPLICATIONS: any[] = []
export const ORDERS: any[] = [
  { id: 'o1', task_id: 't4', task_title: '整理《数据结构》第 5 章思维导图', employer_id: 'u_me', worker_id: 'u_2', amount: 35, commission: 3.5, status: 'done', created_at: '2026-08-15T11:30:00', finished_at: '2026-08-16T10:00:00' }
]

// ===== 二手商品 =====
export const GOODS: Goods[] = [
  { id: 'g1', title: '九成新 iPad Air 4 64G', price: 1800, category: '数码', description: '考研用完出的，无划痕，带原装笔，电池健康 92%。', images: [img('iPad', 400, 300, '#0ea5e9')], seller_id: 'u_3', seller_name: '设计系阿May', status: 'on', created_at: '2026-08-18' },
  { id: 'g2', title: '自行车（变速，骑行一学期）', price: 260, category: '出行', description: '校园通勤神器，刹车灵敏，可小刀。', images: [img('自行车', 400, 300, '#e8732a')], seller_id: 'u_2', seller_name: '学委小李', status: 'on', created_at: '2026-08-19' },
  { id: 'g3', title: '高数（上）教材+习题册', price: 25, category: '书籍', description: '笔记满满，期末 95 分秘籍。', images: [], seller_id: 'u_4', seller_name: '跑腿王哥', status: 'off', created_at: '2026-08-12' }
]

// ===== 社区帖子 =====
export const POSTS: Post[] = [
  { id: 'p1', title: '有没有一起备考六级的？组队互相监督', content: '每天早上 7 点图书馆，求搭子，互相打卡不摸鱼。', images: [], author_id: 'u_2', author_name: '学委小李', author_avatar: USERS[2].avatar, likes: 12, collects: 3, comments: 5, liked: false, collected: false, status: 'on', created_at: '2026-08-20' },
  { id: 'p2', title: '吐槽：食堂新窗口又涨价了', content: '一份盖饭从 12 涨到 15，学生党伤不起……', images: [img('食堂', 400, 240, '#f59e0b')], author_id: 'u_3', author_name: '设计系阿May', author_avatar: USERS[3].avatar, likes: 47, collects: 2, comments: 18, liked: true, collected: false, status: 'on', created_at: '2026-08-21' }
]

// ===== 私信 =====
export const MESSAGES: Message[] = [
  { id: 'm1', conv_id: 'u_me_u_3', sender_id: 'u_3', receiver_id: 'u_me', content: '海报我明天能出初稿，你看下风格？', type: 'text', read: false, created_at: '2026-08-21T10:00:00' },
  { id: 'm2', conv_id: 'u_me_u_3', sender_id: 'u_me', receiver_id: 'u_3', content: '好呀，青春活泼就行', type: 'text', read: true, created_at: '2026-08-21T10:05:00' },
  { id: 'm3', conv_id: 'u_me_u_4', sender_id: 'u_4', receiver_id: 'u_me', content: '占座那单我接了哈', type: 'text', read: false, created_at: '2026-08-21T11:00:00' }
]

// ===== 钱包流水 =====
export const TXNS: WalletTxn[] = [
  { id: 'w1', user_id: 'u_me', type: 'recharge', amount: 200, balance_after: 256.8, remark: '微信充值', created_at: '2026-08-10T09:00:00' },
  { id: 'w2', user_id: 'u_me', type: 'freeze', amount: -30, balance_after: 256.8, remark: '发布任务冻结（代取快递）', created_at: '2026-08-21T09:00:00' },
  { id: 'w3', user_id: 'u_me', type: 'income', amount: 31.5, balance_after: 256.8, remark: '任务完成收入（思维导图）', created_at: '2026-08-16T10:00:00' }
]

// ===== 提现申请 =====
export const WITHDRAWALS: Withdrawal[] = [
  { id: 'wd1', user_id: 'u_3', user_name: '设计系阿May', amount: 100, status: 'pending', reason: '', created_at: '2026-08-21T08:30:00', handled_at: null }
]

// ===== 仲裁 =====
export const ARBITRATIONS: Arbitration[] = [
  { id: 'arb1', task_id: 't5', task_title: '代填 50 份校园满意度问卷', order_id: '', plaintiff_id: 'u_3', plaintiff_name: '设计系阿May', defendant_id: 'u_4', defendant_name: '跑腿王哥', reason: '对方填的 50 份答案高度雷同，怀疑作弊，拒绝付款。', evidence: '问卷后台截图 3 张', result: '', winner: null, status: 'open', created_at: '2026-08-20T15:00:00' }
]

// ===== 通知 =====
export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', user_id: 'u_me', type: 'task_review', title: '任务待验收', content: '「陪跑 3 公里」接单者已交付成果，请验收', read: false, created_at: '2026-08-21T11:10:00' },
  { id: 'n2', user_id: 'u_me', type: 'message', title: '新私信', content: '跑腿王哥：占座那单我接了哈', read: false, created_at: '2026-08-21T11:00:00' },
  { id: 'n3', user_id: 'u_me', type: 'task_status', title: '任务已完成', content: '「整理数据结构思维导图」已结算，收入 ¥31.5', read: true, created_at: '2026-08-16T10:00:00' }
]

// ===== 分类 / 轮播 / 配置 =====
export const CATEGORIES: Category[] = [
  { id: 'c1', kind: 'task', name: '悬赏' }, { id: 'c2', kind: 'task', name: '跑腿' },
  { id: 'c3', kind: 'task', name: '文档设计' }, { id: 'c4', kind: 'task', name: '问卷' },
  { id: 'c5', kind: 'goods', name: '数码' }, { id: 'c6', kind: 'goods', name: '出行' },
  { id: 'c7', kind: 'goods', name: '书籍' }, { id: 'c8', kind: 'goods', name: '日用' }
]
export const BANNERS: Banner[] = [
  { id: 'b1', title: '新学期悬赏季', image: img('新学期悬赏季', 600, 200, '#06bf83'), url: '' },
  { id: 'b2', title: '闲置变现 0 门槛', image: img('闲置变现', 600, 200, '#e8732a'), url: '' }
]
export const PLATFORM_CONFIG: PlatformConfig = {
  commission_rate: 0.10,
  top_price: { d1: 2, d3: 5, d7: 10 },
  announce: '欢迎使用择校通，发布任务前请阅读用户协议，文明交易。'
}
