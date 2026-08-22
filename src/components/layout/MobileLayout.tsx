import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Home as HomeIcon, PlusCircle, ShoppingBag, MessageSquare, User, Bell } from 'lucide-react'
import { useStore } from '../../store/store'

const tabs = [
  { to: '/', label: '首页', icon: HomeIcon, end: true },
  { to: '/publish', label: '发布', icon: PlusCircle, end: false },
  { to: '/goods', label: '二手', icon: ShoppingBag, end: false },
  { to: '/community', label: '社区', icon: MessageSquare, end: false },
  { to: '/mine', label: '我的', icon: User, end: false }
]

export default function MobileLayout() {
  const nav = useNavigate()
  const me = useStore(s => s.me)
  const unread = useStore(s => me ? s.notifications.filter(n => n.user_id === me.id && !n.read).length : 0)

  // 数据未加载完前显示 loading，避免子页面读 null 崩溃
  if (!me) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <div className="text-sm text-gray-400">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell flex flex-col" style={{ minHeight: '100vh' }}>
      <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
        <Outlet />
      </div>
      {/* 底部固定导航 */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-16 bg-white border-t border-gray-100 flex items-center px-2 z-30">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => 'flex-1 flex flex-col items-center gap-1 py-1 ' + (isActive ? 'text-brand-600' : 'text-gray-400')}>
            <t.icon size={22} />
            <span className="text-[11px]">{t.label}</span>
          </NavLink>
        ))}
      </nav>
      {/* 浮动通知入口 */}
      <button onClick={() => nav('/notifications')} className="fixed bottom-20 right-[calc(50%-230px)] w-11 h-11 rounded-full bg-white shadow-card flex items-center justify-center text-brand-600 z-30">
        <Bell size={20} />
        {unread > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{unread}</span>}
      </button>
    </div>
  )
}
