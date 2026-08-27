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
  notifications: string[] // 系统自动通知文案（服务号风格：具体、有观点、像真推送）
}

// 与首页 HOME_ICON 的 key 一一对应（color 在下方循环补全，故这里用 Omit 避免类型冗余）
// 推送文案原则：不写「我是 XX 助手」式自我介绍，改为具体、有颗粒度、带观点/提醒的信息，
// 像真实服务号在推一条有用的通知；克制使用 📌 / ⚠️ 作为信息标记。
const RAW: Record<string, Omit<FeatureMeta, 'color'>> = {
  baishitong: {
    id: 'baishitong', name: 'AI 百事通', to: '/ai-search', icon: 'search',
    notifications: [
      '📌 最近问爆的：多所 985 在你们省缩招了没？给我「院校+省份」，我拉近 3 年录取位次给你看。',
      '别光看校名。上周有同学弃了「听着很牛」的某学院、改选行业认可度更高的双非——这种取舍我帮你算清楚。',
    ],
  },
  tangdou: {
    id: 'tangdou', name: '糖豆·学习搭子', to: '/ai-tangdou', icon: 'chat',
    notifications: [
      '距 2026 考研还有一段。告诉我目标和当前进度，糖豆把复习拆成每天的具体清单，不用你自己排。',
      '背单词总坚持不住？糖豆的每日打卡把大任务切成 20 分钟小块，断了一天也会帮你接着排。',
    ],
  },
  tutor: {
    id: 'tutor', name: '学习导师', to: '/ai-tutor', icon: 'cap',
    notifications: [
      '报志愿最怕「冲的没上、稳的没保」。给我省份+科类+分数+位次，导师直接给冲稳保三档，附录取概率。',
      '今年坑多：多个省份合并批次、部分专业取消调剂。这种变动我会标在方案里提醒你。',
    ],
  },
  docs: {
    id: 'docs', name: '文档工坊', to: '/document-workshop', icon: 'doc',
    notifications: [
      '咨询完别只截聊天图。文档工坊一键把结论生成 PDF 报告，学校/就业/生活/各省通知四个视角分开，家长也能看懂。',
      '去年有个家庭因为「就业视角」那栏，临时改了专业方向——报告的价值在把你忽略的维度摊开。',
    ],
  },
  warnings: {
    id: 'warnings', name: '避雷清单', to: '/warnings', icon: 'bolt',
    notifications: [
      '⚠️ 近期高发：声称「内部指标/保录」的机构在 3 个省出现，已有家长被骗数万。点开看完整避雷条目。',
      '避雷不只是防骗子。教材盗版、转租押金不退、实习黑中介——这些身边的坑，大家都往里记。',
    ],
  },
  news: {
    id: 'news', name: '实时资讯台', to: '/news', icon: 'news',
    notifications: [
      '今日速览：教育部公布 2026 高考时间；广东、山东志愿填报系统开放时间已定；多所双一流发布招生简章。',
      '政策一天一个样。这里把官方通知和社区讨论揉成一条时间线，你不用自己刷十个公众号。',
    ],
  },
  community: {
    id: 'community', name: '择校社区', to: '/community', icon: 'users',
    notifications: [
      '今年上岸的学长学姐开始晒录取了。想找同校同专业搭子、问真实就读体验，社区里直接发帖。',
      '报志愿前最该问的往往是「读了后悔吗」。社区里大量在读生的真实吐槽，比招生简章有用。',
    ],
  },
  goods: {
    id: 'goods', name: '二手市场', to: '/goods', icon: 'bag',
    notifications: [
      '开学季最抢手：高数/线代笔记、专业课真题、闲置教材。发布前先翻一遍避雷清单，别踩转租押金坑。',
      '毕业季清仓多。看到「九成新+低价+急出」先聊聊，确认实物再交易，平台不担保线下纠纷。',
    ],
  },
  tasks: {
    id: 'tasks', name: '任务大厅', to: '/publish', icon: 'clipboard',
    notifications: [
      '新挂任务：代查某省近 3 年录取数据、陪跑志愿咨询、整理某专业就业报告——手快有，佣金实时结算。',
      '想接单先看清要求。任务描述和交付标准写清楚的才接，含糊的一律先问，别白干。',
    ],
  },
  money: {
    id: 'money', name: '搞钱项目', to: '/money', icon: 'yuan',
    notifications: [
      '平台分佣实时进账。你邀请好友用 AI 百事通、促成二手成交，佣金每日结算到钱包，满额可提。',
      '搞钱别信「日入过万」。这里只放平台内真实可结算的项目，收益多少写明白，不画饼。',
    ],
  },
  messages: {
    id: 'messages', name: '消息中心', to: '/messages', icon: 'mail',
    notifications: [
      '私信和@都会落在这里。有人回你帖子、有人想组同校搭子，红点会先亮。',
      '重要通知（录取开放、任务到账、提现审核）走系统提醒，别只看微信，回来这儿看一眼。',
    ],
  },
  notifications: {
    id: 'notifications', name: '通知', to: '/notifications', icon: 'bell',
    notifications: [
      '你在本平台的全部动态汇总：谁赞了你的帖、任务进度、钱包变动，按时间排好。',
      '怕错过关键节点？录取开放、志愿截止前我们会推提醒，记得把通知权限开着。',
    ],
  },
  'ai-history': {
    id: 'ai-history', name: 'AI 历史', to: '/ai-history', icon: 'clock',
    notifications: [
      '和百事通、糖豆、导师的对话都自动存这儿。换手机、清缓存也不丢，随时回看上下文。',
      '写报告前先翻历史。上次你问过的院校对比，直接接着聊，不用重新说一遍背景。',
    ],
  },
  wallet: {
    id: 'wallet', name: '我的钱包', to: '/wallet', icon: 'wallet',
    notifications: [
      '余额、冻结、每笔进出都在这。任务佣金、二手成交、邀请奖励分开记，对账不糊涂。',
      '提现门槛和费率在运营配置里。到账慢先看来往流水，确认是「处理中」还是「被驳回」。',
    ],
  },
  mine: {
    id: 'mine', name: '个人中心', to: '/mine', icon: 'user',
    notifications: [
      '账号、绑定、设置都在这。登录后解锁 AI 历史、钱包、发布权限，别用游客身份错过功能。',
      '昵称头像改了会同步到社区发帖。绑定手机后，重要通知能短信兜底。',
    ],
  },
  about: {
    id: 'about', name: '关于择校通', to: '/about', icon: 'info',
    notifications: [
      '择校通：真实、直接、不客气的报考助手。AI 查院校/城市/公司，社区互助，避雷共建。',
      '我们不替你做决定，只把信息拆清楚。意见反馈走各功能聊天，看到问题直接戳我们。',
    ],
  },
}

// 给注册表补全 color（统一走 avatarMeta 分类色，避免散落硬编码）
export const FEATURES: Record<string, FeatureMeta> = RAW as Record<string, FeatureMeta>
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

export async function postFeatureChat(msg: Omit<FeatureChatMsg, 'id' | 'created_at'>): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from(TABLE).insert(msg)
  if (error) { console.error('[featureChat] post', error); return false }
  return true
}

// 推送文案版本：每次改了 notifications 文案就 +1，保证已测试用户重新打开时
// 能清掉旧（假）文案、重播新文案，而不是一直显示旧内容。
const SEED_VERSION = 2

// 首次打开某功能时，把预设系统通知写入。
// - 从未播种 → 直接播种当前版本；
// - 已播种但版本不一致（旧假文案）→ 删除旧 system 消息后重播新文案；
// - 已是最新版本 → 跳过，避免重复播种。
export async function ensureSeed(feature: string, notifications: string[], authorName: string): Promise<void> {
  if (!supabase) return
  const { data } = await supabase
    .from(TABLE)
    .select('id, author_name')
    .eq('feature', feature)
    .eq('author_role', 'system')
  const rows = (data || []) as { id: string; author_name: string | null }[]
  const isCurrent = rows.some(r => (r.author_name || '').includes(`v${SEED_VERSION}`))
  if (isCurrent) return
  // 旧版本或从未播种 → 清掉旧 system 消息，重新播种新版本
  if (rows.length > 0) {
    await supabase.from(TABLE).delete().eq('feature', feature).eq('author_role', 'system')
  }
  const name = `${authorName} v${SEED_VERSION}`
  for (const content of notifications) {
    await supabase.from(TABLE).insert({
      feature,
      author_role: 'system',
      author_id: 'system',
      author_name: name,
      content,
    })
  }
}
