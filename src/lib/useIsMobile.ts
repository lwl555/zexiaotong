import { useState, useEffect } from 'react'

// 设备自适应的核心：用视口宽度判断是否手机。
// 默认值在首屏就按 window.innerWidth 计算（纯客户端 SPA，无 SSR 闪烁问题），
// 并在 resize 时实时切换——所以浏览器用 DevTools 切到手机视图时界面会立刻变。
export function useIsMobile(breakpoint = 820) {
  const get = () =>
    typeof window !== 'undefined' && window.innerWidth <= breakpoint
  const [isMobile, setIsMobile] = useState<boolean>(get)

  useEffect(() => {
    const onResize = () => setIsMobile(get())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return isMobile
}
