// ===== 平台核心数据模型 =====

export type Role = 'user' | 'admin'
export type UserStatus = 'active' | 'banned'

export interface Profile {
  id: string
  qq: string  // 登录标识：QQ 号（profiles 表存储列历史为 phone，由 db.ts 映射）
  nickname: string
  avatar: string
  role: Role
  balance: number          // 钱包余额（元）
  frozen: number           // 冻结金额（发布任务冻结）
  status: UserStatus
  created_at: string
}

// 任务状态机：open(待接单) -> accepted(已接单待交付) -> doing(进行中) -> review(待验收) -> done(完成)
//                                          └-> arbitration(仲裁中) -> done/closed
// closed 为关闭/已取消
export type TaskStatus = 'open' | 'accepted' | 'doing' | 'review' | 'done' | 'arbitration' | 'closed'

export type TaskCategory = '悬赏' | '跑腿' | '文档设计' | '问卷' | '二手' | '论坛'

export interface Task {
  id: string
  title: string
  category: Exclude<TaskCategory, '二手' | '论坛'>
  amount: number
  deadline: string          // ISO
  description: string
  images: string[]
  poster_id: string
  poster_name: string
  poster_avatar: string
  status: TaskStatus
  accepted_id: string | null
  accepted_name: string | null
  top_until: string | null  // 置顶到期时间
  created_at: string
}

export interface TaskApplication {
  id: string
  task_id: string
  applicant_id: string
  applicant_name: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

// 接单订单（任务成交后生成）
export interface Order {
  id: string
  task_id: string
  task_title: string
  employer_id: string
  worker_id: string
  amount: number
  commission: number        // 平台抽佣金额
  status: 'doing' | 'review' | 'done' | 'arbitration' | 'closed'
  created_at: string
  finished_at: string | null
}

export type GoodsStatus = 'on' | 'off' | 'removed'
export interface Goods {
  id: string
  title: string
  price: number
  category: string
  description: string
  images: string[]
  seller_id: string
  seller_name: string
  status: GoodsStatus
  created_at: string
}

export type PostStatus = 'on' | 'off' | 'removed'
export interface Post {
  id: string
  title: string
  content: string
  images: string[]
  author_id: string
  author_name: string
  author_avatar: string
  likes: number
  collects: number
  comments: number
  liked: boolean
  collected: boolean
  status: PostStatus
  created_at: string
}

export interface Comment {
  id: string
  target_type: 'task' | 'post' | 'goods'
  target_id: string
  author_id: string
  author_name: string
  author_avatar?: string
  content: string
  created_at: string
}

export interface Message {
  id: string
  conv_id: string
  sender_id: string
  receiver_id: string
  content: string
  type: 'text' | 'image'
  read: boolean
  created_at: string
}

export type TxnType = 'recharge' | 'income' | 'pay' | 'withdraw' | 'commission' | 'refund' | 'freeze' | 'unfreeze'
export interface WalletTxn {
  id: string
  user_id: string
  type: TxnType
  amount: number           // 正负表示增减
  balance_after: number
  remark: string
  created_at: string
}

export type WithdrawStatus = 'pending' | 'approved' | 'rejected'
export interface Withdrawal {
  id: string
  user_id: string
  user_name: string
  amount: number
  status: WithdrawStatus
  reason: string
  created_at: string
  handled_at: string | null
}

export type ArbitrationStatus = 'open' | 'closed'
export interface Arbitration {
  id: string
  task_id: string
  task_title: string
  order_id: string
  plaintiff_id: string
  plaintiff_name: string
  defendant_id: string
  defendant_name: string
  reason: string
  evidence: string
  result: string            // 终审结果描述
  winner: 'plaintiff' | 'defendant' | 'split' | null
  status: ArbitrationStatus
  created_at: string
}

export type NotiType = 'task_status' | 'task_taken' | 'task_review' | 'arbitration' | 'comment' | 'message' | 'announce'
export interface Notification {
  id: string
  user_id: string
  type: NotiType
  title: string
  content: string
  read: boolean
  created_at: string
}

export interface Category {
  id: string
  kind: 'task' | 'goods'
  name: string
}

export interface Banner {
  id: string
  title: string
  image: string
  url: string
}

export interface PlatformConfig {
  commission_rate: number   // 0.05 - 0.15
  top_price: { d1: number; d3: number; d7: number }
  announce: string
}
