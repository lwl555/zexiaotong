import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import './tailwind.css'
import { useStore } from './store/store'

// 应用启动时从 Supabase 拉取数据
useStore.getState().init()

// ErrorBoundary：把 React 抛错（特别是 #31 "Objects are not valid as a React child"）
// 用 componentStack 暴露真实组件名，prod minified 也能定位。
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; info: React.ErrorInfo | null }
> {
  state = { error: null as Error | null, info: null as React.ErrorInfo | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info })
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }
  render() {
    if (this.state.error) {
      const e = this.state.error
      const cs = this.state.info?.componentStack || ''
      return (
        <div style={{
          position: 'fixed', inset: 0, overflow: 'auto',
          background: '#1a1a1a', color: '#f5f5f5',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12, lineHeight: 1.5, padding: 16, zIndex: 99999
        }}>
          <div style={{ fontSize: 14, color: '#f87171', fontWeight: 700, marginBottom: 8 }}>
            {e.name}: {e.message}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', color: '#fbbf24', marginBottom: 8 }}>
            {e.stack}
          </div>
          {cs && (
            <details open>
              <summary style={{ color: '#a3e635', cursor: 'pointer' }}>组件堆栈（componentStack）</summary>
              <pre style={{ whiteSpace: 'pre-wrap', color: '#93c5fd', marginTop: 6 }}>{cs}</pre>
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
