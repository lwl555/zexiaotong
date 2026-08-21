import { ReactNode, useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import HistoryDrawer from './HistoryDrawer'
import { primaryNav, moreNav, type NavDef } from '../lib/nav'

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const nav = useNavigate()

  // 点外面关掉「更多」下拉
  useEffect(() => {
    if (!moreOpen) return
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen])

  // 点外面关掉移动端汉堡菜单
  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (menuRef.current && !menuRef.current.contains(t) && !t.closest('.hamburger')) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          {/* 左：极简紫色 logo */}
          <NavLink to="/" className="brand" end>
            <span className="brand-mark">择</span>
            <span className="brand-text">择校通</span>
          </NavLink>

          {/* 中：4 个主链接 + 「更多」下拉（仅在桌面显示，窄屏由汉堡菜单接管） */}
          <nav className="nav desktop-nav">
            {primaryNav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
              >
                <span className="nav-link-ico">{n.icon}</span>
                <span className="nav-link-lbl">{n.label}</span>
                {n.live && <span className="live-dot" title="AI 实时联网" />}
              </NavLink>
            ))}

            <div className="nav-more" ref={moreRef}>
              <button
                className={'nav-link nav-more-btn' + (moreOpen ? ' open' : '')}
                onClick={() => setMoreOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={moreOpen}
              >
                <span className="nav-link-ico">⋯</span>
                <span className="nav-link-lbl">更多</span>
              </button>
              {moreOpen && (
                <div className="nav-more-pop">
                  {moreNav.map((n) => (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) => 'nav-more-item' + (isActive ? ' active' : '')}
                    >
                      <span className="ic">{n.icon}</span>
                      <span>{n.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* 右：克制 — 历史按钮 + 头像下拉（含 uid）+ 汉堡（仅窄屏显示） */}
          <div className="topbar-right">
            <button
              className="ghost-btn"
              onClick={() => setDrawerOpen(true)}
              title="历史对话与查询记录"
            >
              <span className="ico">🕘</span>历史
            </button>
            <div className="avatar" onClick={() => nav('/about')} title="关于本站">
              兄
            </div>
            <button
              className={'hamburger' + (menuOpen ? ' open' : '')}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="打开菜单"
              aria-expanded={menuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>

        {/* 移动端下拉菜单：收纳全部导航（主 + 更多），窄屏替代桌面横排 */}
        {menuOpen && (
          <div className="mobile-menu" ref={menuRef}>
            {[...primaryNav, ...moreNav].map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => 'mobile-menu-item' + (isActive ? ' active' : '')}
                onClick={() => setMenuOpen(false)}
              >
                {n.icon && <span className="ic">{n.icon}</span>}
                <span className="lbl">{n.label}</span>
                {n.live && <span className="live-dot" />}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      <main className="container"><Outlet /></main>

      <footer className="footer">
        <b>择校通</b> · 真实 · 直接 · 不客气 — AI 只说大实话，不粉饰、不回避、不绕弯子。
      </footer>

      <HistoryDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
