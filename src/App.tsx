import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import AISearch from './pages/AISearch'
import AITutor from './pages/AITutor'
import DocWorkshop from './pages/DocWorkshop'
import Warnings from './pages/Warnings'
import Money from './pages/Money'

const navItems = [
  { to: '/', label: '首页', end: true },
  { to: '/ai-search', label: 'AI百事通' },
  { to: '/ai-tutor', label: '择校导师' },
  { to: '/document-workshop', label: '文档工坊' },
  { to: '/warnings', label: '避雷清单' },
  { to: '/money', label: '搞钱项目' }
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
