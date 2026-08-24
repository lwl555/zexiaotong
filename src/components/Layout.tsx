import { ReactNode, useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom'
import HistoryDrawer from './HistoryDrawer'
import PcSplash from './PcSplash'
import { useStore, compressImageToDataUrl } from '../store/store'
import { primaryNav, moreNav, type NavDef } from '../lib/nav'
import { Clock, LogOut, Camera } from 'lucide-react'

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const me = useStore(s => s.me)
  // PC 端：挂载时拉一次用户态（手机版 MobileLayout 也会跑 init，共用同一 store，幂等）
  useEffect(() => { useStore.getState().init() }, [])
  // 游客判定：me 存在但没填 qq（与手机版一致）
  const isGuest = !!me && !me.qq
  // PC 入场 Splash：每个会话（tab）首次加载播一次，避免每次路由切换都弹
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    try { return !sessionStorage.getItem('zex:pcSplash') } catch { return true }
  })
  const handleSplashDone = () => {
    try { sessionStorage.setItem('zex:pcSplash', '1') } catch {}
    setShowSplash(false)
  }
  const [moreOpen, setMoreOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const nav = useNavigate()
  const loc = useLocation()
  const isTangdou = loc.pathname === '/ai-tangdou'
  const logout = useStore(s => s.logout)
  const updateProfile = useStore(s => s.updateProfile)

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

  // 点外面关掉头像下拉
  useEffect(() => {
    if (!avatarOpen) return
    const onDoc = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [avatarOpen])

  // 头像上传：选图 → 压缩 → 更新 store（写库在 store 内完成）
  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选同一文件
    if (!file) return
    setAvatarBusy(true)
    try {
      const dataUrl = await compressImageToDataUrl(file, 256, 0.82)
      if (dataUrl) {
        await updateProfile({ avatar: dataUrl })
      } else {
        // 压缩失败（如非图片），回退到原文件直读
        const reader = new FileReader()
        reader.onload = () => { if (typeof reader.result === 'string') updateProfile({ avatar: reader.result }) }
        reader.readAsDataURL(file)
      }
    } finally {
      setAvatarBusy(false)
      setAvatarOpen(false)
    }
  }

  return (
    <>
      <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          {/* 左：纯文字 logo（去掉原「紫渐变方块」那套 AI 紫做法），保留暖陶土下划线作识别点 */}
          <NavLink to="/" className="brand" end>
            <span className="brand-text">择校通</span>
            <span className="brand-bar" aria-hidden="true" />
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

          {/* 右：克制 — 历史按钮 + 登录入口（游客）OR 头像+uid（已登录） + 汉堡（仅窄屏显示） */}
          <div className="topbar-right">
            <button
              className="ghost-btn"
              onClick={() => setDrawerOpen(true)}
              title="历史对话与查询记录"
            >
              <span className="ico"><Clock size={16} strokeWidth={1.9} /></span>历史
            </button>
            {isGuest ? (
              <button
                className="pc-login-btn"
                onClick={() => nav('/login')}
                title="登录 / 注册"
              >
                登录 / 注册
              </button>
            ) : (
              <div className="avatar-wrap" ref={avatarRef}>
                {me?.avatar ? (
                  <img
                    src={me.avatar}
                    className={'avatar' + (avatarOpen ? ' open' : '')}
                    alt="头像"
                    onClick={() => setAvatarOpen(v => !v)}
                  />
                ) : (
                  <div
                    className={'avatar' + (avatarOpen ? ' open' : '')}
                    onClick={() => setAvatarOpen(v => !v)}
                    title={me?.qq ? `已登录 · QQ ${me.qq}` : '账号'}
                  >
                    {me?.nickname ? me.nickname.slice(0, 1) : '兄'}
                  </div>
                )}
                {avatarOpen && (
                  <div className="avatar-menu">
                    <div className="avatar-menu-head">
                      <div className="avatar-menu-name">{me?.nickname || '用户'}</div>
                      <div className="avatar-menu-sub">{me?.qq ? `QQ ${me.qq}` : '未绑定 QQ'}</div>
                    </div>
                    <button className="avatar-menu-item" onClick={() => avatarInputRef.current?.click()} disabled={avatarBusy}>
                      <Camera size={16} /> {avatarBusy ? '上传中…' : '更换头像'}
                    </button>
                    <button className="avatar-menu-item danger" onClick={() => { logout(); nav('/splash') }}>
                      <LogOut size={16} /> 退出登录
                    </button>
                  </div>
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={onAvatarFile}
                />
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

    {/* PC 入场 Splash：盖在布局之上的一次性全屏动画（仅 PC 外壳渲染，手机版走自己的 /splash） */}
    {showSplash && <PcSplash onDone={handleSplashDone} />}
  </>
)}
