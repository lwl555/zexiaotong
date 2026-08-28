import { useState } from 'react'

// 三套反 AI-slop 手机版主题，全部用内联色板切换，无全局污染。
// 中文标题统一系统中文栈（避开 iOS 微信衬线回退坑），编辑感靠字重+字号+等宽小标签。
type ThemeKey = 'clay' | 'mono' | 'night'
interface Palette {
  name: string
  bg: string; surface: string; fg: string; muted: string
  line: string; accent: string; accentSoft: string; accentFg: string
  hero: string; shell: string; tabOn: string
  eyebrow: string; ctaRadius: number
}

const THEMES: Record<ThemeKey, Palette> = {
  clay: {
    name: '暖陶土编辑风',
    bg: '#f7f5f0', surface: '#fffdf8', fg: '#1c1814', muted: '#6b6258',
    line: '#e3d9c6', accent: '#c2410c', accentSoft: '#fbeede', accentFg: '#ffffff',
    hero: '#e7e0d2', shell: '#ddd6c6', tabOn: '#c2410c',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 2
  },
  mono: {
    name: '墨黑极简风',
    bg: '#fafafa', surface: '#ffffff', fg: '#16181d', muted: '#9a9a9a',
    line: '#e2e2e2', accent: '#16181d', accentSoft: '#f0f0f0', accentFg: '#ffffff',
    hero: '#ececec', shell: '#e2e2e2', tabOn: '#16181d',
    eyebrow: 'ZEXIAO · 2026 择校季', ctaRadius: 2
  },
  night: {
    name: '暖炭暗调风',
    bg: '#1a1714', surface: '#221e19', fg: '#efe9dd', muted: '#8c8378',
    line: '#3a342c', accent: '#c2410c', accentSoft: '#2a251f', accentFg: '#efe9dd',
    hero: '#2a251f', shell: '#3a342c', tabOn: '#c2410c',
    eyebrow: 'NIGHT EDITION · 2026', ctaRadius: 2
  }
}

const IDX: [string, string, string][] = [
  ['01', '今日分数线更新', '32 所一本院校已同步'],
  ['02', '学长学姐说', '真实就读体验，不灌水'],
  ['03', '志愿模拟器', '冲稳保三档一键生成'],
  ['04', '同城择校搭子', '找人一起跑流程']
]
const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", sans-serif'

export default function ThemePreview() {
  const [theme, setTheme] = useState<ThemeKey>('clay')
  const [tab, setTab] = useState(0)
  const t = THEMES[theme]
  const tabs = ['首页', '发现', '任务', '消息', '我的']
  const isMono = theme === 'mono'

  return (
    <div style={{ minHeight: '100vh', background: theme === 'night' ? '#0f0d0b' : '#f0efec', fontFamily: FONT, padding: '22px 12px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* 主题切换器 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {(['clay', 'mono', 'night'] as ThemeKey[]).map(k => {
          const on = theme === k
          return (
            <button key={k} onClick={() => setTheme(k)}
              style={{ padding: '8px 14px', borderRadius: 999, border: `1px solid ${on ? THEMES[k].accent : '#ccc'}`, background: on ? THEMES[k].accent : '#fff', color: on ? THEMES[k].accentFg : '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {THEMES[k].name}
            </button>
          )
        })}
      </div>

      {/* 手机壳 + 首页 */}
      <div style={{ width: 342, border: `1px solid ${t.shell}`, borderRadius: 38, padding: 10, background: 'transparent' }}>
        <div style={{ width: '100%', height: 664, background: t.bg, borderRadius: 28, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* 状态栏 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px 2px', fontSize: 11, color: t.muted }}>
            <span>9:41</span><span style={{ letterSpacing: 2 }}>ZEXIAO</span>
          </div>
          {/* 顶栏 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 18px 8px' }}>
            <span style={{ fontSize: 21, fontWeight: 500, color: t.fg, letterSpacing: 2 }}>择校通</span>
            {isMono
              ? <span style={{ fontSize: 11, color: t.muted, border: `1px solid ${t.fg}`, padding: '3px 10px', borderRadius: 4 }}>登录</span>
              : <span style={{ width: 28, height: 28, borderRadius: '50%', background: t.accent, color: t.accentFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>学</span>}
          </div>
          {/* eyebrow */}
          <div style={{ padding: '0 18px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10, letterSpacing: 3, color: t.accent }}>{t.eyebrow}</div>
          {/* 搜索 */}
          <div style={{ margin: '8px 18px', padding: '9px 12px', border: `1px solid ${t.fg}`, borderRadius: t.ctaRadius, color: t.muted, fontSize: 12 }}>搜学校 / 专业 / 分数线</div>
          {/* Hero */}
          <div style={{ margin: '10px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 19, fontWeight: 500, color: t.fg, lineHeight: 1.35 }}>选对学校<br />比努力<br />更关键</div>
              <div style={{ marginTop: 8, fontSize: 10, color: t.muted, lineHeight: 1.5 }}>{theme === 'night' ? '深夜也陪你择校。' : '用数据，不熬鸡汤。'}</div>
              <div style={{ marginTop: 10, display: 'inline-block', background: t.accent, color: t.accentFg, fontSize: 11, padding: '6px 14px', borderRadius: t.ctaRadius }}>开始测评 →</div>
            </div>
            <div style={{ width: 96, height: 120, background: t.hero, border: `1px solid ${t.line}`, display: 'flex', alignItems: 'flex-end', padding: 7, fontSize: 9, color: t.muted }}>校园实景照片</div>
          </div>
          {/* 编号索引 */}
          <div style={{ margin: '4px 18px', borderTop: `1px solid ${t.fg}` }}>
            {IDX.map(([n, title, sub]) => (
              <div key={n} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${t.line}`, alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, color: t.accent }}>{n}</span>
                <div><div style={{ fontSize: 12, color: t.fg }}>{title}</div><div style={{ fontSize: 9, color: t.muted, marginTop: 2 }}>{sub}</div></div>
              </div>
            ))}
          </div>
          {/* 底部 tab */}
          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-around', padding: '12px 6px', borderTop: `1px solid ${t.line}`, fontSize: 10, color: t.muted }}>
            {tabs.map((tb, i) => (
              <span key={tb} onClick={() => setTab(i)} style={{ cursor: 'pointer', color: i === tab ? t.tabOn : t.muted, borderBottom: i === tab ? `2px solid ${t.tabOn}` : '2px solid transparent', paddingBottom: 2 }}>{tb}</span>
            ))}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: theme === 'night' ? '#8c8378' : '#888', maxWidth: 340, textAlign: 'center', lineHeight: 1.6 }}>
        真实可切换预览 · 三套均避开 AI 模板风（无紫蓝渐变 / 圆角卡片网格 / 柔和投影）<br />
        选定方向后我回写到全站手机版（MobileLayout / WeChatHome 等）
      </p>
    </div>
  )
}
