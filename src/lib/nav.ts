// 全平台统一的导航配置（桌面顶栏 + 手机壳 + 后台入口共用）
// 关键：所有功能都在同一套 URL 下，不再有 /m 这种独立命名空间。
// 设备自适应由 App 里的 ResponsiveShell 决定用手机壳还是桌面壳。

import type { LucideIcon } from 'lucide-react'
import {
  Home, Compass, Sparkles, Radio, FileText, ShoppingBag, MessageSquare,
  Wallet, AlertTriangle, Coins, Shield, Info
} from 'lucide-react'

export interface NavDef {
  to: string
  label: string
  icon: LucideIcon | null
  live?: boolean
  end?: boolean
}

// 桌面顶部主导航（克制：核心入口）
export const primaryNav: NavDef[] = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/ai-search', label: 'AI百事通', icon: Compass, live: true },
  { to: '/ai-tangdou', label: '糖豆', icon: Sparkles, live: true },
  { to: '/ai-tutor', label: '实时资讯台', icon: Radio, live: true },
  { to: '/document-workshop', label: '文档工坊', icon: FileText, live: true }
]

// 「更多」里的次要工具 + 新模块入口 + 后台（两端都能点到）
export const moreNav: NavDef[] = [
  { to: '/goods', label: '二手集市', icon: ShoppingBag },
  { to: '/community', label: '校园社区', icon: MessageSquare },
  { to: '/wallet', label: '我的钱包', icon: Wallet },
  { to: '/warnings', label: '避雷清单', icon: AlertTriangle },
  { to: '/money', label: '搞钱项目', icon: Coins },
  { to: '/admin', label: '管理后台', icon: Shield },
  { to: '/about', label: '关于我们', icon: Info }
]

// 各路由对应的浏览器标签标题
export const ROUTE_TITLES: Record<string, string> = {
  '/': '择校通',
  '/ai-search': '择校通 · AI百事通',
  '/ai-tangdou': '择校通 · 糖豆',
  '/ai-tutor': '择校通 · 实时资讯台',
  '/document-workshop': '择校通 · 文档工坊',
  '/warnings': '择校通 · 避雷清单',
  '/money': '择校通 · 搞钱项目',
  '/about': '择校通 · 关于'
}
