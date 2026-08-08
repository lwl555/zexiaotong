import { useState, useRef, useEffect } from 'react'
import { agnesChat, ChatMsg, SearchMeta } from '../lib/agnes'
import {
  Conversation,
  StoredMsg,
  QueryRecord,
  getConversation,
  upsertConversation,
  deleteConversation,
  addQuery,
  newId
} from '../lib/history'

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
import { PROMPT_EMPHASIS } from '../lib/prompts'

interface Props {
  title: string
  systemPrompt: string
  placeholder: string
  webSearch?: boolean
  /** 业务主题色：school / by-city / by-company，决定板块与头部配色 */
  theme?: ThemeKey
  /** 功能页标识，用于历史归属：ai-search / ai-tutor / document-workshop */
  pageKey?: string
  /** 子频道，会话按 pageKey:channel 隔离：school / by-city / by-company */
  channel?: string
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

export default function AIChat({
  title,
  systemPrompt,
  placeholder,
  webSearch,
  theme = 'school',
  pageKey = 'ai-search',
  channel = 'school',
  exportable,
  exportName,
  exportTitle
}: Props) {
  const convId = `${pageKey}:${channel}`
  const [messages, setMessages] = useState<Msg[]>(() => {
    const c = getConversation(convId)
    return c ? c.messages.map((m: StoredMsg) => ({ role: m.role, content: m.content, image: m.image ?? null })) : []
  })
  const [convTitle, setConvTitle] = useState<string>(() => getConversation(convId)?.title ?? '')
  const [convCreated, setConvCreated] = useState<number>(() => getConversation(convId)?.createdAt ?? Date.now())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null)
  const lastReply = useRef('')

  // 切换子频道 / 功能页时，加载对应会话（接着对话）
  useEffect(() => {
    const c = getConversation(convId)
    setMessages(c ? c.messages.map((m: StoredMsg) => ({ role: m.role, content: m.content, image: m.image ?? null })) : [])
    setConvTitle(c?.title ?? '')
    setConvCreated(c?.createdAt ?? Date.now())
    setSearchMeta(null)
    setInput('')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId])

  function persist(nextMsgs: Msg[], title: string) {
    const conv: Conversation = {
      id: convId,
      pageKey,
      channel,
      title: title || '未命名对话',
      messages: nextMsgs.map((m) => ({ role: m.role, content: m.content, image: m.image ?? null })),
      createdAt: convCreated,
      updatedAt: Date.now()
    }
    upsertConversation(conv)
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setError('')
    setSearchMeta(null)
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    const title = convTitle || text.slice(0, 24)
    setConvTitle(title)
    persist(next, title)
    setInput('')
    setLoading(true)
    try {
      const { content, search } = await agnesChat(
        [{ role: 'system', content: systemPrompt + '\n\n' + PROMPT_EMPHASIS }, ...next.map((m): ChatMsg => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))],
        { webSearch }
      )
      setSearchMeta(search ?? null)
      lastReply.current = content
      const aiMsg: Msg = { role: 'ai' as const, content, image: search?.image ?? null }
      const merged = [...next, aiMsg]
      setMessages(merged)
      persist(merged, title)

      // 同时写入「查询记录」（每次提问留痕，可点开看详情）
      const q: QueryRecord = {
        id: newId(),
        pageKey,
        channel,
        pageLabel: title,
        question: text,
        answer: content,
        search: search ?? null,
        image: search?.image ?? null,
        createdAt: Date.now()
      }
      addQuery(q)
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  function newChat() {
    deleteConversation(convId)
    setMessages([])
    setConvTitle('')
    setConvCreated(Date.now())
    setSearchMeta(null)
    setInput('')
    setError('')
    lastReply.current = ''
  }

  async function copy() {
    if (!lastReply.current) return
    try {
      await navigator.clipboard.writeText(lastReply.current)
    } catch {}
  }

  const roleLabel = (r: 'user' | 'ai') => (r === 'user' ? '你' : 'AI')

  return (
    <div className={`panel theme-${theme}`}>
      <div className="panel-head">
        <span className="who">{title}</span>
        <button className="head-btn" onClick={newChat} title="清空当前对话，重新开始">
          新建对话
        </button>
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
            在下方输入，AI 会<b>先联网检索真实资料</b>，再结合多维度分析给出带颜色标记的结论（优点 / 缺点 / 亮点 / 重点 一目了然），关键事实会标注来源，<b>重要信息自动加粗标红</b>。
            <br />
            <span className="note-sub">提示：检索来自公开网络，可能不保证 100% 最新；重大决策请以官方最新信息为准。若检索服务暂不可用，会自动降级为模型自身知识作答。对话会自动保存，可在右上角「🕘 历史」里接着聊。</span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">
              <div className="role">{roleLabel(m.role)}</div>
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
