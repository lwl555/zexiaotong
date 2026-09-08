/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 品牌主色：暖陶土阶（2026-09-08 定稿，替代旧青绿系；与 Editorial ACCENT #c2410c 同源）
        brand: {
          50: '#fdf3ec', 100: '#fbe3d3', 200: '#f5c4a5', 300: '#eda071',
          400: '#e0763c', 500: '#d4581d', 600: '#c2410c', 700: '#9a3408',
          800: '#7c2c0a', 900: '#5f2308'
        },
        clay: '#c2410c',
        ink: '#16181d',
        paper: '#ffffff'
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
