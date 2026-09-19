/**
 * 极简全局 toast（零依赖）。
 *
 * 背景：项目里散落着 `alert()` —— 在 iOS 微信内置浏览器里是系统级弹窗，样式丑、会打断操作、
 * 且无法自动消失。这里用一个自建轻提示替代，纯 DOM 实现，不引入任何依赖。
 */
let timer: ReturnType<typeof setTimeout> | undefined

export function toast(msg: string, duration = 2000): void {
  if (typeof document === 'undefined') return
  let el = document.getElementById('zex-toast') as HTMLDivElement | null
  if (!el) {
    el = document.createElement('div')
    el.id = 'zex-toast'
    document.body.appendChild(el)
  }
  el.textContent = msg
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    bottom: '96px',
    transform: 'translateX(-50%)',
    background: 'rgba(28,24,20,0.92)',
    color: '#ffffff',
    padding: '10px 16px',
    borderRadius: '4px',
    fontSize: '14px',
    lineHeight: '1.5',
    maxWidth: '78vw',
    textAlign: 'center',
    zIndex: '9999',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Heiti SC", "微软雅黑", sans-serif',
    boxShadow: '0 2px 12px rgba(0,0,0,0.22)',
    opacity: '0',
    transition: 'opacity .18s ease',
    pointerEvents: 'none',
  } as Partial<CSSStyleDeclaration>)

  requestAnimationFrame(() => {
    if (el) el.style.opacity = '1'
  })

  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    const cur = document.getElementById('zex-toast') as HTMLDivElement | null
    if (cur) cur.style.opacity = '0'
  }, duration)
}
