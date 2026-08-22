import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom'
import HistoryDrawer from './HistoryDrawer'
import { primaryNav, moreNav, type NavDef } from '../lib/nav'
import { Clock, Home, PlusCircle, ShoppingBag, MessageSquare, User } from 'lucide-react'

const bottomTabs = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/publish', label: '发布', icon: PlusCircle, end: false },
  { to: '/goods', label: '二手', icon: ShoppingBag, end: false },
  { to: '/community', label: '社区', icon: MessageSquare, end: false },
  { to: '/mine', label: '我的', icon: User, end: false }
]

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [topBarVisible, setTopBarVisible] = useState(true)
  const moreRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  const loc = useLocation()
  const isTangdou = loc.pathname === '/ai-tangdou'
  const isNarrow = typeof window !== 'undefined' && window.innerWidth <= 820

  // 窄屏：滚动时自动隐藏/显示顶部状态栏（收纳功能）
  useEffect(() => {
    if (!isNarrow || isTangdou) return
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (y < 40) setTopBarVisible(true)
      else if (y > lastY + 5) setTopBarVisible(false)
      else if (y < lastY - 5) setTopBarVisible(true)
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isNarrow, isTangdou])

  // 点外面关掉「更多」下拉
  useEffect(() => {
    if (!moreOpen) return
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen])

  // 点外面关掉窄屏菜单
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
    <div className="shell flex flex-col" style={{ minHeight: '100vh' }}>
      {/* ── 顶部状态栏 ─────────────────────────────────────────── */}
      <header
        className="topbar"
        style={{
          position: isNarrow ? 'sticky' : 'relative',
          top: 0,
          zIndex: 50,
          transform: isNarrow && !topBarVisible ? 'translateY(-100%)' : 'none',
          transition: 'transform .25s ease'
        }}
      >
        <div className="topbar-inner">
          <NavLink to="/" className="brand" end>
            <span className="brand-mark">择</span>
            <span className="brand-text">择校通</span>
          </NavLink>

          {/* 宽屏：横排导航 */}
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

          {/* 右侧：历史 + 头像 + 窄屏汉堡 */}
          <div className="topbar-right">
            <button
              className="ghost-btn"
              onClick={() => setDrawerOpen(true)}
              title="历史对话与查询记录"
            >
              <span className="ico"><Clock size={16} strokeWidth={1.9} /></span>历史
            </button>
            <div className="avatar" onClick={() => nav('/about')} title="关于本站">
              兄
            </div>
            {isNarrow && (
              <button
                className={'hamburger' + (menuOpen ? ' open' : '')}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="打开菜单"
                aria-expanded={menuOpen}
              >
                <span /><span /><span />
              </button>
            )}
          </div>
        </div>

        {/* 窄屏：下拉菜单收纳全部导航 */}
        {isNarrow && menuOpen && (
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

      {/* ── 主内容区 ──────────────────────────────────────────── */}
      {isTangdou ? (
        <main style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <Outlet />
        </main>
      ) : (
        <main className="container"><Outlet /></main>
      )}

      {/* ── 底部：宽屏 footer / 窄屏 Tab 栏 ───────────────────── */}
      {!isTangdou && !isNarrow && (
        <footer className="footer">
          <b>择校通</b> · 真实 · 直接 · 不客气 — AI 只说大实话，不粉饰、不回避、不绕弯子。
        </footer>
      )}

      {/* 窄屏：底部固定 Tab 栏 */}
      {isNarrow && !isTangdou && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-14 bg-white border-t border-gray-100 flex items-center px-1 z-40">
          {bottomTabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => 'flex-1 flex flex-col items-center gap-0.5 py-1 ' + (isActive ? 'text-brand-600' : 'text-gray-400')}
            >
              <t.icon size={20} />
              <span className="text-[10px]">{t.label}</span>
            </NavLink>
          ))}
        </nav>
      )}

      {/* 窄屏：底部留白（防止内容被 fixed Tab 栏遮挡） */}
      {isNarrow && !isTangdou && <div style={{ height: 56, flexShrink: 0 }} />}

      <HistoryDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
