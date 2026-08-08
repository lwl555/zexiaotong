import { ReactNode, useState } from 'react'
import { NavLink } from 'react-router-dom'
import HistoryDrawer from './HistoryDrawer'

interface NavDef {
  to: string
  label: string
  icon: string
  live?: boolean
  end?: boolean
}

interface Props {
  navItems: NavDef[]
  children: ReactNode
}

export default function Layout({ navItems, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand" end>
            <span className="dot" />
            择校通 <small>说大实话</small>
          </NavLink>

          <div className="topbar-right">
            <nav className="nav">
              {navItems.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  <span className="ico">{n.icon}</span>
                  <span className="lbl">{n.label}</span>
                  {n.live && <span className="live" title="AI 实时联网检索已接入" />}
                </NavLink>
              ))}
            </nav>

            <span className="status-pill" title="AI 模型服务在线，可实时联网检索">
              <span className="dot-live" />
              AI 在线
            </span>

            <button className="nav-history" onClick={() => setDrawerOpen(true)} title="历史对话与查询记录">
              🕘 历史
            </button>
          </div>
        </div>
      </header>

      <main className="container">{children}</main>

      <footer className="footer">
        <b>择校通</b> · 真实 · 直接 · 不客气 — AI 只说大实话，不粉饰、不回避、不绕弯子。
      </footer>

      <HistoryDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
