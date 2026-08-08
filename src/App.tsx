import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import AISearch from './pages/AISearch'
import AITutor from './pages/AITutor'
import DocWorkshop from './pages/DocWorkshop'
import Warnings from './pages/Warnings'
import Money from './pages/Money'

// icon：功能图标；live：是否为 AI 实时联网功能（顶部显示在线脉冲点）
const navItems: { to: string; label: string; icon: string; live?: boolean; end?: boolean }[] = [
  { to: '/', label: '首页', icon: '🏠', end: true },
  { to: '/ai-search', label: 'AI百事通', icon: '🧭', live: true },
  { to: '/ai-tutor', label: '择校导师', icon: '🎓', live: true },
  { to: '/document-workshop', label: '文档工坊', icon: '📝' },
  { to: '/warnings', label: '避雷清单', icon: '⚠️' },
  { to: '/money', label: '搞钱项目', icon: '💰' }
]

export default function App() {
  const loc = useLocation()
  // /jobs 重定向到 AI百事通（找工作复用 AI百事通）
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export { navItems }
