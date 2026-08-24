import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'
import { ShieldCheck, CheckCircle, XCircle } from 'lucide-react'

// 管理员账号（QQ号 + 密码，代码常量，库外）
const ADMIN_ACCOUNT = { qq: '18882632073', password: '110110nm' }

export default function Login() {
  const nav = useNavigate()
  const register = useStore(s => s.register)
  const signIn = useStore(s => s.signIn)
  const [qq, setQq] = useState('')
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [agree, setAgree] = useState(true)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isAdminQq = qq === ADMIN_ACCOUNT.qq

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 2500)
  }

  const qqOk = /^[1-9]\d{4,10}$/.test(qq)
  const pwdOk = pwd.length >= 6
  const matchOk = pwd === pwd2 && pwd.length > 0

  const submit = async () => {
    if (!agree) { showToast('err', '请先同意用户协议与隐私政策'); return }
    if (!qqOk) { showToast('err', 'QQ号格式不正确（5-11 位数字）'); return }

    setSubmitting(true)
    try {
      if (isAdminQq) {
        // 管理员：白名单 + 固定密码
        if (pwd !== ADMIN_ACCOUNT.password) {
          showToast('err', '管理员密码错误')
          return
        }
        await register(qq, pwd)  // 确保档案存在
        // 强制 admin 角色
        const st = useStore.getState()
        st.login(qq, 'admin')
        nav('/admin')
        return
      }

      // 普通用户：两层密码校验
      if (!pwdOk) { showToast('err', '密码至少 6 位'); setSubmitting(false); return }
      if (!matchOk) { showToast('err', '两次输入的密码不一致'); setSubmitting(false); return }

      // 先尝试登录（已注册），失败则注册
      const r1 = await signIn(qq, pwd)
      if (r1.ok) {
        showToast('ok', '登录成功')
        setTimeout(() => nav('/'), 600)
        return
      }
      // 账号不存在 → 注册
      const r2 = await register(qq, pwd)
      if (r2.ok) {
        showToast('ok', '注册成功')
        setTimeout(() => nav('/'), 600)
      } else {
        showToast('err', r2.msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app-shell flex flex-col px-6 pt-16" style={{ minHeight: '100vh' }}>
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <button onClick={() => nav(-1)} className="self-start text-gray-400 mb-6">‹ 返回</button>
      <h1 className="text-2xl font-black text-ink">QQ号登录 / 注册</h1>
      <p className="text-gray-500 text-sm mt-1">未注册QQ号将自动创建账号（密码用于登录校验）</p>

      <label className="mt-8 text-sm text-gray-600">QQ号</label>
      <input className="input mt-2" value={qq} onChange={e => setQq(e.target.value)} placeholder="请输入QQ号" inputMode="numeric" maxLength={11} />

      {isAdminQq && (
        <div className="mt-2 flex items-center gap-2 text-xs text-brand-600 bg-brand-50 px-3 py-2 rounded-lg">
          <ShieldCheck size={14} /> 管理员账号，请输入密码登录
        </div>
      )}

      <label className="mt-5 text-sm text-gray-600">
        {isAdminQq ? '管理员密码' : '设置密码'}
      </label>
      <input
        className="input mt-2"
        value={pwd}
        onChange={e => setPwd(e.target.value)}
        placeholder={isAdminQq ? '请输入管理员密码' : '至少 6 位'}
        type="password"
        maxLength={20}
      />

      {!isAdminQq && (
        <>
          <label className="mt-5 text-sm text-gray-600">确认密码</label>
          <input
            className="input mt-2"
            value={pwd2}
            onChange={e => setPwd2(e.target.value)}
            placeholder="再次输入密码"
            type="password"
            maxLength={20}
          />
          {pwd2.length > 0 && !matchOk && (
            <p className="text-xs text-red-500 mt-1">两次密码不一致</p>
          )}
          {pwd.length > 0 && !pwdOk && (
            <p className="text-xs text-red-500 mt-1">密码至少 6 位</p>
          )}
        </>
      )}

      <label className="mt-6 flex items-start gap-2 text-xs text-gray-500">
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5" />
        <span>我已阅读并同意《用户协议》与《隐私政策》，了解平台「先冻结后分账」的资金规则。</span>
      </label>

      <button className="btn-primary mt-8 w-full disabled:opacity-50" onClick={submit} disabled={submitting}>
        {submitting ? '处理中…' : (isAdminQq ? '管理员登录' : '登录 / 注册')}
      </button>
    </div>
  )
}
