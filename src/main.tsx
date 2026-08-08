import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

// GitHub Pages SPA fallback：404.html 跳转过来时把原路径存到 sessionStorage，
// 这里恢复后用 history.replaceState 改回 URL（不触发 reload），再交给 react-router 渲染
;(function restoreSpaRedirect() {
  try {
    const stored = sessionStorage.getItem('zxt.spa.redirect')
    if (stored && stored !== '/' && window.location.pathname.endsWith('/zexiaotong/')) {
      sessionStorage.removeItem('zxt.spa.redirect')
      window.history.replaceState(null, '', stored)
    }
  } catch {
    // 静默：sessionStorage 不可用时不影响正常启动
  }
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
