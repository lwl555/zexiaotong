import { ReactNode, useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom'
import HistoryDrawer from './HistoryDrawer'
import { primaryNav, moreNav, type NavDef } from '../lib/nav'
import { Clock } from 'lucide-react'
import { useStore } from '../store/store'

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  const loc = useLocation()
  const isTangdou = loc.pathname === '/ai-tangdou'

  // PC 端也要拉用户态（手机端由 MobileLayout 拉，这里补上，否则 me 永远是 null → 永远无登录入口）
  const me = useStore(s => s.me)
  const init = useStore(s => s.init)
  const isGuest = !me?.qq
  useEffect(() => { init() }, [init])

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
                {n.icon && <span className="nav-link-ico"><n.icon size={18} strokeWidth={1.9} /></span>}
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
                      {n.icon && <span className="ic"><n.icon size={18} strokeWidth={1.9} /></span>}
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
              <span className="ico"><Clock size={16} strokeWidth={1.9} /></span>历史
            </button>
            {isGuest ? (
              <button className="ghost-btn" onClick={() => nav('/login')}>
                登录
              </button>
            ) : (
              <div
                className="avatar"
                onClick={() => nav('/mine')}
                title={me?.qq ? `QQ ${me.qq}` : '个人中心'}
                style={{ cursor: 'pointer' }}
              >
                {(me?.nickname || me?.qq || '我').toString().slice(0, 1)}
              </div>
            )}
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
                {n.icon && <span className="ic"><n.icon size={18} strokeWidth={1.9} /></span>}
                <span className="lbl">{n.label}</span>
                {n.live && <span className="live-dot" />}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      {/* 糖豆页面：footer 隐藏，去掉 container padding，让糖豆 fixed 容器完美占满 */}
      {isTangdou ? (
        <main style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <Outlet />
        </main>
      ) : (
        <main className="container"><Outlet /></main>
      )}

      {!isTangdou && (
        <footer className="footer">
          <b>择校通</b> · 真实 · 直接 · 不客气 — AI 只说大实话，不粉饰、不回避、不绕弯子。
        </footer>
      )}

      <HistoryDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
