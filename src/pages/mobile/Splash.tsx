import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/* —— 一笔手绘学位帽：用 SVG 三段 path + stroke-dasharray 让其「画出来」 —— */
const SERIF = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Heiti SC","微软雅黑",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif'
const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,"Courier New",monospace'

export default function Splash() {
  const nav = useNavigate()

  // 入场序列状态：笔画完成 / 流苏圆点亮 / 文字渐入 / 按钮上滑 / footer 渐入
  const [drawn, setDrawn] = useState(false)
  const [tassel, setTassel] = useState(false)
  const [body, setBody] = useState(false)
  const [cta, setCta] = useState(false)
  const [foot, setFoot] = useState(false)

  const reduced = useRef(false)
  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced.current) {
      // 用户偏好减少动画 → 直接全部呈现
      setDrawn(true); setTassel(true); setBody(true); setCta(true); setFoot(true)
      return
    }

    const t1 = setTimeout(() => setDrawn(true), 1200)
    const t2 = setTimeout(() => setTassel(true), 1450)
    const t3 = setTimeout(() => setBody(true), 1650)
    const t4 = setTimeout(() => setCta(true), 2350)
    const t5 = setTimeout(() => setFoot(true), 2750)
    return () => { [t1, t2, t3, t4, t5].forEach(clearTimeout) }
  }, [])

  const goLogin = () => nav('/login')
  const skip = () => {
    try { localStorage.setItem('zex:skipSplash', '1') } catch {}
    nav('/')
  }

  return (
    <div
      className="relative"
      style={{
        minHeight: '100vh',
        background: '#f6f1e7',          // 暖纸白
        color: '#1a1a1a',
        overflow: 'hidden',
        fontFamily: SERIF
      }}
    >
      {/* 主层：flex column 三段（顶部 spacer / logo+文字 / 底部 spacer） */}
      <div
        className="flex flex-col items-center"
        style={{
          minHeight: '100vh',
          padding: '96px 32px 28px',
          justifyContent: 'space-between'
        }}
      >
        {/* 顶部留白（让 logo 自然下沉到上 1/3） */}
        <div />

        {/* —— Logo：单笔手绘学位帽 —— */}
        <div className="flex justify-center" style={{ marginBottom: 32 }}>
          <svg
            width="190"
            height="120"
            viewBox="0 0 190 120"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* 帽顶：扁菱形（左右两顶点 + 中央尖） */}
            <path
              d="M 26 50 L 95 24 L 164 50 L 95 76 Z"
              fill="none"
              stroke="#1a1a1a"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 380,
                strokeDashoffset: drawn ? 0 : 380,
                transition: 'stroke-dashoffset 1.0s cubic-bezier(0.65, 0, 0.35, 1)'
              }}
            />
            {/* 帽底：梯形 + 短底边 */}
            <path
              d="M 52 60 L 95 78 L 138 60 L 138 78 L 95 96 L 52 78 Z"
              fill="none"
              stroke="#1a1a1a"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 260,
                strokeDashoffset: drawn ? 0 : 260,
                transition: 'stroke-dashoffset 0.9s cubic-bezier(0.65, 0, 0.35, 1) 0.1s'
              }}
            />
            {/* 流苏绳：从帽底右顶点垂下 */}
            <path
              d="M 138 78 L 162 78 L 162 96"
              fill="none"
              stroke="#1a1a1a"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 70,
                strokeDashoffset: drawn ? 0 : 70,
                transition: 'stroke-dashoffset 0.45s cubic-bezier(0.65, 0, 0.35, 1) 0.25s'
              }}
            />
            {/* 流苏圆珠：暖陶土橙，弹入 */}
            <circle
              cx="162"
              cy="100"
              r="4.6"
              fill="#c2410c"
              style={{
                opacity: tassel ? 1 : 0,
                transform: tassel ? 'scale(1)' : 'scale(0.3)',
                transformOrigin: '162px 100px',
                transition:
                  'opacity 0.3s ease, transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            />
          </svg>
        </div>

        {/* —— 中部：标题 + eyebrow + 短橙线 + 主按钮 + 次链接 —— */}
        <div className="w-full" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* 衬线主标题：加 letter-spacing，模拟截图字间距 */}
          <h1
            className="select-none"
            style={{
              fontFamily: SERIF,
              fontSize: 56,
              fontWeight: 400,
              letterSpacing: 10,
              lineHeight: 1,
              margin: 0,
              color: '#1a1a1a',
              opacity: body ? 1 : 0,
              transform: body ? 'translateY(0)' : 'translateY(14px)',
              transition:
                'opacity 0.7s ease, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            择校通
          </h1>

          {/* 等宽 eyebrow */}
          <div
            style={{
              marginTop: 18,
              fontFamily: MONO,
              fontSize: 12,
              letterSpacing: 6,
              color: '#888',
              opacity: body ? 1 : 0,
              transform: body ? 'translateY(0)' : 'translateY(8px)',
              transition:
                'opacity 0.7s ease 0.08s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.08s'
            }}
          >
            GRADUATION, SIMPLIFIED.
          </div>

          {/* 短橙线 */}
          <div
            style={{
              width: 64,
              height: 1.5,
              background: '#c2410c',
              marginTop: 26,
              opacity: body ? 1 : 0,
              transform: body ? 'scaleX(1)' : 'scaleX(0)',
              transformOrigin: 'center',
              transition:
                'opacity 0.5s ease 0.18s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.18s'
            }}
          />

          {/* 主按钮（直角黑底） */}
          <button
            onClick={goLogin}
            className="select-none"
            style={{
              display: 'block',
              width: '100%',
              maxWidth: 480,
              marginTop: 30,
              height: 52,
              background: '#1a1a1a',
              color: '#fff',
              border: 'none',
              borderRadius: 0, // 直角
              fontFamily: MONO,
              fontSize: 14,
              letterSpacing: 8,
              cursor: 'pointer',
              opacity: cta ? 1 : 0,
              transform: cta ? 'translateY(0)' : 'translateY(18px)',
              boxShadow: cta
                ? '0 14px 28px -14px rgba(0,0,0,.5)'
                : '0 0 0 rgba(0,0,0,0)',
              transition:
                'opacity 0.65s ease, transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.65s ease, background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = '#2a2a2a'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 18px 32px -14px rgba(0,0,0,.55)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 14px 28px -14px rgba(0,0,0,.5)'
            }}
            onMouseDown={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(1px) scale(0.995)'
            }}
            onMouseUp={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
            }}
          >
            LOG IN / REGISTER
          </button>

          {/* 次链接：先逛逛（衬线 + 大间距） */}
          <button
            onClick={skip}
            className="select-none"
            style={{
              marginTop: 18,
              fontFamily: SERIF,
              fontSize: 16,
              letterSpacing: 10,
              color: '#777',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 12px',
              opacity: cta ? 1 : 0,
              transition: 'opacity 0.65s ease 0.1s, color 0.2s ease, letter-spacing 0.25s ease'
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = '#1a1a1a'
              ;(e.currentTarget as HTMLButtonElement).style.letterSpacing = '14px'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = '#777'
              ;(e.currentTarget as HTMLButtonElement).style.letterSpacing = '10px'
            }}
          >
            先 逛 逛
          </button>
        </div>

        {/* 底部 spacer */}
        <div />
      </div>

      {/* —— Footer：底部渐隐阴影 + 等宽小字 —— */}
      <div
        className="absolute left-0 right-0 text-center pointer-events-none"
        style={{
          bottom: 0,
          padding: '60px 16px 22px',
          background:
            'linear-gradient(to top, rgba(246,241,231,1) 0%, rgba(246,241,231,0) 100%)',
          opacity: foot ? 1 : 0,
          transition: 'opacity 0.8s ease'
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: 6,
            color: '#aaa'
          }}
        >
          <span style={{ color: '#c2410c', marginRight: 6 }}>#</span>
          ONE STROKE TO BEGIN
        </span>
      </div>
    </div>
  )
}
