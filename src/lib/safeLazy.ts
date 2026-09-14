import { lazy, ComponentType } from 'react'

// —— 部署更新后的「旧 chunk 404」自愈 ——
// 背景：Vite 构建产物的文件名带内容 hash（如 AITangdou-ksGLx4gU.js）。每次部署都会生成新文件名、
// 删掉旧文件。用户浏览器若仍停留在旧页面（或旧 index.html 缓存），此时点进新路由需要动态 import 旧 chunk，
// 服务器上已不存在该文件 → 浏览器报：
//   TypeError: Failed to fetch dynamically imported module: .../assets/XXX-xxxxxxxx.js
// 用户看到的是「渲染错误」。正确姿势：识别出这种情况后**整页刷新一次**，拿到新 index.html + 新 chunk。
//
// 防循环：10 分钟内只自动刷新一次（避免服务端真的缺文件时无限刷新）。
const RELOAD_KEY = 'zex:chunk-reload-at'
const RELOAD_WINDOW_MS = 10 * 60 * 1000

/** 旧 chunk 失效 → 整页刷新一次拿新版本。返回是否触发了刷新。 */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (last && Date.now() - last < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // 无 sessionStorage（隐私模式等）时也要能刷新
  }
  window.location.reload()
  return true
}

// 各家浏览器/打包器对「chunk 拉取失败」的报错文案
const CHUNK_ERR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \d+ failed|Loading CSS chunk|'text\/html' is not a valid JavaScript MIME type/i

/**
 * 安全版 React.lazy：动态 import 失败且判定为「chunk 已过期」时，自动刷新页面拿新版本。
 * 用法与 lazy 完全一致：const Page = safeLazy(() => import('./pages/Page'))
 */
export function safeLazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch((err: unknown) => {
      const msg = String((err as any)?.message || err)
      if (CHUNK_ERR.test(msg)) {
        // 触发刷新（页面随即重载，旧状态丢失但用户能继续用新版本）
        reloadForNewVersion()
      }
      throw err
    })
  )
}
