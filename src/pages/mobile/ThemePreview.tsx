import { useState } from 'react'

// 手机版主题预览 · 九套实时切换
// 2026-09-08 新增三套新方向：peach 暖珊瑚 / ink 简墨朱砂 / letter 通知书绿
type ThemeKey = 'peach' | 'ink' | 'letter' | 'white-mix' | 'white-hard' | 'white-min' | 'clay' | 'mono' | 'night'
interface Palette {
  name: string
  bg: string; surface: string; fg: string; muted: string
  line: string; accent: string; accentSoft: string; accentFg: string
  hero: string; shell: string; tabOn: string; tabBg: string
  eyebrow: string; ctaRadius: number
  borderW: number; hard: boolean
  shadow: string; borderColor: string
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

const THEMES: Record<ThemeKey, Palette> = {
  // ★ 2026-09-08 新方向 A：暖珊瑚 · 大圆角轻投影，亲和年轻
  peach: {
    name: 'A 暖珊瑚',
    bg: '#fdf9f5', surface: '#ffffff', fg: '#2b2320', muted: '#a38f82',
    line: '#f0e4da', accent: '#ea5b2f', accentSoft: '#fdeee6', accentFg: '#ffffff',
    hero: '#f5e9e0', shell: '#e9dcd1', tabOn: '#2b2320', tabBg: '#fdf9f5',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 12, borderW: 0, hard: false,
    shadow: '0 8px 22px rgba(180, 100, 60, 0.10)', borderColor: 'transparent'
  },
  // ★ 2026-09-08 新方向 B：简墨朱砂 · 无边框无投影，靠留白与字重分层
  ink: {
    name: 'B 简墨朱砂',
    bg: '#ffffff', surface: '#f7f5f1', fg: '#1c1c1c', muted: '#9b9b9b',
    line: '#ececec', accent: '#c5301c', accentSoft: '#f9ebe7', accentFg: '#ffffff',
    hero: '#f2f0ec', shell: '#e6e6e6', tabOn: '#1c1c1c', tabBg: '#ffffff',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 0, borderW: 0, hard: false,
    shadow: 'none', borderColor: 'transparent'
  },
  // ★ 2026-09-08 新方向 C：通知书绿 · 学院信任感（录取通知书配色隐喻）
  letter: {
    name: 'C 通知书绿',
    bg: '#f5f4ef', surface: '#ffffff', fg: '#1a2420', muted: '#7f8b83',
    line: '#e2e5dc', accent: '#1e5c46', accentSoft: '#e7efe8', accentFg: '#ffffff',
    hero: '#e5ebe3', shell: '#d9ded4', tabOn: '#1e5c46', tabBg: '#f5f4ef',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 10, borderW: 1, hard: false,
    shadow: '0 3px 12px rgba(30, 92, 70, 0.08)', borderColor: '#dfe3da'
  },
  'white-mix': {
    name: '白底结合版(旧)',
    bg: '#ffffff', surface: '#ffffff', fg: '#111111', muted: '#6b6b6b',
    line: '#111111', accent: '#D8451F', accentSoft: '#fbe9e3', accentFg: '#ffffff',
    hero: '#efefef', shell: '#111111', tabOn: '#111111', tabBg: '#f3f1ec',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 2, borderW: 3, hard: true,
    shadow: '5px 5px 0 #111111', borderColor: '#111111'
  },
  'white-hard': {
    name: '白底硬边·砖红',
    bg: '#ffffff', surface: '#ffffff', fg: '#111111', muted: '#6b6b6b',
    line: '#111111', accent: '#D8451F', accentSoft: '#fbe9e3', accentFg: '#ffffff',
    hero: '#f4f4f4', shell: '#111111', tabOn: '#111111', tabBg: '#ffffff',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 2, borderW: 3, hard: true,
    shadow: '5px 5px 0 #111111', borderColor: '#111111'
  },
  'white-min': {
    name: '白底极简·墨黑',
    bg: '#ffffff', surface: '#ffffff', fg: '#111111', muted: '#8a8a8a',
    line: '#e6e6e6', accent: '#111111', accentSoft: '#f2f2f2', accentFg: '#ffffff',
    hero: '#f4f4f4', shell: '#e6e6e6', tabOn: '#111111', tabBg: '#ffffff',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 8, borderW: 2, hard: false,
    shadow: 'none', borderColor: '#e6e6e6'
  },
  clay: {
    name: '暖陶土编辑风',
    bg: '#f7f5f0', surface: '#fffdf8', fg: '#1c1814', muted: '#6b6258',
    line: '#e3d9c6', accent: '#c2410c', accentSoft: '#fbeede', accentFg: '#ffffff',
    hero: '#e7e0d2', shell: '#ddd6c6', tabOn: '#c2410c', tabBg: '#f7f5f0',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 2, borderW: 1, hard: false,
    shadow: 'none', borderColor: '#e3d9c6'
  },
  mono: {
    name: '墨黑极简风',
    bg: '#fafafa', surface: '#ffffff', fg: '#16181d', muted: '#9a9a9a',
    line: '#e2e2e2', accent: '#16181d', accentSoft: '#f0f0f0', accentFg: '#ffffff',
    hero: '#ececec', shell: '#e2e2e2', tabOn: '#16181d', tabBg: '#fafafa',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 2, borderW: 1, hard: false,
    shadow: 'none', borderColor: '#e2e2e2'
  },
  night: {
    name: '暖炭暗调风',
    bg: '#1a1714', surface: '#221e19', fg: '#efe9dd', muted: '#8c8378',
    line: '#3a342c', accent: '#c2410c', accentSoft: '#2a251f', accentFg: '#efe9dd',
    hero: '#2a251f', shell: '#3a342c', tabOn: '#c2410c', tabBg: '#1a1714',
    eyebrow: 'NIGHT EDITION · 2026', ctaRadius: 2, borderW: 1, hard: false,
    shadow: 'none', borderColor: '#3a342c'
  }
}

// 三功能入口（图2 风格：杂志编号 + 右侧 chevron）
const APPS: [string, string, string][] = [
  ['01', '院校库', '3200+ 所'],
  ['02', '志愿填报', '智能方案'],
  ['03', '录取追踪', '实时状态']
]

const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", sans-serif'

// 主题化卡片：边框色/圆角/投影全由 Palette 决定
function card(t: Palette, radius = t.ctaRadius) {
  return {
    border: t.borderW > 0 ? `${t.borderW}px solid ${t.borderColor}` : 'none',
    borderRadius: radius,
    boxShadow: t.shadow
  } as const
}

const THEME_ORDER: ThemeKey[] = ['peach', 'ink', 'letter', 'white-mix', 'white-hard', 'white-min', 'clay', 'mono', 'night']

export default function ThemePreview() {
  const [theme, setTheme] = useState<ThemeKey>('peach')
  const [tab, setTab] = useState(0)
  const t = THEMES[theme]
  const tabs = ['首页', '发现', '我的']
  const isNight = theme === 'night'
  const isNew = ['peach', 'ink', 'letter'].includes(theme)
  const outerBg = isNight ? '#0f0d0b' : '#e8e4dd'
  const accent = t.accent
  const fg = t.fg
  const muted = t.muted

  return (
    <div style={{ minHeight: '100vh', background: outerBg, fontFamily: FONT, padding: '22px 12px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* 主题切换器 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720 }}>
        {THEME_ORDER.map(k => {
          const on = theme === k
          const isNewK = ['peach', 'ink', 'letter'].includes(k)
          return (
            <button key={k} onClick={() => setTheme(k)}
              style={{ padding: '8px 14px', borderRadius: 999, border: `1px solid ${on ? THEMES[k].accent : '#ccc'}`, background: on ? THEMES[k].accent : '#fff', color: on ? THEMES[k].accentFg : '#666', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {isNewK ? '★ ' : ''}{THEMES[k].name}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 18px 6px' }}>
            <span style={{ fontSize: 21, fontWeight: isNew ? 700 : 500, color: fg, letterSpacing: isNew ? 0 : 2 }}>{isNew ? '择校通' : '择校通'}</span>
            {isNight
              ? <span style={{ width: 28, height: 28, borderRadius: '50%', background: accent, color: t.accentFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>学</span>
              : <span style={{ fontSize: 11, color: fg, border: `1px solid ${t.borderW > 0 ? t.borderColor : t.line}`, background: isNew && theme === 'ink' ? 'transparent' : t.surface, padding: '4px 12px', borderRadius: t.ctaRadius, fontWeight: 600 }}>登录</span>}
          </div>
          {/* eyebrow */}
          <div style={{ padding: '0 18px', fontFamily: MONO, fontSize: 10, letterSpacing: 3, color: accent }}>{t.eyebrow}</div>

          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 6 }}>
            {/* 搜索 */}
            <div style={{ margin: '8px 18px', padding: '10px 13px', ...card(t), color: muted, fontSize: 12, background: t.surface }}>搜学校 / 专业 / 分数线</div>

            {/* Hero：左文 + 右图占位 */}
            <div style={{ margin: '10px 18px 8px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 21, fontWeight: 800, color: fg, lineHeight: 1.28, letterSpacing: '-0.01em' }}>选对学校<br />比努力更关键</div>
                <div style={{ marginTop: 6, fontSize: 10, color: muted, lineHeight: 1.5 }}>{isNight ? '深夜也陪你择校。' : '用数据，不熬鸡汤。'}</div>
                <div style={{ marginTop: 10, display: 'inline-block', background: accent, color: t.accentFg, fontSize: 11, padding: '8px 15px', borderRadius: t.ctaRadius, fontWeight: 600, boxShadow: t.hard ? t.shadow : 'none' }}>开始测评 →</div>
              </div>
              <div style={{ width: 96, height: 122, background: t.hero, ...card(t), display: 'flex', alignItems: 'flex-end', padding: 7, fontSize: 9, color: muted }}>校园实景照片</div>
            </div>

            {/* 一键查分 · 大卡 */}
            <div style={{ margin: '14px 18px 6px', padding: '15px 15px 13px', background: t.surface, ...card(t) }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: accent, fontWeight: 700 }}>01</span>
                <div style={{ fontSize: 17, fontWeight: 700, color: fg, letterSpacing: 0.5 }}>一键查分</div>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: muted }}>输入分数，智能匹配院校</div>
              <div style={{ marginTop: 10, display: 'inline-block', background: accent, color: t.accentFg, fontSize: 12, padding: '8px 17px', borderRadius: t.ctaRadius, fontWeight: 600 }}>开始匹配</div>
            </div>

            {/* 三功能入口 */}
            <div style={{ margin: '10px 18px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {APPS.map(([n, title, sub], i) => (
                <div key={n} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 13px', background: t.surface, ...card(t)
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: MONO, fontSize: 13, color: accent, fontWeight: 700 }}>{String(i + 2).padStart(2, '0')}</span>
                    <span style={{ fontSize: 13, color: fg, fontWeight: 600 }}>{title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: muted }}>{sub}</span>
                    <span style={{ fontSize: 14, color: fg, fontWeight: 600 }}>›</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 底部 tab + FAB */}
          <div style={{ position: 'relative', background: t.tabBg }}>
            <div style={{
              position: 'absolute', left: '50%', top: -22, transform: 'translateX(-50%)',
              width: 44, height: 44, borderRadius: theme === 'peach' ? 16 : '50%',
              background: accent, color: t.accentFg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700,
              boxShadow: t.hard ? '3px 3px 0 #111111' : '0 6px 16px rgba(0,0,0,.18)'
            }}>⌄</div>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '16px 6px 12px', borderTop: `1px solid ${t.line}`, fontSize: 11, color: muted }}>
              {tabs.map((tb, i) => (
                <span key={tb} onClick={() => setTab(i)} style={{ cursor: 'pointer', color: i === tab ? t.tabOn : muted, fontWeight: i === tab ? 700 : 500, paddingBottom: 2 }}>{tb}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: isNight ? '#8c8378' : '#666', maxWidth: 380, textAlign: 'center', lineHeight: 1.7 }}>
        {isNew ? (
          theme === 'peach' ? <><strong>A 暖珊瑚</strong>：暖白底 + 大圆角 + 轻投影，无边框。亲和年轻，像好用的App。</>
          : theme === 'ink' ? <><strong>B 简墨朱砂</strong>：纯白底 + 浅灰块 + 零边框零投影，朱砂红只点编号。安静高级。</>
          : <><strong>C 通知书绿</strong>：米白底 + 细边白卡 + 松绿主色。录取通知书的学院信任感。</>
        ) : (
          <><strong>「白底结合版」</strong>整图1 选对学校Hero + 图2 一键查分大白卡 + 三功能入口 + 底部FAB<br/>白底主调 + 陶土红强调 + 硬边版式</>
        )}
      </p>
    </div>
  )
}
