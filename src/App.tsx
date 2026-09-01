import { useEffect, Component, ReactNode, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import MobileLayout from './components/layout/MobileLayout'
import AdminLayout from './components/layout/AdminLayout'
import { useIsMobile } from './lib/useIsMobile'
import { ROUTE_TITLES } from './lib/nav'

// 性能优化：路由级 code splitting（v1）。
// 改造前 App.tsx 静态 import 了 ~37 个页面（含管理后台 10 个、桌面 AI 站 8 个），
// 全部被打包进单个 index-*.js（实测 1.4MB）。冷启动下载+解析极慢，移动端首屏可达 30s+。
// 改为 React.lazy 后：
//   - 首屏只下载 shell + 当前路由 chunk，其它按需加载。
//   - 管理后台（Dashboard/Users/TaskAudit 等）只在管理员进入时才下载，省去一大块。
//   - 桌面 AI 站（Home/AISearch/AITangdou 等）只在桌面或 AI 功能时下载。
// 首页（WeChatHome）的视觉布局/样式完全不变——仅在 chunk 下载期间显示几十~几百毫秒的占位。
const Home          = lazy(() => import('./pages/Home').then(m => ({ default: m.default })))
const AISearch      = lazy(() => import('./pages/AISearch').then(m => ({ default: m.default })))
const AITangdou     = lazy(() => import('./pages/AITangdou').then(m => ({ default: m.default })))
const AITutor       = lazy(() => import('./pages/AITutor').then(m => ({ default: m.default })))
const DocWorkshop   = lazy(() => import('./pages/DocWorkshop').then(m => ({ default: m.default })))
const Warnings      = lazy(() => import('./pages/Warnings').then(m => ({ default: m.default })))
const Money         = lazy(() => import('./pages/Money').then(m => ({ default: m.default })))
const About         = lazy(() => import('./pages/About').then(m => ({ default: m.default })))

// 手机 H5 模块（同一套 URL，由 ResponsiveShell 按设备决定套哪个壳）
const WeChatHome    = lazy(() => import('./pages/mobile/WeChatHome').then(m => ({ default: m.default })))
const Splash        = lazy(() => import('./pages/mobile/Splash').then(m => ({ default: m.default })))
const Login         = lazy(() => import('./pages/mobile/Login').then(m => ({ default: m.default })))
const PublishTask   = lazy(() => import('./pages/mobile/PublishTask').then(m => ({ default: m.default })))
const TaskDetail    = lazy(() => import('./pages/mobile/TaskDetail').then(m => ({ default: m.default })))
const GoodsList     = lazy(() => import('./pages/mobile/GoodsList').then(m => ({ default: m.default })))
const GoodsDetail   = lazy(() => import('./pages/mobile/GoodsDetail').then(m => ({ default: m.default })))
const PublishGoods  = lazy(() => import('./pages/mobile/PublishGoods').then(m => ({ default: m.default })))
const Community     = lazy(() => import('./pages/mobile/Community').then(m => ({ default: m.default })))
const PostDetail    = lazy(() => import('./pages/mobile/PostDetail').then(m => ({ default: m.default })))
const PublishPost   = lazy(() => import('./pages/mobile/PublishPost').then(m => ({ default: m.default })))
const Messages      = lazy(() => import('./pages/mobile/Messages').then(m => ({ default: m.default })))
const Notifications = lazy(() => import('./pages/mobile/Notifications').then(m => ({ default: m.default })))
const MyTasks       = lazy(() => import('./pages/mobile/MyTasks').then(m => ({ default: m.default })))
const AIHistory     = lazy(() => import('./pages/mobile/AIHistory').then(m => ({ default: m.default })))
const Wallet        = lazy(() => import('./pages/mobile/Wallet').then(m => ({ default: m.default })))
const Mine          = lazy(() => import('./pages/mobile/Mine').then(m => ({ default: m.default })))
const FeatureNotify = lazy(() => import('./pages/mobile/FeatureNotify').then(m => ({ default: m.default })))
const News          = lazy(() => import('./pages/mobile/News').then(m => ({ default: m.default })))
const MobileMoney   = lazy(() => import('./pages/mobile/Money').then(m => ({ default: m.default })))
const ThemePreview  = lazy(() => import('./pages/mobile/ThemePreview').then(m => ({ default: m.default })))
const Settings      = lazy(() => import('./pages/mobile/Settings').then(m => ({ default: m.default })))
const Chat          = lazy(() => import('./pages/mobile/Chat').then(m => ({ default: m.default })))

// PC 管理后台（同一平台内的模块，自身响应式）
const Dashboard     = lazy(() => import('./pages/admin/Dashboard').then(m => ({ default: m.default })))
const Users         = lazy(() => import('./pages/admin/Users').then(m => ({ default: m.default })))
const TaskAudit     = lazy(() => import('./pages/admin/TaskAudit').then(m => ({ default: m.default })))
const GoodsAudit    = lazy(() => import('./pages/admin/GoodsAudit').then(m => ({ default: m.default })))
const PostAudit     = lazy(() => import('./pages/admin/PostAudit').then(m => ({ default: m.default })))
const Arbitration   = lazy(() => import('./pages/admin/Arbitration').then(m => ({ default: m.default })))
const Withdraw      = lazy(() => import('./pages/admin/Withdraw').then(m => ({ default: m.default })))
const Config        = lazy(() => import('./pages/admin/Config').then(m => ({ default: m.default })))
const System        = lazy(() => import('./pages/admin/System').then(m => ({ default: m.default })))
const FeatureChats  = lazy(() => import('./pages/admin/FeatureChats').then(m => ({ default: m.default })))

// 路由切换时的加载占位（陶土红品牌色；只在 chunk 下载期间出现一帧）
function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ededed]">
      <div className="w-7 h-7 border-[3px] border-[#D8451F]/30 border-t-[#D8451F] rounded-full animate-spin" />
    </div>
  )
}

// 生产级兜底：任一路由子树渲染抛错时，显示错误而不是整页白屏（也方便定位问题）
class ErrorBoundary extends Component<{ children: ReactNode }, { err: any }> {
  state = { err: null as any }
  static getDerivedStateFromError(err: any) { return { err } }
  componentDidCatch(err: any) { console.error('[AppError]', err) }
  render() {
    if (this.state.err) {
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
            {/* AI 聊天（多角色 + 图片/视频生成 + 历史会话），此前零引用，现接入 */}
            <Route path="chat" element={<Chat />} />
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