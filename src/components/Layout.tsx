import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

interface Props {
  navItems: { to: string; label: string; end?: boolean }[]
  children: ReactNode
}

export default function Layout({ navItems, children }: Props) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <span className="dot" />
            择校通 <small>说大实话</small>
          </NavLink>
          <nav className="nav">
            {navItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="container">{children}</main>

      <footer className="footer">
        <b>择校通</b> · 真实 · 直接 · 不客气 — AI 只说大实话，不粉饰、不回避、不绕弯子。
      </footer>
    </div>
  )
}
