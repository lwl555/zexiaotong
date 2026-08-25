import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Home as HomeIcon, PlusCircle, ShoppingBag, MessageSquare, User, Bell, Users, Compass, Contact, ChevronLeft } from 'lucide-react'
import { useStore } from '../../store/store'
import WxAvatar from '../mobile/WxAvatar'
import { avatarOf } from '../../lib/avatarMeta'

// 各路由对应的微信风顶栏标题（与首页功能块保持一致）
const ROUTE_TITLE: Record<string, string> = {
  '/ai-search': 'AI百事通',
  '/ai-tangdou': '糖豆·学习搭子',
  '/ai-tutor': '学习导师',
  '/document-workshop': '文档工坊',
  '/warnings': '避雷清单',
  '/community': '择校社区',
  '/goods': '二手市场',
  '/publish': '发布任务',
  '/publish-goods': '发布闲置',
  '/publish-post': '发布帖子',
  '/money': '搞钱项目',
  '/messages': '消息中心',
  '/notifications': '通知',
  '/ai-history': 'AI 历史',
  '/wallet': '我的钱包',
  '/mine': '个人中心',
  '/about': '关于择校通',
  '/my-tasks': '我的任务'
}
function titleOf(path: string): string {
  if (ROUTE_TITLE[path]) return ROUTE_TITLE[path]
  if (path.startsWith('/post')) return '帖子详情'
  if (path.startsWith('/task')) return '任务详情'
  if (path.startsWith('/goods/')) return '商品详情'
  return '择校通'
}

// 微信风格底部 4 Tab（微信绿 #07c160）
const WECHAT_GREEN = '#07c160'
const tabs = [
  { to: '/', label: '微信', icon: MessageSquare, end: true },
  { to: '/community', label: '通讯录', icon: Users, end: false },
  { to: '/money', label: '发现', icon: Compass, end: false },
  { to: '/mine', label: '我', icon: User, end: false }
]

// 微信内置浏览器 / 弱网 / 隐私模式下 Supabase 偶尔会卡住。
// 给"加载中..."加一个 6 秒后出现的"网络慢？直接进入"按钮，避免永远转圈。
// 同时 store.init 内部已有 12 秒兜底，这里兜底是给不耐烦的用户的手动出口。
function GuestFallback() {
  const set = useStore(s => s.setMeFallback)
  return (
    <div className="flex flex-col items-center gap-3 px-6 text-center">
      <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      <div className="text-sm text-gray-400">加载中...</div>
      <button
        onClick={() => set()}
        className="mt-2 px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-full active:bg-gray-50">
        太慢了？直接进入访客模式
      </button>
    </div>
  )
}

export default function MobileLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const me = useStore(s => s.me)
  const loading = useStore(s => s.loading)
  const error = useStore(s => s.error)
  const init = useStore(s => s.init)
  const unread = useStore(s => me ? s.notifications.filter(n => n.user_id === me.id && !n.read).length : 0)
  const [showSkip, setShowSkip] = useState(false)

  // 启动数据拉取（profiles / tasks / goods / posts / config 等）
  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setShowSkip(true), 6000)
      return () => { clearTimeout(t); setShowSkip(false) }
    }
    setShowSkip(false)
  }, [loading])

  // 登录/启动页不需要 me 守卫，直接渲染（用户要能看到登录入口）
  const isPublicPage = loc.pathname === '/login' || loc.pathname === '/splash'

  // 游客（qq 为空）首次进入引导到登录页；点过「先逛逛」则记到 localStorage 不再强制
  const isGuest = !!me && !me.qq
  const skipSplash = typeof localStorage !== 'undefined' && localStorage.getItem('zex:skipSplash') === '1'
  const needSplash = isGuest && !skipSplash && !isPublicPage
  useEffect(() => {
    if (needSplash) nav('/splash')
  }, [needSplash, nav])

  // 数据未加载完前显示 loading。store.init 有 12 秒总兜底，
  // 这里再暴露手动跳过按钮，最大可能性保证用户能进界面。
  if (!me && !isPublicPage) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        {showSkip ? (
          <GuestFallback />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            <div className="text-sm text-gray-400">{error ? '正在重试...' : '加载中...'}</div>
          </div>
        )}
        {error && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 max-w-[90vw] px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-700">
            {error} <button onClick={() => init()} className="ml-1 underline">重试</button>
          </div>
        )}
      </div>
    )
  }

  // 微信风顶栏：除首页 / 登录 / 引导页 外，所有功能页统一显示
  // 「返回 + 首字头像 + 标题」，保证「点进去像微信聊天」的进入一致性。
  // AI 聊天页（百事通/糖豆/导师/文档/避雷）也走这个全局顶栏，避免每个聊天页各自渲染一个顶栏
  // 导致它出现在「描述+子频道」之后、位置不在最顶。
  const path = loc.pathname
  const showTopBar = !['/', '/splash', '/login'].includes(path)

  return (
    <div className="app-shell flex flex-col" style={{ minHeight: '100vh' }}>
      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 48 }}>
        {showTopBar && (
          <div
            className="sticky top-0 z-20 flex items-center gap-2 px-2 h-12 border-b bg-white"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
          >
            <button
              aria-label="返回"
              className="w-9 h-9 flex items-center justify-center text-gray-500 active:bg-black/5 rounded-full"
              onClick={() => (path === '/mine' || window.history.length > 1 ? nav(-1) : nav('/'))}
            >
              <ChevronLeft size={22} strokeWidth={1.8} />
            </button>
            <WxAvatar {...avatarOf(path)} size={30} />
            <span className="text-[16px] font-semibold text-gray-900 truncate">{titleOf(path)}</span>
          </div>
        )}
        <Outlet />
      </div>
      {/* 底部固定导航：微信风格 4 Tab（微信绿高亮） */}
      <nav
        className="fixed bottom-0 inset-x-0 mx-auto w-full max-w-[480px] h-12 bg-white border-t border-gray-100 flex items-center px-2 z-30"
        style={{ transform: 'translateY(0)' }}>
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => 'flex-1 flex flex-col items-center gap-0 py-1 ' + (isActive ? 'text-[#07c160]' : 'text-gray-400')}>
            <t.icon size={20} strokeWidth={1.6} />
            <span className="text-[10px] leading-none mt-0.5">{t.label}</span>
          </NavLink>
        ))}
      </nav>
      {/* 浮动通知入口（贴着底部导航栏之上右侧，避免与 Tab 重叠） */}
      {unread > 0 && (
        <button onClick={() => nav('/notifications')} className="fixed z-30 w-10 h-10 rounded-full bg-white shadow-card flex items-center justify-center text-[#07c160]"
          style={{ bottom: 56, right: 12 }}>
          <Bell size={18} strokeWidth={1.9} />
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{unread}</span>
        </button>
      )}
    </div>
  )
}
