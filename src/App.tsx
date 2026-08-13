import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import AISearch from './pages/AISearch'
import AITutor from './pages/AITutor'
import DocWorkshop from './pages/DocWorkshop'
import Warnings from './pages/Warnings'
import Money from './pages/Money'
import About from './pages/About'

// 各路由对应的浏览器标签标题（简短、带「择校通」前缀，避免单页应用整站一个超长标题）
const ROUTE_TITLES: Record<string, string> = {
  '/': '择校通',
  '/ai-search': '择校通 · AI百事通',
  '/ai-tutor': '择校通 · AI择校导师',
  '/document-workshop': '择校通 · 文档工坊',
  '/warnings': '择校通 · 避雷清单',
  '/money': '择校通 · 搞钱项目',
  '/about': '择校通 · 关于'
}

// 顶部主导航（克制：4 个核心）
export const primaryNav: { to: string; label: string; icon: string; live?: boolean; end?: boolean }[] = [
  { to: '/', label: '首页', icon: '🏠', end: true },
  { to: '/ai-search', label: 'AI百事通', icon: '🧭', live: true },
  { to: '/ai-tutor', label: 'AI择校导师', icon: '', live: true },
  { to: '/document-workshop', label: '文档工坊', icon: '', live: true }
]

// 「更多」下拉里收纳的次要工具
export const moreNav: { to: string; label: string; icon: string }[] = [
  { to: '/warnings', label: '避雷清单', icon: '⚠️' },
  { to: '/money', label: '搞钱项目', icon: '💰' },
  { to: '/about', label: '关于我们', icon: 'ℹ️' }
]

export default function App() {
  const loc = useLocation()

  // 动态设置浏览器标签标题：按当前路径匹配，匹配不到用首页短标题兜底
  useEffect(() => {
    const title = ROUTE_TITLES[loc.pathname] || '择校通'
    document.title = title
  }, [loc.pathname])

  if (loc.pathname === '/jobs') return <Navigate to="/ai-search" replace />
  if (loc.pathname === '/history') return <Navigate to="/ai-search?openHistory=1" replace />
  if (loc.pathname === '/chat-room') return <Navigate to="/ai-search" replace />
  if (loc.pathname === '/doc-history') return <Navigate to="/document-workshop" replace />

  return (
    <Layout primaryNav={primaryNav} moreNav={moreNav}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ai-search" element={<AISearch />} />
        <Route path="/ai-tutor" element={<AITutor />} />
        <Route path="/document-workshop" element={<DocWorkshop />} />
        <Route path="/warnings" element={<Warnings />} />
        <Route path="/money" element={<Money />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
