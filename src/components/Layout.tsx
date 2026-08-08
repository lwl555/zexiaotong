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
  // 用户身份 ID（演示用：根据浏览器生成一个稳定值）
  const [uid] = useState(() => {
    if (typeof window === 'undefined') return '18882632073'
    try {
      const k = 'zxt.uid'
      let v = window.localStorage.getItem(k)
      if (!v) {
        v = String(Math.floor(8000000000 + Math.random() * 900000000))
        window.localStorage.setItem(k, v)
      }
      return v
    } catch {
      return '18882632073'
    }
  })

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          {/* 紫色 logo + 紫色"工具导航"chip */}
          <div className="topbar-left">
            <NavLink to="/" className="brand" end>
              <span className="brand-logo">
                <span className="brand-logo-dot" />
                <span className="brand-logo-text">择校通</span>
              </span>
            </NavLink>
            <span className="brand-chip" title="全部工具入口">
              <span className="brand-chip-ico">❖</span>
              <span>工具导航</span>
            </span>
          </div>

          {/* 中央：多列深色功能链接（每条 icon + 双行） */}
          <nav className="nav">
            {navItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                title={n.label}
                className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
              >
                <span className="nav-link-ico">{n.icon}</span>
                <span className="nav-link-lbl">{n.label}</span>
                {n.live && <span className="live-dot" title="AI 实时联网检索已接入" />}
              </NavLink>
            ))}
          </nav>

          {/* 右侧：状态徽标 + 历史 + 紫色 + 红色角标 + uid */}
          <div className="topbar-right">
            <span className="status-pill" title="AI 服务在线，可实时联网检索">
              <span className="dot-live" />
              AI 在线
            </span>
            <button className="nav-history" onClick={() => setDrawerOpen(true)} title="历史对话与查询记录">
              🕘 历史
            </button>
            <span className="badge-purple" title="本站工具集数量（演示）">
              <span className="num">18</span>
            </span>
            <span className="uid">{uid}</span>
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
