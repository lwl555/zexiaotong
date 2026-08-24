/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 校园感主色：青绿 + 暖橙点缀，避开紫蓝 AI 渐变
        brand: {
          50: '#eafff6', 100: '#cdfded', 200: '#9ff7d8', 300: '#5fecbd',
          400: '#22d89c', 500: '#06bf83', 600: '#00976a', 700: '#077758',
          800: '#0a5e48', 900: '#0b4d3c'
        },
        clay: '#e8732a',
        ink: '#16181d',
        paper: '#f7f5f0'
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Noto Serif SC"', 'Georgia', 'serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)'
      }
    }
  },
  // 关键：关闭 preflight，避免重置原 styles.css 的暖陶土编辑风（标题/按钮/列表样式）
  // 同时关闭 Tailwind 自带的 .container 工具类（避免它覆盖 styles.css 里 .container 的 max-width/margin/padding，破坏原桌面布局）
  corePlugins: { preflight: false, container: false },
  plugins: []
}
