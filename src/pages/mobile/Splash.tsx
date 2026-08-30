import { useNavigate } from 'react-router-dom'
import { BtnPrimary, BtnGhost, INK, MUTED, FAINT, ACCENT, FONT, MONO } from '../../components/Editorial'

export default function Splash() {
  const nav = useNavigate()
  return (
    <div
      style={{
        padding: '40px 2px',
        maxWidth: 1200,
        margin: '0 auto',
        fontFamily: FONT,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          border: `3px solid ${INK}`,
          borderRadius: 2,
          background: '#fff',
          boxShadow: `5px 5px 0 ${INK}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 34,
          color: INK,
          marginBottom: 24,
        }}
      >
        择
      </div>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 3, color: ACCENT, marginBottom: 8 }}>ZEXIAOTONG</div>
      <h1 style={{ fontFamily: FONT, fontSize: 30, fontWeight: 800, color: INK, letterSpacing: '-0.02em', margin: 0 }}>择校通</h1>
      <p style={{ fontFamily: FONT, fontSize: 14, color: MUTED, marginTop: 10, marginBottom: 0 }}>发任务 · 接单赚零花 · 闲置变现</p>

      <div style={{ width: '100%', maxWidth: 360, marginTop: 32 }}>
        <BtnPrimary onClick={() => nav('/login')} style={{ width: '100%', padding: '12px', fontSize: 15 }}>
          登录 / 注册
        </BtnPrimary>
        <div style={{ height: 10 }} />
        <BtnGhost onClick={() => { try { localStorage.setItem('zex:skipSplash', '1') } catch {} nav('/') }} style={{ width: '100%', padding: '12px', fontSize: 15 }}>
          先逛逛
        </BtnGhost>
      </div>

      <p style={{ fontFamily: FONT, fontSize: 12, color: FAINT, marginTop: 28, lineHeight: 1.7 }}>
        登录即代表同意<br />《用户协议》《隐私政策》
      </p>
    </div>
  )
}
