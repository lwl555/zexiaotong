// 占位图工具（SVG data URI，无需联网）

export function img(text: string, w = 400, h = 300, c = '#06bf83'): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
    <rect width='100%' height='100%' fill='#eef2f1'/>
    <rect x='0' y='0' width='100%' height='10' fill='${c}'/>
    <text x='50%' y='54%' font-size='22' fill='#6b7280' text-anchor='middle' font-family='sans-serif'>${text}</text>
  </svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export function avatarFor(name: string): string {
  const colors = ['#06bf83', '#e8732a', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#0ea5e9']
  const c = colors[name.charCodeAt(0) % colors.length]
  const ch = name.slice(-1)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
    <rect width='80' height='80' rx='40' fill='${c}'/>
    <text x='50%' y='56%' font-size='34' fill='white' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif'>${ch}</text>
  </svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
