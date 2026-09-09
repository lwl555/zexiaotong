// 原生桥接：在 Android WebView 套壳里把「站内消息」弹到手机通知栏。
//
// 工作机制：原生壳通过 addJavascriptInterface 注入 window.ZexBridge.notify(title, body, route)。
// 这里只做一层安全封装——没有该桥接（桌面浏览器、普通手机浏览器）时静默 no-op，
// 绝不影响其它环境的正常逻辑。
//
// 注意：route 用 HashRouter 的 hash 路径（如 /m/notify/aichat），原生端会拼成
//   https://lwl555.github.io/zexiaotong/#<route>
// 点击通知即直达对应功能页。

interface ZexBridgeLike {
  notify(title: string, body: string, route: string): void
}

export function notifyNative(title: string, body: string, route?: string): void {
  try {
    const w = window as unknown as { ZexBridge?: ZexBridgeLike }
    if (w.ZexBridge && typeof w.ZexBridge.notify === 'function') {
      w.ZexBridge.notify(title || '择校通', body || '', route || '')
    }
  } catch {
    /* 桥接异常不应影响网页主流程 */
  }
}
