import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import AISearch from './pages/AISearch'
import AITutor from './pages/AITutor'
import DocWorkshop from './pages/DocWorkshop'
import Warnings from './pages/Warnings'
import Money from './pages/Money'
import About from './pages/About'

// icon：功能图标；live：是否为 AI 实时联网功能（顶部显示在线脉冲点）
export const navItems: { to: string; label: string; icon: string; live?: boolean; end?: boolean }[] = [
  { to: '/', label: '首页', icon: '🏠', end: true },
  { to: '/ai-search', label: 'AI百事通', icon: '🧭', live: true },
  { to: '/ai-tutor', label: 'AI择校导师', icon: '🎓', live: true },
  { to: '/document-workshop', label: '文档工坊', icon: '📝', live: true },
  { to: '/history', label: '历史记录', icon: '📚' },
  { to: '/chat-room', label: '聊天大厅', icon: '💬' },
  { to: '/warnings', label: '避雷清单', icon: '⚠️' },
  { to: '/doc-history', label: '文档历史', icon: '🗂️' },
  { to: '/about', label: '关于我们', icon: 'ℹ️' },
  { to: '/money', label: '搞钱项目', icon: '💰' }
]

export default function App() {
  const loc = useLocation()
  // 旧 /jobs 重定向到 AI百事通
  if (loc.pathname === '/jobs') return <Navigate to="/ai-search" replace />

  return (
    <Layout navItems={navItems}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ai-search" element={<AISearch />} />
        <Route path="/ai-tutor" element={<AITutor />} />
        <Route path="/document-workshop" element={<DocWorkshop />} />
        <Route path="/warnings" element={<Warnings />} />
        <Route path="/money" element={<Money />} />
        <Route path="/history" element={<Navigate to="/ai-search?openHistory=1" replace />} />
        <Route path="/chat-room" element={<Navigate to="/ai-search" replace />} />
        <Route path="/doc-history" element={<Navigate to="/document-workshop" replace />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
