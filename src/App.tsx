import { useEffect, Component, ReactNode, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import MobileLayout from './components/layout/MobileLayout'
import AdminLayout from './components/layout/AdminLayout'
import { useIsMobile } from './lib/useIsMobile'
import { ROUTE_TITLES } from './lib/nav'
import { safeLazy, reloadForNewVersion } from './lib/safeLazy'

// 性能优化：路由级 code splitting（v1）。
// 改造前 App.tsx 静态 import 了 ~37 个页面（含管理后台 10 个、桌面 AI 站 8 个），
// 全部被打包进单个 index-*.js（实测 1.4MB）。冷启动下载+解析极慢，移动端首屏可达 30s+。
// 改为 React.lazy 后：
//   - 首屏只下载 shell + 当前路由 chunk，其它按需加载。
//   - 管理后台（Dashboard/Users/TaskAudit 等）只在管理员进入时才下载，省去一大块。
//   - 桌面 AI 站（Home/AISearch/AITangdou 等）只在桌面或 AI 功能时下载。
// 首页（WeChatHome）的视觉布局/样式完全不变——仅在 chunk 下载期间显示几十~几百毫秒的占位。
const Home          = safeLazy(() => import('./pages/Home'))
const AISearch      = safeLazy(() => import('./pages/AISearch'))
const AITangdou     = safeLazy(() => import('./pages/AITangdou'))
const AITutor       = safeLazy(() => import('./pages/AITutor'))
const DocWorkshop   = safeLazy(() => import('./pages/DocWorkshop'))
const Warnings      = safeLazy(() => import('./pages/Warnings'))
const Money         = safeLazy(() => import('./pages/Money'))
const About         = safeLazy(() => import('./pages/About'))

// 手机 H5 模块（同一套 URL，由 ResponsiveShell 按设备决定套哪个壳）
const WeChatHome    = safeLazy(() => import('./pages/mobile/WeChatHome'))
const Splash        = safeLazy(() => import('./pages/mobile/Splash'))
const Login         = safeLazy(() => import('./pages/mobile/Login'))
const PublishTask   = safeLazy(() => import('./pages/mobile/PublishTask'))
const TaskDetail    = safeLazy(() => import('./pages/mobile/TaskDetail'))
const GoodsList     = safeLazy(() => import('./pages/mobile/GoodsList'))
const GoodsDetail   = safeLazy(() => import('./pages/mobile/GoodsDetail'))
const PublishGoods  = safeLazy(() => import('./pages/mobile/PublishGoods'))
const Community     = safeLazy(() => import('./pages/mobile/Community'))
const PostDetail    = safeLazy(() => import('./pages/mobile/PostDetail'))
const PublishPost   = safeLazy(() => import('./pages/mobile/PublishPost'))
const Messages      = safeLazy(() => import('./pages/mobile/Messages'))
const Notifications = safeLazy(() => import('./pages/mobile/Notifications'))
const MyTasks       = safeLazy(() => import('./pages/mobile/MyTasks'))
const AIHistory     = safeLazy(() => import('./pages/mobile/AIHistory'))
const Wallet        = safeLazy(() => import('./pages/mobile/Wallet'))
const Mine          = safeLazy(() => import('./pages/mobile/Mine'))
const FeatureNotify = safeLazy(() => import('./pages/mobile/FeatureNotify'))
const News          = safeLazy(() => import('./pages/mobile/News'))
const MobileMoney   = safeLazy(() => import('./pages/mobile/Money'))
const ThemePreview  = safeLazy(() => import('./pages/mobile/ThemePreview'))
const Settings      = safeLazy(() => import('./pages/mobile/Settings'))
const Discover      = safeLazy(() => import('./pages/mobile/Discover'))
const Chat          = safeLazy(() => import('./pages/mobile/Chat'))

// PC 管理后台（同一平台内的模块，自身响应式）
const Dashboard     = safeLazy(() => import('./pages/admin/Dashboard'))
const Users         = safeLazy(() => import('./pages/admin/Users'))
const TaskAudit     = safeLazy(() => import('./pages/admin/TaskAudit'))
const GoodsAudit    = safeLazy(() => import('./pages/admin/GoodsAudit'))
const PostAudit     = safeLazy(() => import('./pages/admin/PostAudit'))
const Arbitration   = safeLazy(() => import('./pages/admin/Arbitration'))
const Withdraw      = safeLazy(() => import('./pages/admin/Withdraw'))
const Config        = safeLazy(() => import('./pages/admin/Config'))
const System        = safeLazy(() => import('./pages/admin/System'))
const FeatureChats  = safeLazy(() => import('./pages/admin/FeatureChats'))

// 路由切换时的加载占位（陶土红品牌色；只在 chunk 下载期间出现一帧）
function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ededed]">
      <div className="w-7 h-7 border-[3px] border-[#D8451F]/30 border-t-[#D8451F] rounded-full animate-spin" />
    </div>
  )
}

// 生产级兜底：任一路由子树渲染抛错时，显示错误而不是整页白屏（也方便定位问题）。
// 特例：部署新版本后旧 chunk 404（Failed to fetch dynamically imported module）——
// 这类错误用户自己刷新一下就能好，所以给一个明确的「刷新」按钮而不是一屏报错堆栈。
const CHUNK_ERR_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \d+ failed/i
class ErrorBoundary extends Component<{ children: ReactNode }, { err: any }> {
  state = { err: null as any }
  static getDerivedStateFromError(err: any) { return { err } }
  componentDidCatch(err: any) {
    console.error('[AppError]', err)
    // 旧 chunk 失效：自动刷新一次拿新版本（防循环逻辑在 safeLazy 内）
    if (CHUNK_ERR_RE.test(String(err?.message || err))) reloadForNewVersion()
  }
  render() {
    if (this.state.err) {
      const isChunkErr = CHUNK_ERR_RE.test(String(this.state.err?.message || this.state.err))
      if (isChunkErr) {
        return (
          <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#1c1814', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>页面已更新</div>
            <div style={{ fontSize: 13, color: '#6b6258', marginBottom: 16 }}>
              检测到新版本，点一下即可继续使用
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '10px 20px', borderRadius: 4, border: 0, background: '#c2410c', color: '#fff', fontSize: 14 }}
            >
              刷新页面
            </button>
          </div>
        )
      }
      return (
        <div style={{ padding: 20, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#b00' }}>
          渲染错误：{String(this.state.err?.stack || this.state.err)}
        </div>
      )
    }
    return this.props.children
  }
}

// 设备自适应壳：检测到手机就套 H5 手机壳（底栏），否则套桌面壳（顶栏）。
// 同一套 URL、同一套功能，只是外壳不同——这就是「一个平台」。
function ResponsiveShell() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileLayout /> : <Layout />
}

// 手机端首页用微信聊天列表界面，PC 端首页保持原样
function DeviceHome() {
  const isMobile = useIsMobile()
  return isMobile ? <WeChatHome /> : <Home />
}

// 搞钱项目：桌面端走宽屏版 Money，手机端走紧凑 H5 版（避免桌面双栏页被塞进手机壳）
function DeviceMoney() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileMoney /> : <Money />
}

export default function App() {
  const loc = useLocation()
  const isMobile = useIsMobile()
  const nav = useNavigate()

  // 动态设置浏览器标签标题
  useEffect(() => {
    const p = loc.pathname
    let title = ROUTE_TITLES[p]
    if (!title) {
      if (p.startsWith('/admin')) title = '择校通 · 管理后台'
      else title = '择校通'
    }
    document.title = title
  }, [loc.pathname])

  // 首页（PC 端）加暖色主题 class；其它页面（包括手机端）走黑白灰
  useEffect(() => {
    const isHome = loc.pathname === '/' && !isMobile
    document.body.classList.toggle('theme-home', isHome)
    return () => document.body.classList.remove('theme-home')
  }, [loc.pathname, isMobile])

  // 微信式默认行为：页面冷加载（刷新 / 直接打开站点）时回到微信首页（聊天列表），
  // 不停留在某个聊天（糖豆 / 百事通等）。仅在首次加载执行一次，不影响站内导航。
  useEffect(() => {
    const p = loc.pathname
    const keep = p === '/' || p === '/splash' || p === '/login' || p === '/theme-preview' || p.startsWith('/admin')
    if (!keep) nav('/', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loc.pathname === '/jobs') return <Navigate to="/ai-search" replace />
  if (loc.pathname === '/history') return <Navigate to="/ai-search?openHistory=1" replace />
  if (loc.pathname === '/chat-room') return <Navigate to="/ai-search" replace />
  if (loc.pathname === '/doc-history') return <Navigate to="/document-workshop" replace />

  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* 手机版 UI 主题预览页（独立页，自带手机壳，不在 ResponsiveShell 内叠加） */}
          <Route path="/theme-preview" element={<ThemePreview />} />
          {/* 管理后台：同一个平台内的独立模块，自身响应式（手机上侧栏变顶部条） */}
          <Route path="/admin/*" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="tasks" element={<TaskAudit />} />
            <Route path="goods" element={<GoodsAudit />} />
            <Route path="posts" element={<PostAudit />} />
            <Route path="arbitration" element={<Arbitration />} />
            <Route path="withdraw" element={<Withdraw />} />
            <Route path="config" element={<Config />} />
            <Route path="feature-chats" element={<FeatureChats />} />
            <Route path="system" element={<System />} />
          </Route>

          {/* 统一前台：同一套 URL，设备自适应切换手机壳 / 桌面壳 */}
          <Route element={<ResponsiveShell />}>
            <Route index element={<DeviceHome />} />
            <Route path="splash" element={<Splash />} />
            <Route path="login" element={<Login />} />
            <Route path="publish" element={<PublishTask />} />
            <Route path="task/:id" element={<TaskDetail />} />
            <Route path="goods" element={<GoodsList />} />
            <Route path="goods/:id" element={<GoodsDetail />} />
            <Route path="publish-goods" element={<PublishGoods />} />
            <Route path="community" element={<Community />} />
            <Route path="post/:id" element={<PostDetail />} />
            <Route path="publish-post" element={<PublishPost />} />
            <Route path="messages" element={<Messages />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="my-tasks" element={<MyTasks />} />
            <Route path="ai-history" element={<AIHistory />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="mine" element={<Mine />} />
            <Route path="settings" element={<Settings />} />
            <Route path="discover" element={<Discover />} />
            {/* AI 聊天（多角色 + 图片/视频生成 + 历史会话），此前零引用，现接入 */}
            <Route path="chat" element={<Navigate to="/chat/tangdou" replace />} />
            <Route path="chat/:type" element={<Chat />} />
            {/* 功能通知聊天层：首页每个功能块点进去先到这里，再「打开完整功能」 */}
            <Route path="m/notify/:id" element={<FeatureNotify />} />
            <Route path="news" element={<News />} />
            {/* 原桌面 AI 功能：手机端也走同一 URL，在手机壳里渲染 */}
            <Route path="ai-search" element={<AISearch />} />
            <Route path="ai-tangdou" element={<AITangdou />} />
            <Route path="ai-tutor" element={<AITutor />} />
            <Route path="document-workshop" element={<DocWorkshop />} />
            <Route path="warnings" element={<Warnings />} />
            <Route path="money" element={<DeviceMoney />} />
            <Route path="about" element={<About />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}