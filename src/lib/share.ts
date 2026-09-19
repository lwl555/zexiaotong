/**
 * 分享当前页面（原「分享」按钮只是 nav('/')，等于没功能）。
 *
 * 策略（按可用性降级）：
 *   1) navigator.share —— iOS Safari / 微信内置浏览器支持，直接唤起系统分享面板
 *   2) navigator.clipboard 复制链接
 *   3) textarea + execCommand 兜底（老 WebView）
 * 返回结果供调用方给出对应提示。
 */
export async function sharePage(opts: { title?: string; text?: string; path?: string } = {}): Promise<'shared' | 'copied' | 'failed'> {
  const hash = (opts.path || (location.hash.replace(/^#/, '') || '/')).replace(/^#/, '')
  const url = `${location.origin}${location.pathname}#${hash}`
  const title = opts.title || document.title || '择校通'
  const text = opts.text || ''

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return 'shared'
    } catch (e: any) {
      // 用户主动取消：视为已完成，不再降级提示
      if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return 'shared'
      // 其他异常继续走复制兜底
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return 'copied'
    }
  } catch {
    /* 继续兜底 */
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = url
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    if (ok) return 'copied'
  } catch {
    /* ignore */
  }

  return 'failed'
}
