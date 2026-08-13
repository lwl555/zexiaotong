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
import { PROMPT_EMPHASIS, SYSTEM_IDENTITY } from '../lib/prompts'

interface Props {
  title: string
  systemPrompt: string
  placeholder: string
  webSearch?: boolean
  /** 由服务端模型自动判断是否检索（优先级高于 webSearch） */
  autoSearch?: boolean
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
  /** 空白态展示的示例快捷问题（点击直接发送） */
  examples?: readonly string[]
  /** AI 回复后展示的追问建议（点击作为下一条提问，沿用上下文） */
  followups?: readonly string[]
}

interface Msg {
  role: 'user' | 'ai'
  content: string
  /** 该条 AI 回复对应的真实题图（学校/实体照片），来自维基百科 */
  image?: { url: string; title: string } | null
  /** 模型内部思考过程（推理过程），可空 */
  reasoning?: string | null
  /** 真实场景图（最多 4 张），可空 */
  images?: { url: string; title: string }[] | null
}

export default function AIChat({
  title,
  systemPrompt,
  placeholder,
  webSearch,
  autoSearch,
  theme = 'school',
  pageKey = 'ai-search',
  channel = 'school',
  exportable,
  exportName,
  exportTitle,
  examples,
  followups
}: Props) {
  const convId = `${pageKey}:${channel}`
  const [messages, setMessages] = useState<Msg[]>(() => {
    const c = getConversation(convId)
    return c ? c.messages.map((m: StoredMsg) => ({ role: m.role, content: m.content, image: m.image ?? null, reasoning: m.reasoning ?? null, images: m.images ?? null })) : []
  })
  const [convTitle, setConvTitle] = useState<string>(() => getConversation(convId)?.title ?? '')
  const [convCreated, setConvCreated] = useState<number>(() => getConversation(convId)?.createdAt ?? Date.now())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null)
  const lastReply = useRef('')
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // 切换子频道 / 功能页时，加载对应会话（接着对话）
  useEffect(() => {
    const c = getConversation(convId)
    setMessages(c ? c.messages.map((m: StoredMsg) => ({ role: m.role, content: m.content, image: m.image ?? null, reasoning: m.reasoning ?? null, images: m.images ?? null })) : [])
    setConvTitle(c?.title ?? '')
    setConvCreated(c?.createdAt ?? Date.now())
    setSearchMeta(null)
    setInput('')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId])

  // 新内容出现时自动滚到底部（仅当用户本就在底部附近，避免打断回看历史）
  useEffect(() => {
    const nearBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160
    if (nearBottom) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

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

  async function send(override?: string) {
    const text = (override ?? input).trim()
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
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const { content, search, reasoning } = await agnesChat(
        [{ role: 'system', content: `${SYSTEM_IDENTITY}\n\n${systemPrompt}\n\n${PROMPT_EMPHASIS}` }, ...next.map((m): ChatMsg => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))],
        { webSearch: (webSearch || autoSearch) ?? false, autoSearch, signal: controller.signal }
      )
      setSearchMeta(search ?? null)
      lastReply.current = content
      const aiMsg: Msg = {
        role: 'ai' as const,
        content,
        image: search?.image ?? null,
        images: search?.images ?? null,
        reasoning: reasoning ?? null
      }
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
        images: search?.images ?? null,
        createdAt: Date.now()
      }
      addQuery(q)
    } catch (e: any) {
      // 用户主动「停止生成」会触发 AbortError，不当作错误提示
      if (e?.name === 'AbortError') {
        setError('')
        return
      }
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
    abortRef.current = null
  }

  function newChat() {
    abortRef.current?.abort()
    abortRef.current = null
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
        {(webSearch || autoSearch) && searchMeta?.ok && (
          <span className="meta ok">🌐 已参考 {searchMeta.count} 条公开资料（{searchMeta.sources.map(srcLabel).join(' · ')}）</span>
        )}
        {(webSearch || autoSearch) && searchMeta && !searchMeta.ok && (
          <span className="meta warn">⚠️ 公开资料暂时无法获取，已按已有知识作答</span>
        )}
        {(webSearch || autoSearch) && !searchMeta && !loading && (
          <span className="meta">· {autoSearch ? 'AI 将自动判断是否联网检索' : '待检索'}</span>
        )}
        {loading && (
          <span className="meta">
            🌐 {(webSearch || autoSearch) ? '正在联网检索并分析最新资料…' : '生成中…'}
          </span>
        )}
      </div>

      <div className="panel-body">
        {messages.length === 0 && !loading && (
          <div className="note">
            在下方输入，AI 会<b>先联网检索真实资料</b>，再结合多维度分析给出带颜色标记的结论（优点 / 缺点 / 亮点 / 重点 一目了然），关键事实会标注来源，<b>重要信息自动加粗标红</b>。
            <br />
            <span className="note-sub">提示：检索来自公开网络，可能不保证 100% 最新；重大决策请以官方最新信息为准。若检索服务暂不可用，会自动降级为模型自身知识作答。对话会自动保存，可在右上角「🕘 历史」里接着聊。</span>
          </div>
        )}
        {messages.length === 0 && !loading && examples && examples.length > 0 && (
          <div className="chips-wrap">
            <div className="chips-label">直接点试试：</div>
            <div className="chips">
              {examples.map((ex) => (
                <button key={ex} className="chip" onClick={() => send(ex)}>
                  {ex}
                </button>
              ))}
            </div>
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
                  {m.reasoning ? (
                    <details className="reasoning">
                      <summary>🤔 AI 思考过程（内部推理，仅供参考）</summary>
                      <div className="reasoning-body">{m.reasoning}</div>
                    </details>
                  ) : null}
                  {m.images && m.images.length > 0 && (
                    <div className="scene-strip">
                      {m.images.map((img, i) => (
                        <figure key={i} className="scene-thumb">
                          <img src={img.url} alt={img.title || '场景图'} loading="lazy" referrerPolicy="no-referrer" />
                          <figcaption>{img.title}</figcaption>
                        </figure>
                      ))}
                    </div>
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
                <span className="spinner" /> {webSearch || autoSearch ? '🌐 正在联网检索并分析最新资料…' : `正在${messages.some((m) => m.role === 'user') ? '拆解分析' : '准备'}…`}
              </div>
            </div>
          </div>
        )}
        {error && <div className="err">出错了：{error}</div>}

        {messages.some((m) => m.role === 'ai') && !loading && followups && followups.length > 0 && (
          <div className="followups">
            <div className="chips-label">接着深挖：</div>
            <div className="chips">
              {followups.map((f) => (
                <button key={f} className="chip" onClick={() => send(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

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
        <div ref={endRef} />
      </div>

      <div className="chat-input">
        <input
          value={input}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && send()}
        />
        {loading ? (
          <button className="btn btn-stop" onClick={stop}>
            停止
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => send()} disabled={!input.trim()}>
            发送
          </button>
        )}
      </div>
    </div>
  )
}
