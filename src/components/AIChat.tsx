import { useState, useRef } from 'react'
import { agnesChat, ChatMsg } from '../lib/agnes'
import { renderReport, ThemeKey } from './Report'
import { exportDocx } from '../lib/docx'

interface Props {
  title: string
  systemPrompt: string
  placeholder: string
  webSearch?: boolean
  /** 业务主题色：school / by-city / by-company，决定板块与头部配色 */
  theme?: ThemeKey
  /** 是否显示「导出 Word」按钮（把最近一次 AI 回复导出） */
  exportable?: boolean
  exportName?: string
  exportTitle?: string
}

interface Msg {
  role: 'user' | 'ai'
  content: string
}

export default function AIChat({ title, systemPrompt, placeholder, webSearch, theme = 'school', exportable, exportName, exportTitle }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const lastReply = useRef('')

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setError('')
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const reply = await agnesChat(
        [{ role: 'system', content: systemPrompt }, ...next.map((m): ChatMsg => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))],
        { webSearch }
      )
      lastReply.current = reply
      setMessages([...next, { role: 'ai' as const, content: reply }])
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!lastReply.current) return
    try {
      await navigator.clipboard.writeText(lastReply.current)
    } catch {}
  }

  return (
    <div className={`panel theme-${theme}`}>
      <div className="panel-head">
        <span className="who">{title}</span>
        {webSearch && <span className="meta">· 深度分析（数据可能非实时）</span>}
        {loading && <span className="meta">· 生成中…</span>}
      </div>

      <div className="panel-body">
        {messages.length === 0 && !loading && (
          <div className="note">
            在下方输入，AI 会基于分析直接给出带颜色标记的结论（优点 / 缺点 / 亮点 / 重点 一目了然）。
            <br />
            <span className="note-sub">提示：当前为模型知识作答，数据可能非最新，重大决策请以官方最新信息为准。</span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">
              <div className="role">{m.role === 'user' ? '你' : 'AI'}</div>
              {m.role === 'user' ? m.content : <div className="report">{renderReport(m.content, theme)}</div>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg ai">
            <div className="bubble">
              <div className="loading">
                <span className="spinner" /> 正在{messages.some((m) => m.role === 'user') ? '拆解分析' : '准备'}…
              </div>
            </div>
          </div>
        )}
        {error && <div className="err">出错了：{error}</div>}

        {exportable && lastReply.current && (
          <div className="toolbar">
            <button className="btn btn-ghost btn-sm" onClick={copy}>
              复制全文
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => exportDocx(exportName || '导出', exportTitle || 'AI 结果', lastReply.current)}
            >
              导出 Word
            </button>
          </div>
        )}
      </div>

      <div className="chat-input">
        <input
          value={input}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="btn btn-primary" onClick={send} disabled={loading || !input.trim()}>
          发送
        </button>
      </div>
    </div>
  )
}
