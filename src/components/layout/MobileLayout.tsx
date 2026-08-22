import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Home as HomeIcon, PlusCircle, ShoppingBag, MessageSquare, User, Bell, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '../../store/store'

const tabs = [
  { to: '/', label: '首页', icon: HomeIcon, end: true },
  { to: '/publish', label: '发布', icon: PlusCircle, end: false },
  { to: '/goods', label: '二手', icon: ShoppingBag, end: false },
  { to: '/community', label: '社区', icon: MessageSquare, end: false },
  { to: '/mine', label: '我的', icon: User, end: false }
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
  const me = useStore(s => s.me)
  const loading = useStore(s => s.loading)
  const error = useStore(s => s.error)
  const init = useStore(s => s.init)
  const unread = useStore(s => me ? s.notifications.filter(n => n.user_id === me.id && !n.read).length : 0)
  const [showSkip, setShowSkip] = useState(false)
  // 底部导航栏可随时收纳（状态提到全局 store，让 AITangdou 等 fixed 容器回收空位）
  const navCollapsed = useStore(s => s.navCollapsed)
  const setNavCollapsed = useStore(s => s.setNavCollapsed)

  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setShowSkip(true), 6000)
      return () => { clearTimeout(t); setShowSkip(false) }
    }
    setShowSkip(false)
  }, [loading])

  // 数据未加载完前显示 loading。store.init 有 12 秒总兜底，
  // 这里再暴露手动跳过按钮，最大可能性保证用户能进界面。
  if (!me) {
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

  return (
    <div className="app-shell flex flex-col" style={{ minHeight: '100vh' }}>
      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: navCollapsed ? 12 : 80 }}>
        <Outlet />
      </div>
      {/* 底部固定导航（可随时收纳） */}
      <nav
        className="fixed bottom-0 inset-x-0 mx-auto w-full max-w-[480px] h-16 bg-white border-t border-gray-100 flex items-center px-2 z-30"
        style={{ transform: navCollapsed ? 'translateY(115%)' : 'translateY(0)', transition: 'transform .28s ease' }}>
        {/* 收纳把手：点一下整条滑下去 */}
        <button
          onClick={() => setNavCollapsed(true)}
          aria-label="收起导航栏"
          className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-6 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-400 active:bg-gray-50">
          <ChevronDown size={16} />
        </button>
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => 'flex-1 flex flex-col items-center gap-1 py-1 ' + (isActive ? 'text-brand-600' : 'text-gray-400')}>
            <t.icon size={22} />
            <span className="text-[11px]">{t.label}</span>
          </NavLink>
        ))}
      </nav>
      {/* 收纳后：底部右侧小 pill（半透明白底 + 毛玻璃），像 iOS Home Indicator */}
      {navCollapsed && (
        <button
          onClick={() => setNavCollapsed(false)}
          aria-label="展开导航栏"
          className="fixed bottom-2 right-3 px-3 h-7 rounded-full bg-white/85 backdrop-blur border border-gray-200/80 shadow-sm flex items-center justify-center text-gray-500 z-40 active:bg-gray-100">
          <ChevronUp size={14} strokeWidth={2} />
        </button>
      )}
      {/* 浮动通知入口（收纳时移到屏幕左侧，跟右侧 pill 分置两隅） */}
      <button onClick={() => nav('/notifications')} className="fixed z-30 w-11 h-11 rounded-full bg-white shadow-card flex items-center justify-center text-brand-600"
        style={{ bottom: navCollapsed ? 56 : 80, left: 12 }}>
        <Bell size={20} />
        {unread > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{unread}</span>}
      </button>
    </div>
  )
}
