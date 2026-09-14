import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import './tailwind.css'
import { useStore } from './store/store'
import { reloadForNewVersion } from './lib/safeLazy'

// —— 部署更新后的「旧 chunk 404」全局兜底 ——
// Vite 构建产物文件名带内容 hash，每次部署都会换名并删除旧文件。用户若停留在旧页面，
// 点新路由时会动态 import 一个已不存在的 chunk → 报
//   TypeError: Failed to fetch dynamically imported module: .../assets/XXX-hash.js
// Vite 会为此派发 vite:preloadError 事件；这里整页刷新一次，直接拿新版本（防循环见 safeLazy.ts）。
window.addEventListener(
  'vite:preloadError' as any,
  ((e: any) => {
    try { e?.preventDefault?.() } catch {}
    reloadForNewVersion()
  }) as any
)

// 应用启动时从 Supabase 拉取数据
useStore.getState().init()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
