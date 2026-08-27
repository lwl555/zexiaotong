// 微信风首字头像：按「智能助手 / 社区交易 / 账户工具」三类各取一种克制低饱和色（不彩虹、不 emoji）。
// 首页功能块、各功能页顶栏共用此映射，保证头像颜色一致。

export const CAT_COLOR = {
  assistant: '#5b7c99', // 克制石板蓝
  community: '#5f8a5f', // 克制苔绿
  account: '#9a7b5b' // 克制棕褐
} as const

type Cat = keyof typeof CAT_COLOR

// key = 路由（与首页功能块 id 对应的 to 路径去斜杠）
export const AVATAR: Record<string, { ch: string; cat: Cat }> = {
  'ai-search': { ch: '百', cat: 'assistant' },
  'ai-tangdou': { ch: '糖', cat: 'assistant' },
  'ai-tutor': { ch: '导', cat: 'assistant' },
  'document-workshop': { ch: '档', cat: 'assistant' },
  'warnings': { ch: '避', cat: 'assistant' },
  'community': { ch: '社', cat: 'community' },
  'news': { ch: '讯', cat: 'community' },
  'goods': { ch: '二', cat: 'community' },
  'publish': { ch: '任', cat: 'community' },
  'money': { ch: '钱', cat: 'account' },
  'messages': { ch: '信', cat: 'account' },
  'notifications': { ch: '知', cat: 'account' },
  'ai-history': { ch: '史', cat: 'account' },
  'wallet': { ch: '包', cat: 'account' },
  'mine': { ch: '我', cat: 'account' },
  'about': { ch: '于', cat: 'account' }
}

export function avatarOf(route: string): { ch: string; color: string } {
  const key = route.replace(/^\//, '')
  const a = AVATAR[key] ?? { ch: '择', cat: 'account' as Cat }
  return { ch: a.ch, color: CAT_COLOR[a.cat] }
}
