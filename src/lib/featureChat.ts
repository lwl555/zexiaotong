// 功能通知聊天：注册表 + 数据层
// 每个首页功能块点进去先进入「通知聊天界面」（/m/notify/:id），
// 里面是：系统自动通知 + 管理员可下发/回复 + 用户可回复 的轻量消息流，
// 底部「打开完整功能」才进入真实功能。后台「功能反馈」页按功能查看全部消息。
//
// 存储表 feature_chats（见 supabase/migrations/0003_feature_chats.sql）：
//   feature      text  — 功能块 id（与首页 HOME_ICON 的 key 一致）
//   author_role  text  — 'system' | 'user' | 'admin'
//   author_id    text  — 用户 uuid / 'system' / 'admin'
//   author_name  text  — 展示名
//   content      text
// 复用现有 comments 的「全放开」RLS 风格（select using true / insert with check true），
// 与本项目演示环境一致；admin 身份由前端 me.role 判定后写入 author_role 字段。

import { supabase } from './db'
import { avatarOf } from './avatarMeta'

export type FeatureRole = 'system' | 'user' | 'admin'

export interface FeatureChatMsg {
  id: string
  feature: string
  author_role: FeatureRole
  author_id: string
  author_name: string
  content: string
  created_at: string
}

export interface FeatureMeta {
  id: string
  name: string
  to: string       // 真实功能路由
  color: string    // 顶栏/图标色（取 avatarMeta 分类色）
  icon: string     // WxIcon 图标名
  notifications: string[] // 系统自动通知文案（服务号风格：直接、有观点）
}

// 与首页 HOME_ICON 的 key 一一对应
export const FEATURES: Record<string, FeatureMeta> = {
  baishitong: {
    id: 'baishitong', name: 'AI 百事通', to: '/ai-search', icon: 'search',
    notifications: [
      '我是择校通 AI 百事通：查院校、解政策、改志愿，随问随答。',
      '试试问我：某大学某专业去年录取分多少？某个省份今年政策变了没？',
    ],
  },
  tangdou: {
    id: 'tangdou', name: '糖豆·学习搭子', to: '/ai-tangdou', icon: 'chat',
    notifications: [
      '糖豆是你的 AI 学习搭子，会按目标把任务拆到每一天。',
      '打开完整功能，告诉我你的考试目标就能开工。',
    ],
  },
  tutor: {
    id: 'tutor', name: '学习导师', to: '/ai-tutor', icon: 'cap',
    notifications: [
      '学习导师按省份 / 分数 / 位次给你冲稳保三档方案。',
      '打开后直接说：广东 物理 580 位次 25000 想报计算机。',
    ],
  },
  docs: {
    id: 'docs', name: '文档工坊', to: '/document-workshop', icon: 'doc',
    notifications: [
      '文档工坊把咨询结论一键生成志愿报告 PDF。',
      '四个视角：学校 / 就业 / 生活学习 / 各省通知。',
    ],
  },
  warnings: {
    id: 'warnings', name: '避雷清单', to: '/warnings', icon: 'bolt',
    notifications: [
      '避雷清单是大家共建的院校 / 公司踩坑库。',
      '看到坑点可在完整功能里提交，帮后来人避坑。',
    ],
  },
  news: {
    id: 'news', name: '实时资讯台', to: '/community', icon: 'news',
    notifications: [
      '实时资讯台聚合招生快讯与政策变动。',
      '每天 3 条精选，打开看完整时间线。',
    ],
  },
  community: {
    id: 'community', name: '择校社区', to: '/community', icon: 'users',
    notifications: [
      '择校社区是报考过来人互助论坛。',
      '提问、晒录取、找同校搭子都在这里。',
    ],
  },
  goods: {
    id: 'goods', name: '二手市场', to: '/goods', icon: 'bag',
    notifications: [
      '二手市场买卖教材、笔记、转租。',
      '发布前先看避雷清单，少踩坑。',
    ],
  },
  tasks: {
    id: 'tasks', name: '任务大厅', to: '/publish', icon: 'clipboard',
    notifications: [
      '任务大厅接单赚佣金：代查资料、陪跑咨询。',
      '新任务实时刷新，手快有。',
    ],
  },
  money: {
    id: 'money', name: '搞钱项目', to: '/money', icon: 'yuan',
    notifications: [
      '搞钱项目汇总平台分佣机会。',
      '收益每日结算到钱包，满额可提现。',
    ],
  },
  messages: {
    id: 'messages', name: '消息中心', to: '/messages', icon: 'mail',
    notifications: [
      '消息中心汇总私信与系统提醒。',
      '重要通知会在这里弹红点。',
    ],
  },
  notifications: {
    id: 'notifications', name: '通知', to: '/notifications', icon: 'bell',
    notifications: [
      '这里是你在本平台的全部动态。',
      '录取开放、任务到账都会推到这里。',
    ],
  },
  'ai-history': {
    id: 'ai-history', name: 'AI 历史', to: '/ai-history', icon: 'clock',
    notifications: [
      'AI 历史保存你和各个 AI 助手的对话。',
      '随时回看，不丢上下文。',
    ],
  },
  wallet: {
    id: 'wallet', name: '我的钱包', to: '/wallet', icon: 'wallet',
    notifications: [
      '钱包记录余额、冻结与每笔流水。',
      '提现门槛与费率见运营配置。',
    ],
  },
  mine: {
    id: 'mine', name: '个人中心', to: '/mine', icon: 'user',
    notifications: [
      '个人中心管理账号、绑定与设置。',
      '登录后解锁更多功能。',
    ],
  },
  about: {
    id: 'about', name: '关于择校通', to: '/about', icon: 'info',
    notifications: [
      '择校通：真实、直接、不客气的报考助手。',
      '版本 2026.08 · 反馈请走各功能聊天。',
    ],
  },
}

// 给注册表补全 color（统一走 avatarMeta 分类色，避免散落硬编码）
for (const k of Object.keys(FEATURES)) {
  FEATURES[k].color = avatarOf(FEATURES[k].to).color
}

const TABLE = 'feature_chats'

export async function fetchFeatureChat(feature: string): Promise<FeatureChatMsg[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('feature', feature)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[featureChat] fetch', error)
    return []
  }
  return (data || []) as FeatureChatMsg[]
}

export async function postFeatureChat(msg: Omit<FeatureChatMsg, 'id' | 'created_at'>): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).insert(msg)
  if (error) console.error('[featureChat] post', error)
}

// 首次打开某功能时，把预设系统通知写入（仅当该 feature 还没有 system 消息，避免重复播种）
export async function ensureSeed(feature: string, notifications: string[], authorName: string): Promise<void> {
  if (!supabase) return
  const { data } = await supabase
    .from(TABLE)
    .select('id')
    .eq('feature', feature)
    .eq('author_role', 'system')
    .limit(1)
  if (data && data.length > 0) return
  for (const content of notifications) {
    await supabase.from(TABLE).insert({
      feature,
      author_role: 'system',
      author_id: 'system',
      author_name: authorName,
      content,
    })
  }
}
