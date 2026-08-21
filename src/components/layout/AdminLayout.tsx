import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, ListChecks, ShoppingBag, MessageSquare, Gavel,
  Wallet, Settings2, Shield, ArrowLeft
} from 'lucide-react'
import { useStore } from '../../store/store'

const menu = [
  { to: '/admin', label: '数据看板', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: '用户管理', icon: Users },
  { to: '/admin/tasks', label: '悬赏审核', icon: ListChecks },
  { to: '/admin/goods', label: '二手审核', icon: ShoppingBag },
  { to: '/admin/posts', label: '帖子审核', icon: MessageSquare },
  { to: '/admin/arbitration', label: '订单与仲裁', icon: Gavel },
  { to: '/admin/withdraw', label: '提现审核', icon: Wallet },
  { to: '/admin/config', label: '运营配置', icon: Settings2 },
  { to: '/admin/system', label: '系统安全', icon: Shield }
]

export default function AdminLayout() {
  const nav = useNavigate()
  const cfg = useStore(s => s.config)

  return (
    <div className="admin min-h-screen flex flex-col md:flex-row bg-gray-50 text-ink">
      {/* 侧边栏：桌面固定左侧；手机变为顶部品牌条 + 横向滚动菜单 */}
      <aside className="md:w-56 md:fixed md:inset-y-0 md:left-0 bg-ink text-gray-300 flex flex-col md:h-screen z-30">
        <div className="h-14 flex items-center gap-2 px-5 text-white font-black text-lg border-b border-white/10 shrink-0">
          <span className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center text-sm">择</span>
          择校通 · 管理后台
        </div>

        {/* 桌面：竖向菜单 */}
        <nav className="hidden md:flex md:flex-1 md:flex-col md:py-3 md:overflow-y-auto">
          {menu.map(m => (
            <NavLink key={m.to} to={m.to} end={m.end}
              className={({ isActive }) => 'flex items-center gap-3 px-5 py-2.5 text-sm ' + (isActive ? 'bg-white/10 text-white border-l-2 border-brand-400' : 'hover:bg-white/5')}>
              <m.icon size={18} /> {m.label}
            </NavLink>
          ))}
          <button onClick={() => nav('/')} className="m-3 mt-auto flex items-center justify-center gap-2 py-2 rounded-lg bg-white/10 text-sm hover:bg-white/20">
            <ArrowLeft size={16} /> 返回前台
          </button>
        </nav>

        {/* 手机：横向滚动菜单 */}
        <nav className="md:hidden flex gap-1 overflow-x-auto px-2 py-2 border-b border-white/10">
          {menu.map(m => (
            <NavLink key={m.to} to={m.to} end={m.end}
              className={({ isActive }) => 'whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ' + (isActive ? 'bg-white/15 text-white' : 'text-gray-300')}>
              <m.icon size={15} /> {m.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 内容区：桌面左移 224px；手机占满 */}
      <div className="flex-1 md:ml-56 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
          <div className="text-xs md:text-sm text-gray-500 truncate">平台佣金 {Math.round(cfg.commission_rate * 100)}% · 置顶 ¥{cfg.top_price.d1}/¥{cfg.top_price.d3}/¥{cfg.top_price.d7}（1/3/7天）</div>
          <div className="flex items-center gap-3 text-sm shrink-0">
            <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700">管理员</span>
            <button onClick={() => nav('/')} className="text-gray-500 hover:text-ink">前台视角</button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
