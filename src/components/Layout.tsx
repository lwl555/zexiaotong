import { ReactNode, useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom'
import HistoryDrawer from './HistoryDrawer'
import PcSplash from './PcSplash'
import { primaryNav, moreNav, type NavDef } from '../lib/nav'
import { Clock } from 'lucide-react'

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  // PC 鍏ュ満 Splash锛氭瘡涓細璇濓紙tab锛夐娆″姞杞芥挱涓€娆★紝閬垮厤姣忔璺敱鍒囨崲閮藉脊
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    try { return !sessionStorage.getItem('zex:pcSplash') } catch { return true }
  })
  const handleSplashDone = () => {
    try { sessionStorage.setItem('zex:pcSplash', '1') } catch {}
    setShowSplash(false)
  }
  const [moreOpen, setMoreOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  const loc = useLocation()
  const isTangdou = loc.pathname === '/ai-tangdou'

  // 鐐瑰闈㈠叧鎺夈€屾洿澶氥€嶄笅鎷?
  useEffect(() => {
    if (!moreOpen) return
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen])

  // 鐐瑰闈㈠叧鎺夌Щ鍔ㄧ姹夊牎鑿滃崟
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
    <>
      <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          {/* 宸︼細鏋佺畝绱壊 logo */}
          <NavLink to="/" className="brand" end>
            <span className="brand-mark">鎷?/span>
            <span className="brand-text">鎷╂牎閫?/span>
          </NavLink>

          {/* 涓細4 涓富閾炬帴 + 銆屾洿澶氥€嶄笅鎷夛紙浠呭湪妗岄潰鏄剧ず锛岀獎灞忕敱姹夊牎鑿滃崟鎺ョ锛?*/}
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
                {n.live && <span className="live-dot" title="AI 瀹炴椂鑱旂綉" />}
              </NavLink>
            ))}

            <div className="nav-more" ref={moreRef}>
              <button
                className={'nav-link nav-more-btn' + (moreOpen ? ' open' : '')}
                onClick={() => setMoreOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={moreOpen}
              >
                <span className="nav-link-ico">鈰?/span>
                <span className="nav-link-lbl">鏇村</span>
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

          {/* 鍙筹細鍏嬪埗 鈥?鍘嗗彶鎸夐挳 + 澶村儚涓嬫媺锛堝惈 uid锛? 姹夊牎锛堜粎绐勫睆鏄剧ず锛?*/}
          <div className="topbar-right">
            <button
              className="ghost-btn"
              onClick={() => setDrawerOpen(true)}
              title="鍘嗗彶瀵硅瘽涓庢煡璇㈣褰?
            >
              <span className="ico"><Clock size={16} strokeWidth={1.9} /></span>鍘嗗彶
            </button>
            <div className="avatar" onClick={() => nav('/about')} title="鍏充簬鏈珯">
              鍏?
            </div>
            <button
              className={'hamburger' + (menuOpen ? ' open' : '')}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="鎵撳紑鑿滃崟"
              aria-expanded={menuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>

        {/* 绉诲姩绔笅鎷夎彍鍗曪細鏀剁撼鍏ㄩ儴瀵艰埅锛堜富 + 鏇村锛夛紝绐勫睆鏇夸唬妗岄潰妯帓 */}
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

      {/* 绯栬眴椤甸潰锛歠ooter 闅愯棌锛屽幓鎺?container padding锛岃绯栬眴 fixed 瀹瑰櫒瀹岀編鍗犳弧 */}
      {isTangdou ? (
        <main style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <Outlet />
        </main>
      ) : (
        <main className="container"><Outlet /></main>
      )}

      {!isTangdou && (
        <footer className="footer">
          <b>鎷╂牎閫?/b> 路 鐪熷疄 路 鐩存帴 路 涓嶅姘?鈥?AI 鍙澶у疄璇濓紝涓嶇矇楗般€佷笉鍥為伩銆佷笉缁曞集瀛愩€?
        </footer>
      )}

      <HistoryDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>

    {/* PC 鍏ュ満 Splash锛氱洊鍦ㄥ竷灞€涔嬩笂鐨勪竴娆℃€у叏灞忓姩鐢伙紙浠?PC 澶栧３娓叉煋锛屾墜鏈虹増璧拌嚜宸辩殑 /splash锛?*/}
    {showSplash && <PcSplash onDone={handleSplashDone} />}
  </>
)}
