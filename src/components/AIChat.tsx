import { useState, useRef } from 'react'
import { agnesChat, ChatMsg, SearchMeta } from '../lib/agnes'

// 检索来源英文 key → 中文友好标签（用于诚实标注展示）
const SRC_LABEL: Record<string, string> = {
  gnews: '新闻',
  hn: '技术讨论',
  bing: '网页',
  reddit: '社区',
  'wiki-zh': '维基(中)',
  'wiki-en': '维基(英)',
  ddg: 'DuckDuckGo',
  tavily: '实时检索',
  brave: 'Brave',
  serper: 'Serper'
}
const srcLabel = (s: string) => SRC_LABEL[s] || s
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
  /** 该条 AI 回复对应的真实题图（学校/实体照片），来自维基百科 */
  image?: { url: string; title: string } | null
}

export default function AIChat({ title, systemPrompt, placeholder, webSearch, theme = 'school', exportable, exportName, exportTitle }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null)
  const lastReply = useRef('')

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setError('')
    setSearchMeta(null)
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const { content, search } = await agnesChat(
        [{ role: 'system', content: systemPrompt }, ...next.map((m): ChatMsg => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))],
        { webSearch }
      )
      setSearchMeta(search ?? null)
      lastReply.current = content
      setMessages([...next, { role: 'ai' as const, content, image: search?.image ?? null }])
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
        {webSearch && searchMeta?.ok && (
          <span className="meta ok">🌐 已联网检索 {searchMeta.count} 条（{searchMeta.sources.map(srcLabel).join(' · ')}）</span>
        )}
        {webSearch && searchMeta && !searchMeta.ok && (
          <span className="meta warn">⚠️ 联网检索暂不可用，已按模型知识作答</span>
        )}
        {webSearch && !searchMeta && !loading && <span className="meta">· 待检索</span>}
        {loading && <span className="meta">· 生成中…</span>}
      </div>

      <div className="panel-body">
        {messages.length === 0 && !loading && (
          <div className="note">
            在下方输入，AI 会<b>先联网检索真实资料</b>，再结合多维度分析给出带颜色标记的结论（优点 / 缺点 / 亮点 / 重点 一目了然），关键事实会标注来源。
            <br />
            <span className="note-sub">提示：检索来自公开网络，可能不保证 100% 最新；重大决策请以官方最新信息为准。若检索服务暂不可用，会自动降级为模型自身知识作答。</span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">
              <div className="role">{m.role === 'user' ? '你' : 'AI'}</div>
              {m.role === 'user' ? (
                m.content
              ) : (
                <>
                  {m.image?.url && (
                    <figure className="lead-photo">
                      <img src={m.image.url} alt={m.image.title || '配图'} loading="lazy" referrerPolicy="no-referrer" />
                      <figcaption>配图 · {m.image.title || '真实资料图'}</figcaption>
                    </figure>
                  )}
                  <div className="report">{renderReport(m.content, theme)}</div>
                </>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg ai">
            <div className="bubble">
              <div className="loading">
                <span className="spinner" /> {webSearch ? '正在联网检索并分析…' : `正在${messages.some((m) => m.role === 'user') ? '拆解分析' : '准备'}…`}
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
