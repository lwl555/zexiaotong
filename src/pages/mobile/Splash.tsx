import { useNavigate } from 'react-router-dom'

export default function Splash() {
  const nav = useNavigate()
  return (
    <div className="app-shell flex flex-col items-center justify-center px-8 text-center" style={{ minHeight: '100vh' }}>
      <div className="w-20 h-20 rounded-3xl bg-brand-500 flex items-center justify-center text-white text-3xl font-black mb-6 shadow-card">悬</div>
      <h1 className="text-2xl font-black text-ink">择校通</h1>
      <p className="text-gray-500 mt-2 text-sm">发任务 · 接单赚零花 · 闲置变现</p>
      <button className="btn-primary mt-10 w-full" onClick={() => nav('/login')}>登录 / 注册</button>
      <button className="btn-ghost mt-3 w-full" onClick={() => nav('/')}>先逛逛</button>
      <p className="text-xs text-gray-400 mt-8 leading-relaxed">登录即代表同意<br />《用户协议》《隐私政策》</p>
    </div>
  )
}
