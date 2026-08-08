import { ReactNode, useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import HistoryDrawer from './HistoryDrawer'

interface NavDef {
  to: string
  label: string
  icon: string
  live?: boolean
  end?: boolean
}

interface Props {
  primaryNav: NavDef[]
  moreNav: NavDef[]
  children: ReactNode
}

export default function Layout({ primaryNav, moreNav, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
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
  const moreRef = useRef<HTMLDivElement>(null)
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

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          {/* 左：极简紫色 logo */}
          <NavLink to="/" className="brand" end>
            <span className="brand-mark">择</span>
            <span className="brand-text">择校通</span>
          </NavLink>

          {/* 中：4 个主链接 + 「更多」下拉 */}
          <nav className="nav">
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

          {/* 右：克制 — 历史按钮 + 头像下拉（含 uid） */}
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
            <span className="uid-hint">{uid}</span>
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
