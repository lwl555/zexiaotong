import { useEffect, Component, ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import AdminLayout from './components/layout/AdminLayout'

// 生产级兜底
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

// 统一首页：所有设备看到同一个 Home，不根据设备切换
import Home from './pages/Home'
import AISearch from './pages/AISearch'
import AITangdou from './pages/AITangdou'
import AITutor from './pages/AITutor'
import DocWorkshop from './pages/DocWorkshop'
import Warnings from './pages/Warnings'
import Money from './pages/Money'
import About from './pages/About'

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

import Dashboard from './pages/admin/Dashboard'
import Users from './pages/admin/Users'
import TaskAudit from './pages/admin/TaskAudit'
import GoodsAudit from './pages/admin/GoodsAudit'
import PostAudit from './pages/admin/PostAudit'
import Arbitration from './pages/admin/Arbitration'
import Withdraw from './pages/admin/Withdraw'
import Config from './pages/admin/Config'
import System from './pages/admin/System'

export default function App() {
  const loc = useLocation()

  // 动态标题
  useEffect(() => {
    const p = loc.pathname
    const ROUTE_TITLES: Record<string, string> = {
      '/': '择校通',
      '/ai-search': '择校通 · 智能查询',
      '/ai-tangdou': '择校通 · 糖豆助手',
      '/ai-tutor': '择校通 · 实时资讯台',
      '/document-workshop': '择校通 · 文档工坊',
      '/warnings': '择校通 · 避雷清单',
      '/money': '择校通 · 搞钱项目',
      '/about': '择校通 · 关于我们',
      '/goods': '二手市场',
      '/community': '社区',
      '/mine': '我的',
      '/wallet': '钱包',
    }
    let title = ROUTE_TITLES[p] || '择校通'
    if (p.startsWith('/admin')) title = '择校通 · 管理后台'
    document.title = title
  }, [loc.pathname])

  // 首页暖色主题
  useEffect(() => {
    const isHome = loc.pathname === '/'
    document.body.classList.toggle('theme-home', isHome)
    return () => document.body.classList.remove('theme-home')
  }, [loc.pathname])

  if (loc.pathname === '/jobs') return <Navigate to="/ai-search" replace />
  if (loc.pathname === '/history') return <Navigate to="/ai-search?openHistory=1" replace />
  if (loc.pathname === '/chat-room') return <Navigate to="/ai-search" replace />
  if (loc.pathname === '/doc-history') return <Navigate to="/document-workshop" replace />

  return (
    <ErrorBoundary>
      <Routes>
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

        {/* 统一前台：同一套 URL、同一个 Layout，不再按设备切换外壳 */}
        <Route element={<Layout />}>
          <Route index element={<Home />} />
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
