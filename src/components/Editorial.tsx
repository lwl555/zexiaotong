import type { CSSProperties, ReactNode } from 'react'

/* =====================================================================
 * 白底编辑风版式组件库（2026-09-09 由暖陶土纸感底改为纯白 + 中性灰线）
 * 视觉语言：纯白底 #ffffff + 纯白卡 #ffffff + 墨黑 #1c1814 +
 *          陶土 #c2410c 唯一彩色强调 + 1px 中性灰线边框 #e8e8e8（无粗边/无硬阴影）+
 *          等宽 eyebrow + 编号索引。手机/PC 同一张脸。
 * 组件全部内联 style，自洽、不依赖 styles.css 的 card/brand 体系。
 * ===================================================================== */

export const INK = '#1c1814'
export const PAPER = '#ffffff'
export const PAPER_BG = '#ffffff' // 页面纯白底
export const LINE = '#e8e8e8' // 1px 中性灰线边框
export const MUTED = '#6b6b6b'
export const FAINT = '#9a9a9a'
export const HAIR = 'rgba(0,0,0,0.08)' // 细发丝线（密集列表分隔，中性）
export const ACCENT = '#c2410c' // 陶土：唯一彩色强调（品牌动作/编号/激活）
export const ACCENT_SOFT = '#fbeede' // 陶土浅底
export const FONT =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Heiti SC", "微软雅黑", sans-serif'
export const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", Menlo, Consolas, monospace'
// 财务语义色（仅用于流水正负，不破坏"唯一彩色"原则下的可读性原则）
export const POS = '#15803d'
export const NEG = '#c2410c'

// 编辑风卡：1px 中性灰线 + 微圆角 + 极轻投影（全站统一卡面）
export function hard(extra: CSSProperties = {}): CSSProperties {
  return { border: `1px solid ${LINE}`, borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', ...extra }
}

// 幽灵按钮：1px 暖线 + 暖墨字
export function btnGhost(extra: CSSProperties = {}): CSSProperties {
  return {
    border: `1px solid ${LINE}`,
    borderRadius: 4,
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
            fontSize: 'clamp(22px, 6vw, 30px)',
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
export function SoftCard({
  children,
  style,
  onClick,
}: {
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: PAPER,
        border: `1px solid ${HAIR}`,
        borderRadius: 3,
        padding: 16,
        ...(onClick ? { cursor: 'pointer' } : null),
        ...style,
      }}
    >
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

export function ListRow({
  children,
  style,
  onClick,
}: {
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 2px',
        borderBottom: `1px solid ${HAIR}`,
        ...(onClick ? { cursor: 'pointer' } : null),
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
