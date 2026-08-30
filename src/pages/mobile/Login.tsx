import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'
import { CheckCircle, XCircle } from 'lucide-react'
import { useIsMobile } from '../../lib/useIsMobile'
import {
  BtnPrimary,
  btnGhost,
  hard,
  INK,
  MUTED,
  FAINT,
  ACCENT,
  FONT,
  MONO,
} from '../../components/Editorial'

// 管理员不再硬编码：登录走统一 loginPwd，系统按 profiles.role 字段识别 admin
const QQ_RE = /^[1-9]\d{4,10}$/
// 密码两层验证 - 第一层：强度规则（6-20 位，含字母 + 数字）
const PWD_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{6,20}$/

const inputStyle: CSSProperties = {
  width: '100%',
  border: `2px solid ${INK}`,
  borderRadius: 2,
  padding: '11px 12px',
  fontFamily: FONT,
  fontSize: 15,
  color: INK,
  outline: 'none',
  marginTop: 6,
  boxSizing: 'border-box',
  background: '#fff',
}

const labelStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: 10.5,
  letterSpacing: 2,
  color: MUTED,
  textTransform: 'uppercase',
  display: 'block',
  marginTop: 14,
}

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
    <div style={{ maxWidth: 420, margin: '0 auto', fontFamily: FONT }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 600,
            ...hard({ background: '#ffffff', color: toast.type === 'ok' ? ACCENT : INK }),
          }}
        >
          {toast.type === 'ok' ? <CheckCircle size={16} color={ACCENT} /> : <XCircle size={16} color={INK} />}
          {toast.msg}
        </div>
      )}

      {mobile && (
        <button
          onClick={() => nav(-1)}
          style={{ background: 'none', border: 'none', color: FAINT, fontFamily: FONT, fontSize: 14, cursor: 'pointer', marginBottom: 24 }}
        >
          ‹ 返回
        </button>
      )}

      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 3, color: ACCENT, marginBottom: 8 }}>AUTH</div>
      <h1 style={{ fontFamily: FONT, fontSize: 30, fontWeight: 800, color: INK, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>
        QQ号登录
      </h1>
      <p style={{ fontFamily: FONT, fontSize: 14, color: MUTED, marginTop: 8, marginBottom: 0 }}>使用QQ号与密码登录或注册</p>

      {/* tabs：粗黑边幽灵按钮，激活态陶土红填充 */}
      <div style={{ display: 'flex', gap: 10, marginTop: 22, marginBottom: 18 }}>
        <button
          onClick={() => setMode('login')}
          style={{ flex: 1, ...btnGhost({ padding: '9px 0', fontSize: 14, textAlign: 'center' }), ...(mode === 'login' ? { background: ACCENT, color: '#fff', borderColor: INK } : {}) }}
        >
          登录
        </button>
        <button
          onClick={() => setMode('register')}
          style={{ flex: 1, ...btnGhost({ padding: '9px 0', fontSize: 14, textAlign: 'center' }), ...(mode === 'register' ? { background: ACCENT, color: '#fff', borderColor: INK } : {}) }}
        >
          注册
        </button>
      </div>

      <label style={labelStyle}>QQ号</label>
      <input className="input" value={qq} onChange={(e) => setQq(e.target.value)} placeholder="请输入QQ号" inputMode="numeric" maxLength={11} style={inputStyle} />

      <label style={labelStyle}>密码</label>
      <input className="input" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder={mode === 'register' ? '6-20 位，含字母和数字' : '请输入密码'} type="password" maxLength={20} style={inputStyle} />

      {mode === 'register' && (
        <>
          <label style={labelStyle}>确认密码</label>
          <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次输入密码" type="password" maxLength={20} style={inputStyle} />
          <p style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 10, marginBottom: 0, lineHeight: 1.6 }}>
            密码两层验证：① 满足强度规则（6-20 位，含字母和数字）② 两次输入完全一致
          </p>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, fontFamily: FONT, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2 }} />
            <span>我已阅读并同意《用户协议》与《隐私政策》，了解平台「先冻结后分账」的资金规则。</span>
          </label>
        </>
      )}

      <button
        onClick={submit}
        disabled={loading}
        style={{ ...hard({ padding: '12px', fontSize: 15, fontWeight: 700, color: '#fff', background: ACCENT, fontFamily: FONT, width: '100%', marginTop: 20, opacity: loading ? 0.5 : 1, cursor: loading ? 'default' : 'pointer' }) }}
      >
        {loading ? '处理中…' : mode === 'register' ? '注册并登录' : '登录'}
      </button>

      {mode === 'login' && (
        <button
          onClick={() => setMode('register')}
          style={{ background: 'none', border: 'none', color: FAINT, fontFamily: FONT, fontSize: 13, marginTop: 14, width: '100%', cursor: 'pointer' }}
        >
          没有账号？去注册
        </button>
      )}
      {mode === 'register' && (
        <button
          onClick={() => setMode('login')}
          style={{ background: 'none', border: 'none', color: FAINT, fontFamily: FONT, fontSize: 13, marginTop: 14, width: '100%', cursor: 'pointer' }}
        >
          已有账号？去登录
        </button>
      )}
    </div>
  )
}

export default function Login() {
  const isMobile = useIsMobile()
  return (
    <div style={{ padding: isMobile ? '0' : '40px 2px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <div style={{ ...hard(), background: '#fff', padding: isMobile ? 20 : 32, maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${INK}`, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 20, color: INK }}>
            择
          </div>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: INK }}>择校通</div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, color: MUTED }}>校园综合服务平台</div>
          </div>
        </div>
        <AuthForm mobile={isMobile} />
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FAINT, textAlign: 'center', marginTop: 20 }}>真实 · 直接 · 不客气</div>
      </div>
    </div>
  )
}
