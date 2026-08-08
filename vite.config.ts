import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 开发态：前端请求 /api/agnes，由下面的 proxy 在服务端注入 key（bundle 里没有 key）。
// 生产态：VITE_AGNES_BASE 指向 Supabase Edge Function（agnes-proxy），key 只在函数端 secret。
export default defineConfig({
  base: '/zexiaotong/',
  plugins: [react()],
  server: {
    proxy: {
      '/api/agnes': {
        target: process.env.AGENS_PROXY_TARGET || 'http://localhost:54321',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/agnes/, ''),
        configure: (proxy, _opts) => {
          // 开发态把 Agnes / DeepSeek key 注入到转发请求头（key 来自 .env.local 的 AGNES_API_KEY）
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            const key = process.env.AGNES_API_KEY
            if (key) proxyReq.setHeader('Authorization', `Bearer ${key}`)
          })
        }
      }
    }
  }
})
