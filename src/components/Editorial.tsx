import type { CSSProperties, ReactNode } from 'react'

/* =====================================================================
 * PC 白底结合版版式组件库（2026-08-30 确立）
 * 视觉语言：白底 + 墨黑（文字/边框）+ 陶土红唯一彩色强调 +
 *          粗黑边 3px + 克制硬阴影 + 等宽 eyebrow + 大字号系统无衬线 +
 *          编号索引 01/02。与手机版「白底结合版」同一张脸。
 * 组件全部内联 style，自洽、不依赖 styles.css 的 card/brand 体系，
 * 便于在各 mobile/* 页面（被 Layout 包进 1200px 宽屏）下直接复用。
 * ===================================================================== */

export const INK = '#111111'
export const PAPER = '#ffffff'
export const MUTED = '#6b6258' // 次级文字（沿用 theme-home 暖灰，白底下不刺眼）
export const FAINT = '#9a9085'
export const HAIR = 'rgba(17,17,17,0.12)' // 细黑发丝线（密集列表分隔）
export const ACCENT = '#D8451F' // 陶土红：唯一彩色强调（品牌动作/编号/激活）
export const ACCENT_SOFT = '#fbeede' // 陶土浅底
export const FONT =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Heiti SC", "微软雅黑", sans-serif'
export const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", Menlo, Consolas, monospace'
// 财务语义色（仅用于流水正负，不破坏"唯一彩色"原则下的可读性原则）
export const POS = '#15803d'
export const NEG = '#D8451F'

// 硬边卡：粗黑边 + 无模糊实色硬阴影（克制使用：Hero / 主卡 / CTA）
export function hard(extra: CSSProperties = {}): CSSProperties {
  return { border: `3px solid ${INK}`, borderRadius: 2, boxShadow: `5px 5px 0 ${INK}`, ...extra }
}

// 粗黑描边按钮（幽灵）
export function btnGhost(extra: CSSProperties = {}): CSSProperties {
  return {
    border: `2px solid ${INK}`,
    borderRadius: 2,
    background: PAPER,
    color: INK,
    fontFamily: FONT,
    fontWeight: 600,
    cursor: 'pointer',
    ...extra,
  }
}

export function PageHeader({
  eyebrow,
  title,
  desc,
  right,
}: {
  eyebrow?: string
  title: string
  desc?: string
  right?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}
    >
      <div>
        {eyebrow && (
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: 3,
              color: ACCENT,
              marginBottom: 6,
            }}
          >
            {eyebrow.toUpperCase()}
          </div>
        )}
        <h1
          style={{
            fontFamily: FONT,
            fontSize: 30,
            fontWeight: 800,
            color: INK,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {desc && (
          <p
            style={{
              fontFamily: FONT,
              fontSize: 14,
              color: MUTED,
              marginTop: 8,
              marginBottom: 0,
              maxWidth: 560,
              lineHeight: 1.6,
            }}
          >
            {desc}
          </p>
        )}
      </div>
      {right && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{right}</div>}
    </div>
  )
}

export function SectionLabel({ index, label }: { index?: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '4px 0 12px' }}>
      {index && (
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: ACCENT }}>{index}</span>
      )}
      <span
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: 2.5,
          color: ACCENT,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  )
}

export function HardCard({
  children,
  style,
  onClick,
}: {
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
}) {
  return (
    <div onClick={onClick} style={{ ...hard(), background: PAPER, padding: 18, ...style }}>
      {children}
    </div>
  )
}

// 细黑线分隔卡（密集列表项用，避免硬阴影脏重）
export function SoftCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: PAPER, border: `1px solid ${HAIR}`, borderRadius: 3, padding: 16, ...style }}>
      {children}
    </div>
  )
}

// 自适应多列网格（宽屏多列、窄屏自动降列，无需 media query）
export function IndexGrid({ children, min = 260 }: { children: ReactNode; min?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
        gap: 14,
      }}
    >
      {children}
    </div>
  )
}

export function ListRow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 2px',
        borderBottom: `1px solid ${HAIR}`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Tag({ children, tone = 'line' }: { children: ReactNode; tone?: 'line' | 'accent' | 'ink' }) {
  const c: CSSProperties =
    tone === 'accent'
      ? { border: `1.5px solid ${ACCENT}`, color: ACCENT, background: ACCENT_SOFT }
      : tone === 'ink'
      ? { border: `1.5px solid ${INK}`, color: INK, background: PAPER }
      : { border: `1px solid ${HAIR}`, color: MUTED, background: 'transparent' }
  return (
    <span
      style={{
        ...c,
        fontFamily: MONO,
        fontSize: 10.5,
        letterSpacing: 1,
        padding: '3px 7px',
        borderRadius: 2,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export function BtnPrimary({
  children,
  onClick,
  style,
}: {
  children: ReactNode
  onClick?: () => void
  style?: CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...hard({ padding: '9px 16px', fontSize: 14, fontWeight: 700, color: PAPER, background: ACCENT, fontFamily: FONT }),
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function BtnGhost({
  children,
  onClick,
  style,
}: {
  children: ReactNode
  onClick?: () => void
  style?: CSSProperties
}) {
  return (
    <button onClick={onClick} style={{ ...btnGhost({ padding: '8px 15px', fontSize: 14 }), ...style }}>
      {children}
    </button>
  )
}

// 大数字统计块（钱包等数据页）
export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ ...hard(), background: PAPER, padding: '16px 18px' }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10.5,
          letterSpacing: 2,
          color: MUTED,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 28,
          fontWeight: 800,
          color: INK,
          marginTop: 6,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  )
}
