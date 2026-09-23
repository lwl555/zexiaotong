// ===== 平台核心数据模型 =====

export type Role = 'user' | 'admin'
export type UserStatus = 'active' | 'banned'

export interface Profile {
  id: string
  qq: string  // 登录标识：QQ 号（profiles 表存储列历史为 phone，由 db.ts 映射）
  nickname: string
  avatar: string
  role: Role
  balance: number          // 积分余额（100 积分 = 1 元）
  frozen: number           // 冻结积分（发布任务冻结）
  status: UserStatus
  created_at: string
  password_hash?: string  // 密码哈希（前端 SHA-256(qq:password)），可空表示未设置密码
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
  /** 社区智能体自动生成的帖子（前端据此打「AI 生成」标注，不伪装成真人） */
  is_bot?: boolean
}

export interface Comment {
  id: string
  target_type: 'task' | 'post' | 'goods' | 'bulletin'
  target_id: string
  author_id: string
  author_name: string
  author_avatar?: string
  content: string
  created_at: string
}

export interface School {
  id: string
  name: string
  created_at: string
}

export interface Bulletin {
  id: string
  school_id: string | null
  school_name: string
  author_id: string
  author_name: string
  author_avatar: string
  content: string
  images: string[]
  is_all_schools: boolean
  likes: number
  comments: number
  status: 'on' | 'off' | 'removed'
  created_at: string
}

export type ActorType = 'user' | 'admin' | 'bot' | 'system'
export interface ActivityLog {
  id: string
  actor_type: ActorType
  actor_id: string
  actor_name: string
  action: string
  target_type: string
  target_id: string
  detail: string
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

export type TxnType = 'recharge' | 'income' | 'pay' | 'withdraw' | 'commission' | 'refund' | 'freeze' | 'unfreeze' | 'adjust' | 'checkin'

// 签到记录
export interface CheckIn {
  id: string
  user_id: string
  checkin_date: string  // YYYY-MM-DD（中国日期）
  points: number
  streak: number
  created_at: string
}
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
  // 收款信息（2026-09 新增：没有这三列时管理员不知道该打给谁）
  channel?: string
  account?: string
  account_name?: string
}

// 充值订单：充值走「用户提交申请（扫码转账截图）→ 管理员审核 → 审核通过才入账」人工审核模式。
// 订单 id 即幂等键；status: pending=待审核、approved=审核通过已入账、rejected=已驳回。
// paid/cancelled/expired 为历史兼容状态（旧「模拟收银台」流程）。
export type RechargeOrderStatus = 'pending' | 'paid' | 'cancelled' | 'expired' | 'approved' | 'rejected'
export interface RechargeOrder {
  id: string
  user_id: string
  amount_yuan: number
  points: number
  status: RechargeOrderStatus
  channel: string
  paid_at: string | null
  created_at: string
  // 人工审核模式新增字段
  alipay_name: string
  proof_url: string
  reviewed_at: string | null
  reviewed_by: string
  reject_reason: string
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

// 举报（reports 表）：用户在帖子/商品/任务等页提交，管理员在后台处理。
export type ReportTarget = 'post' | 'goods' | 'task' | 'comment' | 'user'
export type ReportStatus = 'pending' | 'handled' | 'rejected'
export interface Report {
  id: string
  target_type: ReportTarget
  target_id: string
  target_title?: string
  reason: string
  detail?: string
  reporter_id?: string
  reporter_name?: string
  status: ReportStatus
  created_at: string
}

export type NotiType = 'task_status' | 'task_taken' | 'task_review' | 'arbitration' | 'comment' | 'message' | 'announce' | 'bulletin'
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
  top_price: { d1: number; d3: number; d7: number }  // 单位：积分
  announce: string
  points_per_yuan: number   // 积分换算比例（默认 100：100 积分 = 1 元）
  alipay_qr_url: string     // 支付宝收款码（公开图，存 uploads 桶）
  alipay_account: string    // 支付宝收款账号 / 姓名（展示用，便于用户核对）
}
