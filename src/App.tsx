import { useEffect, Component, ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import MobileLayout from './components/layout/MobileLayout'
import AdminLayout from './components/layout/AdminLayout'
import { useIsMobile } from './lib/useIsMobile'
import { ROUTE_TITLES } from './lib/nav'

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

// 原桌面 AI 站点
import Home from './pages/Home'
import AISearch from './pages/AISearch'
import AITangdou from './pages/AITangdou'
import AITutor from './pages/AITutor'
import DocWorkshop from './pages/DocWorkshop'
import Warnings from './pages/Warnings'
import Money from './pages/Money'
import About from './pages/About'

// 手机 H5 模块（同一套 URL，由 ResponsiveShell 按设备决定套哪个壳）
import MobileHome from './pages/mobile/Home'
import Splash from './pages/mobile/Splash'
import Login from './pages/mobile/Login'
import PublishTask from './pages/mobile/PublishTask'
import TaskDetail from './pages/mobile/TaskDetail'
import GoodsList from './pages/mobile/GoodsList'
import GoodsDetail from './pages/mobile/GoodsDetail'
import PublishGoods from './pages/mobile/PublishGoods'
import Community from './pages/mobile/Community'
import PostDetail from './pages/mobile/PostDetail'
import PublishPost from './pages/mobile/PublishPost'
import Messages from './pages/mobile/Messages'
import Notifications from './pages/mobile/Notifications'
import MyTasks from './pages/mobile/MyTasks'
import Wallet from './pages/mobile/Wallet'
import Mine from './pages/mobile/Mine'

// PC 管理后台（同一平台内的模块，自身响应式）
import Dashboard from './pages/admin/Dashboard'
import Users from './pages/admin/Users'
import TaskAudit from './pages/admin/TaskAudit'
import GoodsAudit from './pages/admin/GoodsAudit'
import PostAudit from './pages/admin/PostAudit'
import Arbitration from './pages/admin/Arbitration'
import Withdraw from './pages/admin/Withdraw'
import Config from './pages/admin/Config'
import System from './pages/admin/System'

// 设备自适应壳：检测到手机就套 H5 手机壳（底栏），否则套桌面壳（顶栏）。
// 同一套 URL、同一套功能，只是外壳不同——这就是「一个平台」。
function ResponsiveShell() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileLayout /> : <Layout />
}

// 首页按设备选不同落地页（编辑式桌面首页 vs H5 首页），功能一致。
function DeviceHome() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileHome /> : <Home />
}

export default function App() {
  const loc = useLocation()

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

  if (loc.pathname === '/jobs') return <Navigate to="/ai-search" replace />
  if (loc.pathname === '/history') return <Navigate to="/ai-search?openHistory=1" replace />
  if (loc.pathname === '/chat-room') return <Navigate to="/ai-search" replace />
  if (loc.pathname === '/doc-history') return <Navigate to="/document-workshop" replace />

  return (
    <ErrorBoundary>
    <Routes>
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
        <Route path="wallet" element={<Wallet />} />
        <Route path="mine" element={<Mine />} />
        {/* 原桌面 AI 功能：手机端也走同一 URL，在手机壳里渲染 */}
        <Route path="ai-search" element={<AISearch />} />
        <Route path="ai-tangdou" element={<AITangdou />} />
        <Route path="ai-tutor" element={<AITutor />} />
        <Route path="document-workshop" element={<DocWorkshop />} />
        <Route path="warnings" element={<Warnings />} />
        <Route path="money" element={<Money />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </ErrorBoundary>
  )
}
