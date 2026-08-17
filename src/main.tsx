import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

// 使用 HashRouter：URL 形如 /zexiaotong/#/ai-tutor，深层路由不发 HTTP 请求，
// GitHub Pages 永远只返回 /zexiaotong/（200），彻底消除深链 404 状态码问题。

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
