import { useEffect, useRef, useState } from 'react'

/* —— 与手机版 Splash 同款：一笔手绘学位帽 + 衬线中文 + 等宽 eyebrow —— */
const SERIF = '"Songti SC","Noto Serif CJK SC",ui-serif,Georgia,"Times New Roman",serif'
const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,"Courier New",monospace'

export default function PcSplash({ onDone }: { onDone: () => void }) {
  const [drawn, setDrawn] = useState(false)
  const [tassel, setTassel] = useState(false)
  const [body, setBody] = useState(false)
  const [cta, setCta] = useState(false)
  const [foot, setFoot] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const doneRef = useRef(false)
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced.current) {
      setDrawn(true); setTassel(true); setBody(true); setCta(true); setFoot(true)
      return
    }

    const t1 = setTimeout(() => setDrawn(true), 1200)
    const t2 = setTimeout(() => setTassel(true), 1450)
    const t3 = setTimeout(() => setBody(true), 1650)
    const t4 = setTimeout(() => setCta(true), 2350)
    const t5 = setTimeout(() => setFoot(true), 2750)
    // 兜底：动画放完自动进入，绝不把用户卡在欢迎页
    const t6 = setTimeout(() => finish(), 4800)
    return () => { [t1, t2, t3, t4, t5, t6].forEach(clearTimeout) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    setLeaving(true)
    setTimeout(onDone, 700) // 与 CSS 淡出时长一致
  }

  return (
    <div
      className={'pc-splash' + (leaving ? ' leaving' : '')}
      role="dialog"
      aria-label="择校通"
    >
      <div className="pc-splash-stage">
        {/* —— Logo：单笔手绘学位帽（与手机版同款路径）—— */}
        <svg
          width="230"
          height="145"
          viewBox="0 0 190 120"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="pc-cap"
        >
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

        {/* 衬线主标题 */}
        <h1
          className="pc-title"
          style={{
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
          className="pc-eyebrow"
          style={{
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
          className="pc-line"
          style={{
            opacity: body ? 1 : 0,
            transform: body ? 'scaleX(1)' : 'scaleX(0)',
            transition:
              'opacity 0.5s ease 0.18s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.18s'
          }}
        />

        {/* 进入按钮（直角黑底） */}
        <button
          className="pc-enter"
          onClick={finish}
          style={{
            opacity: cta ? 1 : 0,
            transform: cta ? 'translateY(0)' : 'translateY(18px)',
            boxShadow: cta
              ? '0 14px 28px -14px rgba(0,0,0,.5)'
              : '0 0 0 rgba(0,0,0,0)',
            transition:
              'opacity 0.65s ease, transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.65s ease, background 0.2s ease'
          }}
        >
          进入择校通 →
        </button>
      </div>

      {/* Footer：渐隐 + 等宽小字 */}
      <div
        className="pc-foot"
        style={{ opacity: foot ? 1 : 0, transition: 'opacity 0.8s ease' }}
      >
        <span className="pc-foot-hash">#</span> ONE STROKE TO BEGIN
      </div>

      <style>{`
        .pc-splash {
          position: fixed; inset: 0; z-index: 9999;
          background: #f6f1e7;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          font-family: ${SERIF};
          opacity: 1;
          transition: opacity 0.7s ease;
        }
        .pc-splash.leaving { opacity: 0; pointer-events: none; }
        .pc-splash-stage {
          display: flex; flex-direction: column; align-items: center;
          text-align: center;
        }
        .pc-cap { display: block; margin-bottom: 34px; }
        .pc-title {
          font-family: ${SERIF};
          font-size: 60px; font-weight: 400; letter-spacing: 12px;
          line-height: 1; margin: 0; color: #1a1a1a;
        }
        .pc-eyebrow {
          margin-top: 20px;
          font-family: ${MONO};
          font-size: 12px; letter-spacing: 6px; color: #888;
        }
        .pc-line {
          width: 64px; height: 1.5px; background: #c2410c;
          margin-top: 26px; transform-origin: center;
        }
        .pc-enter {
          margin-top: 32px;
          display: inline-block;
          min-width: 260px; height: 52px; padding: 0 28px;
          background: #1a1a1a; color: #fff; border: none; border-radius: 0;
          font-family: ${MONO}; font-size: 14px; letter-spacing: 6px;
          cursor: pointer;
        }
        .pc-enter:hover { background: #2a2a2a; box-shadow: 0 18px 32px -14px rgba(0,0,0,.55) !important; }
        .pc-enter:active { transform: translateY(1px) scale(0.995) !important; }
        .pc-foot {
          position: absolute; left: 0; right: 0; bottom: 0;
          padding: 60px 16px 22px;
          text-align: center;
          background: linear-gradient(to top, rgba(246,241,231,1) 0%, rgba(246,241,231,0) 100%);
          font-family: ${MONO}; font-size: 11px; letter-spacing: 6px; color: #aaa;
          pointer-events: none;
        }
        .pc-foot-hash { color: #c2410c; margin-right: 6px; }
      `}</style>
    </div>
  )
}
