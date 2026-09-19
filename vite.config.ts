import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 开发态：前端请求 /api/agnes，由下面的 proxy 在服务端注入 key（bundle 里没有 key）。
// 生产态：VITE_AGNES_BASE 指向 Supabase Edge Function（agnes-proxy），key 只在函数端 secret。
export default defineConfig({
  base: '/zexiaotong/',
  plugins: [react()],
  build: {
    // 分包：把体积大 / 变更频率低的库拆成独立 chunk。
    // 背景：此前 docx(≈500KB) 与 recharts(≈400KB) 会跟随业务路由 chunk 一起下载，
    // 导致 AI 聊天 / 文档工坊 / 后台看板首屏白屏 5–8 秒。
    // 拆开后：① 这些重库各自独立缓存，业务代码更新不再让用户重下；② docx 只在实际
    // 点「导出 Word」时才被动态拉取（见 src/lib/docx.ts），首屏完全不碰。
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react'],
          'vendor-charts': ['recharts'],
          'vendor-docx': ['docx'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
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
