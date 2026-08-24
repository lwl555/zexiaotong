import { useState, useEffect } from 'react'

/**
 * 设备自动判断机 —— 多信号综合判断是否为手机/平板：
 *
 * 1. 视口宽度（主信号）
 *    - ≤ 820px  → 手机（无论是否触屏）
 *    - 821–1024px + 触屏 → 平板（iPad mini / 大屏手机横屏）→ 走手机视图
 *    - > 1024px → 桌面
 *
 * 2. 指针精度（触屏检测）
 *    - `pointer: coarse` = 触屏（手机/平板）
 *    - `pointer: fine` = 鼠标/触控板
 *
 * 3. User-Agent（兜底）
 *    - 含 Mobile / Android / iPhone / iPad 等关键字 → 移动设备
 *
 * 这样：
 * - 普通手机（375–820）→ 手机视图 ✓
 * - iPad 竖屏（768）→ 手机视图 ✓
 * - iPad 横屏（1024）+ 触屏 → 手机视图 ✓（避免触屏看桌面壳）
 * - 触屏笔记本（Surface Pro 等 900–1280 + 触屏）→ 手机视图 ✓
 * - 纯桌面笔记本（> 820 + 鼠标）→ 桌面视图 ✓
 * - 桌面浏览器拖窄到 800 以下 → 手机视图 ✓
 */

/** 检测是否为触屏设备（媒体查询 + UA 兜底） */
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  // 1. 指针精度：粗指针 = 触屏（手机/平板）；细指针 = 鼠标
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return true
  } catch {}
  // 2. UA 兜底（旧浏览器可能不支持 matchMedia pointer）
  const ua = navigator.userAgent || ''
  return /Mobile|Android|iPhone|iPad|iPod|IEMobile|Windows Phone|Opera Mini|BlackBerry|webOS/i.test(ua)
}

/** 综合判断当前是否应走手机视图 */
function checkMobile(): boolean {
  if (typeof window === 'undefined') return false
  const w = window.innerWidth
  const touch = isTouchDevice()

  // 窄屏：一律手机视图
  if (w <= 820) return true
  // 中等宽度（821–1024）+ 触屏：平板 / 大屏手机横屏 → 手机视图
  if (w <= 1024 && touch) return true
  // 其余（宽屏 or 无触屏）→ 桌面视图
  return false
}

export function useIsMobile() {
  // 首屏立即算一次，无 SSR 闪烁问题（纯客户端 SPA）
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? checkMobile() : false
  )

  useEffect(() => {
    const onChange = () => setIsMobile(checkMobile())
    // 窗口 resize（桌面浏览器拖窄 / DevTools 切换设备）
    window.addEventListener('resize', onChange)
    // 手机横竖屏翻转
    window.addEventListener('orientationchange', onChange)
    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('orientationchange', onChange)
    }
  }, [])

  return isMobile
}
