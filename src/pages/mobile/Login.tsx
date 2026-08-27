import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'
import { CheckCircle, XCircle } from 'lucide-react'
import { useIsMobile } from '../../lib/useIsMobile'

// 管理员不再硬编码：登录走统一 loginPwd，系统按 profiles.role 字段识别 admin
const QQ_RE = /^[1-9]\d{4,10}$/
// 密码两层验证 - 第一层：强度规则（6-20 位，含字母 + 数字）
const PWD_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{6,20}$/

function AuthForm({ mobile }: { mobile: boolean }) {
  const nav = useNavigate()
  const register = useStore((s) => s.register)
  const loginPwd = useStore((s) => s.loginPwd)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [qq, setQq] = useState('')
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agree, setAgree] = useState(true)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 2600)
  }

  const submit = async () => {
    if (!QQ_RE.test(qq)) { showToast('err', 'QQ号格式不正确（5-11 位数字，首位非 0）'); return }
    if (mode === 'register') {
      // 第二层：两次输入一致
      if (pwd !== confirm) { showToast('err', '两次输入的密码不一致'); return }
      // 第一层：强度规则
      if (!PWD_RE.test(pwd)) { showToast('err', '密码需 6-20 位，且同时包含字母和数字'); return }
      if (!agree) { showToast('err', '请先同意用户协议与隐私政策'); return }
      setLoading(true)
      try {
        await register(qq, pwd)
        showToast('ok', '注册成功，已自动登录')
        setTimeout(() => nav('/'), 600)
      } catch (e: any) {
        showToast('err', e?.message || '注册失败')
      } finally { setLoading(false) }
    } else {
      if (!pwd) { showToast('err', '请输入密码'); return }
      setLoading(true)
      try {
        await loginPwd(qq, pwd)
        const me = useStore.getState().me
        showToast('ok', '登录成功')
        setTimeout(() => nav(me?.role === 'admin' ? '/admin' : '/'), 500)
      } catch (e: any) {
        showToast('err', e?.message || '登录失败')
      } finally { setLoading(false) }
    }
  }

  return (
    <div className="flex flex-col">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {mobile && <button onClick={() => nav(-1)} className="self-start text-gray-400 mb-6">‹ 返回</button>}
      {mobile && <h1 className="text-2xl font-black text-ink">QQ号登录</h1>}
      {mobile && <p className="text-gray-500 text-sm mt-1">使用QQ号与密码登录或注册</p>}

      <div className="auth-tabs mt-6">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>登录</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>注册</button>
      </div>

      <label className="mt-6 text-sm text-gray-600">QQ号</label>
      <input className="input mt-2" value={qq} onChange={(e) => setQq(e.target.value)} placeholder="请输入QQ号" inputMode="numeric" maxLength={11} />

      <label className="mt-5 text-sm text-gray-600">密码</label>
      <input className="input mt-2" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder={mode === 'register' ? '6-20 位，含字母和数字' : '请输入密码'} type="password" maxLength={20} />

      {mode === 'register' && (
        <>
          <label className="mt-5 text-sm text-gray-600">确认密码</label>
          <input className="input mt-2" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次输入密码" type="password" maxLength={20} />
          <p className="auth-hint">密码两层验证：① 满足强度规则（6-20 位，含字母和数字）② 两次输入完全一致</p>
          <label className="mt-4 flex items-start gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            <span>我已阅读并同意《用户协议》与《隐私政策》，了解平台「先冻结后分账」的资金规则。</span>
          </label>
        </>
      )}

      <button className="btn-primary mt-8 w-full disabled:opacity-50" onClick={submit} disabled={loading}>
        {loading ? '处理中…' : mode === 'register' ? '注册并登录' : '登录'}
      </button>

      {mode === 'login' && (
        <button className="mt-3 text-sm text-gray-400 w-full text-center" onClick={() => setMode('register')}>
          没有账号？去注册
        </button>
      )}
      {mode === 'register' && (
        <button className="mt-3 text-sm text-gray-400 w-full text-center" onClick={() => setMode('login')}>
          已有账号？去登录
        </button>
      )}
    </div>
  )
}

export default function Login() {
  const isMobile = useIsMobile()
  if (!isMobile) {
    // PC 专属居中卡片
    return (
      <div className="pc-login">
        <div className="pc-login-card">
          <div className="pc-login-brand">
            <div className="pc-login-logo">择</div>
            <div>
              <div className="pc-login-title">择校通</div>
              <div className="pc-login-sub">校园综合服务平台 · 登录 / 注册</div>
            </div>
          </div>
          <AuthForm mobile={false} />
          <div className="pc-login-foot">真实 · 直接 · 不客气</div>
        </div>
      </div>
    )
  }
  // 手机端：竖排 H5 表单（壳由 MobileLayout 提供）
  return (
    <div className="app-shell flex flex-col px-6 pt-14" style={{ minHeight: '100vh' }}>
      <AuthForm mobile={true} />
    </div>
  )
}
