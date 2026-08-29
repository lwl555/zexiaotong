import { useState } from 'react'

// 手机版主题预览 · 五套实时切换
// 第六版「白底结合版」整合图1（左文右图Hero + 杂志编号）+ 图2（一键查分大白卡 + 三功能入口 + 底部FAB）
type ThemeKey = 'white-mix' | 'white-hard' | 'white-min' | 'clay' | 'mono' | 'night'
interface Palette {
  name: string
  bg: string; surface: string; fg: string; muted: string
  line: string; accent: string; accentSoft: string; accentFg: string
  hero: string; shell: string; tabOn: string; tabBg: string
  eyebrow: string; ctaRadius: number
  borderW: number; hard: boolean
}

const THEMES: Record<ThemeKey, Palette> = {
  // ★ 新版：白底结合（图1+图2 融合）
  'white-mix': {
    name: '白底结合版',
    bg: '#ffffff', surface: '#ffffff', fg: '#111111', muted: '#6b6b6b',
    line: '#111111', accent: '#D8451F', accentSoft: '#fbe9e3', accentFg: '#ffffff',
    hero: '#efefef', shell: '#111111', tabOn: '#111111', tabBg: '#f3f1ec',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 2, borderW: 3, hard: true
  },
  'white-hard': {
    name: '白底硬边·砖红',
    bg: '#ffffff', surface: '#ffffff', fg: '#111111', muted: '#6b6b6b',
    line: '#111111', accent: '#D8451F', accentSoft: '#fbe9e3', accentFg: '#ffffff',
    hero: '#f4f4f4', shell: '#111111', tabOn: '#111111', tabBg: '#ffffff',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 2, borderW: 3, hard: true
  },
  'white-min': {
    name: '白底极简·墨黑',
    bg: '#ffffff', surface: '#ffffff', fg: '#111111', muted: '#8a8a8a',
    line: '#e6e6e6', accent: '#111111', accentSoft: '#f2f2f2', accentFg: '#ffffff',
    hero: '#f4f4f4', shell: '#e6e6e6', tabOn: '#111111', tabBg: '#ffffff',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 8, borderW: 2, hard: false
  },
  clay: {
    name: '暖陶土编辑风',
    bg: '#f7f5f0', surface: '#fffdf8', fg: '#1c1814', muted: '#6b6258',
    line: '#e3d9c6', accent: '#c2410c', accentSoft: '#fbeede', accentFg: '#ffffff',
    hero: '#e7e0d2', shell: '#ddd6c6', tabOn: '#c2410c', tabBg: '#f7f5f0',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 2, borderW: 1, hard: false
  },
  mono: {
    name: '墨黑极简风',
    bg: '#fafafa', surface: '#ffffff', fg: '#16181d', muted: '#9a9a9a',
    line: '#e2e2e2', accent: '#16181d', accentSoft: '#f0f0f0', accentFg: '#ffffff',
    hero: '#ececec', shell: '#e2e2e2', tabOn: '#16181d', tabBg: '#fafafa',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 2, borderW: 1, hard: false
  },
  night: {
    name: '暖炭暗调风',
    bg: '#1a1714', surface: '#221e19', fg: '#efe9dd', muted: '#8c8378',
    line: '#3a342c', accent: '#c2410c', accentSoft: '#2a251f', accentFg: '#efe9dd',
    hero: '#2a251f', shell: '#3a342c', tabOn: '#c2410c', tabBg: '#1a1714',
    eyebrow: 'NIGHT EDITION · 2026', ctaRadius: 2, borderW: 1, hard: false
  }
}

// 三功能入口（图2 风格：杂志编号 + 右侧 chevron）
const APPS: [string, string, string][] = [
  ['01', '院校库', '3200+ 所'],
  ['02', '志愿填报', '智能方案'],
  ['03', '录取追踪', '实时状态']
]

const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", sans-serif'

// 硬边卡片：粗黑边 + 无模糊实色阴影（neo-brutalism）
function card(t: Palette, radius = t.ctaRadius) {
  return {
    border: `${t.borderW}px solid ${t.fg}`,
    borderRadius: radius,
    boxShadow: t.hard ? '5px 5px 0 #111111' : 'none'
  } as const
}

export default function ThemePreview() {
  const [theme, setTheme] = useState<ThemeKey>('white-mix')
  const [tab, setTab] = useState(0)
  const t = THEMES[theme]
  const tabs = ['首页', '发现', '我的']
  const isNight = theme === 'night'
  const outerBg = isNight ? '#0f0d0b' : '#e8e4dd' // 桌面外底色稍深，让白卡浮起来
  const accent = t.accent
  const fg = t.fg
  const muted = t.muted

  return (
    <div style={{ minHeight: '100vh', background: outerBg, fontFamily: FONT, padding: '22px 12px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* 主题切换器 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720 }}>
        {(['white-mix', 'white-hard', 'white-min', 'clay', 'mono', 'night'] as ThemeKey[]).map(k => {
          const on = theme === k
          return (
            <button key={k} onClick={() => setTheme(k)}
              style={{ padding: '8px 14px', borderRadius: 999, border: `1px solid ${on ? THEMES[k].accent : '#ccc'}`, background: on ? THEMES[k].accent : '#fff', color: on ? THEMES[k].accentFg : '#666', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {THEMES[k].name}
            </button>
          )
        })}
      </div>

      {/* 手机壳 + 首页 */}
      <div style={{ width: 342, border: `1px solid ${t.shell}`, borderRadius: 38, padding: 10, background: 'transparent' }}>
        <div style={{ position: 'relative', width: '100%', height: 664, background: t.bg, borderRadius: 28, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* 状态栏 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px 2px', fontSize: 11, color: muted }}>
            <span>9:41</span><span style={{ letterSpacing: 2 }}>ZEXIAO</span>
          </div>
          {/* 顶栏 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 18px 6px' }}>
            <span style={{ fontSize: 21, fontWeight: 500, color: fg, letterSpacing: 2 }}>择校通</span>
            {isNight
              ? <span style={{ width: 28, height: 28, borderRadius: '50%', background: accent, color: t.accentFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>学</span>
              : <span style={{ fontSize: 11, color: fg, border: `${t.borderW}px solid ${fg}`, padding: '3px 10px', borderRadius: t.ctaRadius, fontWeight: 600 }}>登录</span>}
          </div>
          {/* eyebrow */}
          <div style={{ padding: '0 18px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10, letterSpacing: 3, color: accent }}>{t.eyebrow}</div>

          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 6 }}>
            {/* 搜索 */}
            <div style={{ margin: '8px 18px', padding: '9px 12px', ...card(t), color: muted, fontSize: 12 }}>搜学校 / 专业 / 分数线</div>

            {/* Hero：左文 + 右图占位（来自图1） */}
            <div style={{ margin: '10px 18px 8px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 500, color: fg, lineHeight: 1.3 }}>选对学校<br />比努力<br />更关键</div>
                <div style={{ marginTop: 6, fontSize: 10, color: muted, lineHeight: 1.5 }}>{isNight ? '深夜也陪你择校。' : '用数据，不熬鸡汤。'}</div>
                <div style={{ marginTop: 10, display: 'inline-block', background: accent, color: t.accentFg, fontSize: 11, padding: '7px 14px', borderRadius: t.ctaRadius, fontWeight: 600 }}>开始测评 →</div>
              </div>
              <div style={{ width: 96, height: 120, background: t.hero, ...card(t), display: 'flex', alignItems: 'flex-end', padding: 7, fontSize: 9, color: muted }}>校园实景照片</div>
            </div>

            {/* 一键查分 · 大白卡（来自图2） */}
            <div style={{ margin: '14px 18px 6px', padding: '14px 14px 12px', background: '#ffffff', ...card(t) }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: fg, letterSpacing: 1 }}>一键查分</div>
              <div style={{ marginTop: 4, fontSize: 11, color: muted }}>输入分数，智能匹配院校</div>
              <div style={{ marginTop: 10, display: 'inline-block', background: accent, color: t.accentFg, fontSize: 12, padding: '7px 16px', borderRadius: t.ctaRadius, fontWeight: 600 }}>开始匹配</div>
            </div>

            {/* 三功能入口（来自图2 编号卡 + chevron） */}
            <div style={{ margin: '10px 18px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {APPS.map(([n, title, sub]) => (
                <div key={n} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', background: '#ffffff', ...card(t)
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, color: accent, fontWeight: 700 }}>{n}</span>
                    <span style={{ fontSize: 13, color: fg, fontWeight: 500 }}>{title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: muted }}>{sub}</span>
                    <span style={{ fontSize: 14, color: fg, fontWeight: 600 }}>›</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 底部 tab + FAB（来自图2） */}
          <div style={{ position: 'relative', background: t.tabBg }}>
            {/* FAB 悬浮按钮 */}
            <div style={{
              position: 'absolute', left: '50%', top: -22, transform: 'translateX(-50%)',
              width: 44, height: 44, borderRadius: '50%',
              background: fg, color: t.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700,
              border: t.hard ? `3px solid ${fg}` : 'none',
              boxShadow: t.hard ? '3px 3px 0 #111111' : '0 2px 8px rgba(0,0,0,.2)'
            }}>⌄</div>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '16px 6px 12px', borderTop: `1px solid ${t.line}`, fontSize: 11, color: muted }}>
              {tabs.map((tb, i) => (
                <span key={tb} onClick={() => setTab(i)} style={{ cursor: 'pointer', color: i === tab ? fg : muted, fontWeight: i === tab ? 700 : 500, paddingBottom: 2 }}>{tb}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: isNight ? '#8c8378' : '#666', maxWidth: 360, textAlign: 'center', lineHeight: 1.7 }}>
        <strong>「白底结合版」</strong>整图1 选对学校Hero + 图2 一键查分大白卡 + 三功能入口 + 底部FAB<br/>
        白底主调 + 陶土红强调 + 硬边版式，去除紫蓝渐变 / 圆角卡片 / 柔和投影
      </p>
    </div>
  )
}
