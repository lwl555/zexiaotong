import { useNavigate } from 'react-router-dom'
import { Construction } from 'lucide-react'

export default function Placeholder({ title, desc, admin }: { title: string; desc?: string; admin?: boolean }) {
  const nav = useNavigate()
  return (
    <div className={admin ? 'text-center py-24 text-gray-400' : 'app-shell flex flex-col items-center justify-center px-8 text-center'}>
      <Construction size={admin ? 40 : 48} className="text-gray-300 mb-4" />
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {desc && <p className="text-sm text-gray-400 mt-2 max-w-xs">{desc}</p>}
      <p className="text-xs text-gray-300 mt-3">该模块已规划，本轮先交付可交互核心闭环，后续轮次补全。</p>
      <button className="btn-ghost mt-6" onClick={() => nav(admin ? '/admin' : '/')}>返回{admin ? '看板' : '首页'}</button>
    </div>
  )
}
