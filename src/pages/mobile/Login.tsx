import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'

export default function Login() {
  const nav = useNavigate()
  const login = useStore(s => s.login)
  const [phone, setPhone] = useState('13800001234')
  const [code, setCode] = useState('')
  const [agree, setAgree] = useState(true)
  const [count, setCount] = useState(0)

  const sendCode = () => {
    if (!/^1\d{10}$/.test(phone)) { alert('手机号格式不正确'); return }
    setCount(60)
    const t = setInterval(() => setCount(c => { if (c <= 1) { clearInterval(t); return 0 } return c - 1 }), 1000)
  }

  const submit = () => {
    if (!agree) { alert('请先同意用户协议与隐私政策'); return }
    if (!/^1\d{10}$/.test(phone)) { alert('手机号格式不正确'); return }
    login(phone)
    nav('/')
  }

  return (
    <div className="app-shell flex flex-col px-6 pt-16" style={{ minHeight: '100vh' }}>
      <button onClick={() => nav(-1)} className="self-start text-gray-400 mb-6">‹ 返回</button>
      <h1 className="text-2xl font-black text-ink">手机号登录</h1>
      <p className="text-gray-500 text-sm mt-1">未注册手机号将自动创建账号</p>

      <label className="mt-8 text-sm text-gray-600">手机号</label>
      <input className="input mt-2" value={phone} onChange={e => setPhone(e.target.value)} placeholder="请输入手机号" inputMode="numeric" maxLength={11} />

      <label className="mt-5 text-sm text-gray-600">验证码</label>
      <div className="flex gap-3 mt-2">
        <input className="input flex-1" value={code} onChange={e => setCode(e.target.value)} placeholder="6 位验证码（演示任意填写）" inputMode="numeric" maxLength={6} />
        <button onClick={sendCode} disabled={count > 0} className="btn-ghost whitespace-nowrap w-28">
          {count > 0 ? count + 's' : '获取验证码'}
        </button>
      </div>

      <label className="mt-6 flex items-start gap-2 text-xs text-gray-500">
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5" />
        <span>我已阅读并同意《用户协议》与《隐私政策》，了解平台「先冻结后分账」的资金规则。</span>
      </label>

      <button className="btn-primary mt-8 w-full" onClick={submit}>一键登录 / 注册</button>
    </div>
  )
}
