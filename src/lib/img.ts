// 占位图工具（SVG data URI，无需联网）
// 配色说明：默认色由旧的青绿 #06bf83 改为品牌陶土 #c2410c —— 全站品牌色是陶土，
// 占位图顶着一条绿色横杠会与品牌色打架（也容易被看成"微信绿"）。

export function img(text: string, w = 400, h = 300, c = '#c2410c'): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
    <rect width='100%' height='100%' fill='#f2f2f2'/>
    <rect x='0' y='0' width='100%' height='10' fill='${c}'/>
    <text x='50%' y='54%' font-size='22' fill='#9a9a9a' text-anchor='middle' font-family='sans-serif'>${text}</text>
  </svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export function avatarFor(name: string): string {
  // 调色板去掉旧青绿，改为陶土系 + 中性色，保持可区分度同时不偏离品牌
  const colors = ['#c2410c', '#e8732a', '#2563eb', '#7c3aed', '#ca8a04', '#dc2626', '#0f766e']
  const c = colors[name.charCodeAt(0) % colors.length]
  const ch = name.slice(-1)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
    <rect width='80' height='80' rx='40' fill='${c}'/>
    <text x='50%' y='56%' font-size='34' fill='white' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif'>${ch}</text>
  </svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
