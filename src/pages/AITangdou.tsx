import { useState, useRef, useEffect, type SyntheticEvent } from 'react'
import { agnesChat, ChatMsg, SearchMeta, LinkInfo } from '../lib/agnes'
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
import { exportDocx } from '../lib/docx'
import { SYSTEM_IDENTITY, PROMPT_EMPHASIS } from '../lib/prompts'

// AI 糖豆的专属系统提示词：简洁、亲切、全能助手风格
const PROMPT_AI_TANGDOU = `你是「择校通」平台上的 AI 助手，名字叫「AI糖豆」。
你是一个简洁、高效、全能的 AI 助手，语气亲切自然，回答直击要点。

【身份纪律】
- 始终以「AI糖豆」身份回答，不要自称或暗示任何第三方大模型。
- 若用户问「你是谁」，回答：「我是择校通的 AI 糖豆，一个帮你解决各种问题的小助手。」

【回答风格】
- 简洁明了，不要废话，先给结论再展开。
- 该详细时详细，该简短时简短，根据问题灵活调整。
- 重要数据和关键词用 **双星号** 包裹，方便用户一眼看到重点。
- 用列表和分段让内容结构清晰，避免一大段文字糊脸上。

【联网检索】
- 可以联网检索获取最新信息，检索到的资料要标注【资料·来源：xxx】。
- 自身知识整理的部分不要说成检索结果，如实标注"根据公开信息整理"。`

// 底部功能面板按钮
interface QuickAction {
  icon: string
  label: string
  prompt: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: '📝', label: '帮我写作', prompt: '帮我写一篇关于以下主题的文案：' },
  { icon: '🌐', label: '翻译', prompt: '请将以下内容翻译成英文：' },
  { icon: '💻', label: '写代码', prompt: '请用代码帮我实现：' },
  { icon: '🧮', label: '算题', prompt: '请帮我解答这道题：' },
  { icon: '💡', label: '头脑风暴', prompt: '帮我想几个关于以下主题的创意：' },
  { icon: '📊', label: '做表格', prompt: '帮我整理成表格：' },
  { icon: '✏️', label: '改写润色', prompt: '帮我润色以下内容，让表达更流畅专业：' },
  { icon: '🔍', label: '联网搜索', prompt: '帮我搜索以下最新信息：' }
]

// 检索来源英文 key → 中文标签
const SRC_LABEL: Record<string, string> = {
  gnews: '新闻', hn: '技术讨论', bing: '网页', 'bing-social': '社媒',
  reddit: '社区', 'wiki-zh': '维基(中)', 'wiki-en': '维基(英)', ddg: 'DuckDuckGo',
  tavily: '综合检索', 'tavily-social': '社媒', brave: 'Brave', serper: 'Serper', baidu: '百度'
}
const srcLabel = (s: string) => SRC_LABEL[s] || s

// 联网阶段提示
function phaseOf(ms: number): string {
  if (ms < 3000) return '🌐 正在联网搜索…'
  if (ms < 12000) return '🤔 正在思考…'
  if (ms < 30000) return '✍️ 正在整理回答…'
  return '⏳ 生成中，请稍候…'
}

interface Msg {
  role: 'user' | 'ai'
  content: string
  reasoning?: string | null
  links?: LinkInfo[] | null
}

// 渲染 **重点** 标红加粗
function renderInline(text: string) {
  if (!text) return []
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/)
    if (m) return <strong key={i} style={{ color: '#c2410c', fontWeight: 600 }}>{m[1]}</strong>
    if (p) return <span key={i}>{p}</span>
    return null
  })
}

// 简单 markdown 渲染（段落 + 列表 + 代码块）
function renderContent(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  const elements: JSX.Element[] = []
  let listItems: string[] = []
  let inCode = false
  let codeBuf: string[] = []

  const flushList = () => {
    if (listItems.length) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: '6px 0', paddingLeft: 20, lineHeight: 1.8 }}>
          {listItems.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
        </ul>
      )
      listItems = []
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')

    // 代码块
    if (line.startsWith('```')) {
      if (inCode) {
        elements.push(
          <pre key={`code-${elements.length}`} style={{
            background: '#f5f5f5', padding: '10px 14px', borderRadius: 8,
            overflow: 'auto', fontSize: 13, lineHeight: 1.6, margin: '8px 0',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
          }}>
            <code>{codeBuf.join('\n')}</code>
          </pre>
        )
        codeBuf = []
        inCode = false
      } else {
        flushList()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }

    // 空行
    if (!line.trim()) {
      flushList()
      continue
    }

    // 列表
    const listMatch = line.match(/^[-*]\s+(.*)$/)
    if (listMatch) {
      listItems.push(listMatch[1])
      continue
    }
    flushList()

    // 标题
    const hMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (hMatch) {
      const Tag = `h${hMatch[1].length}` as keyof JSX.IntrinsicElements
      elements.push(<Tag key={`h-${elements.length}`} style={{ margin: '12px 0 6px', fontSize: 15, fontWeight: 600 }}>{renderInline(hMatch[2])}</Tag>)
      continue
    }

    // 普通段落
    elements.push(<p key={`p-${elements.length}`} style={{ margin: '4px 0', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{renderInline(line)}</p>)
  }
  flushList()
  return elements
}

export default function AITangdou() {
  const convId = 'ai-tangdou:main'
  const [messages, setMessages] = useState<Msg[]>(() => {
    const c = getConversation(convId)
    return c ? c.messages.map((m: StoredMsg) => ({ role: m.role, content: m.content, reasoning: m.reasoning ?? null, links: m.links ?? null })) : []
  })
  const [convTitle, setConvTitle] = useState<string>(() => getConversation(convId)?.title ?? '')
  const [convCreated, setConvCreated] = useState<number>(() => getConversation(convId)?.createdAt ?? Date.now())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [showActions, setShowActions] = useState(false)
  const lastReply = useRef('')
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const startRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200
    if (nearBottom) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function persist(nextMsgs: Msg[], title: string) {
    const conv: Conversation = {
      id: convId, pageKey: 'ai-tangdou', channel: 'main',
      title: title || '新对话',
      messages: nextMsgs.map((m) => ({ role: m.role, content: m.content, reasoning: m.reasoning ?? null, links: m.links ?? null })),
      createdAt: convCreated, updatedAt: Date.now()
    }
    upsertConversation(conv)
  }

  async function run(next: Msg[]) {
    const title = convTitle || next[next.length - 1]?.content.slice(0, 20) || '对话'
    setConvTitle(title)
    persist(next, title)
    setLoading(true)
    startRef.current = Date.now()
    setElapsedMs(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startRef.current), 200)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const now = new Date()
      const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
      const systemContent = `${SYSTEM_IDENTITY.replace(/名字叫「择校通助手」/g, '名字叫「AI糖豆」')}\n\n${PROMPT_AI_TANGDOU}\n\n${PROMPT_EMPHASIS}`
      const { content, search, reasoning, degraded: isDegraded } = await agnesChat(
        [{ role: 'system', content: systemContent }, ...next.map((m): ChatMsg => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))],
        { autoSearch: true, signal: controller.signal }
      )

      const safeContent = content?.trim() || '⚠️ 这一轮没拿到回复，请换个说法再试试。'
      const aiMsg: Msg = { role: 'ai' as const, content: safeContent, reasoning: reasoning ?? null, links: search?.links ?? null }
      const merged = [...next, aiMsg]
      setMessages(merged)
      persist(merged, title)
      lastReply.current = safeContent

      const q: QueryRecord = {
        id: newId(), pageKey: 'ai-tangdou', channel: 'main', pageLabel: 'AI糖豆',
        question: next[next.length - 1]?.content || '', answer: safeContent,
        search: search ?? null, links: search?.links ?? null, reasoning: reasoning ?? null,
        createdAt: Date.now()
      }
      addQuery(q)
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(String(e?.message || e))
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setLoading(false)
      abortRef.current = null
    }
  }

  async function send(override?: string) {
    const text = (override ?? input).trim()
    if (!text || loading) return
    setError('')
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setShowActions(false)
    await run(next)
  }

  function stop() {
    abortRef.current?.abort()
    abortRef.current = null
  }

  function newChat() {
    abortRef.current?.abort()
    deleteConversation(convId)
    setMessages([])
    setConvTitle('')
    setConvCreated(Date.now())
    setInput('')
    setError('')
    lastReply.current = ''
  }

  // 快捷功能：填入输入框
  function useAction(action: QuickAction) {
    setInput(action.prompt)
    setShowActions(false)
    inputRef.current?.focus()
  }

  // 自适应 textarea 高度
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)',
      background: '#ffffff', maxWidth: 880, margin: '0 auto', width: '100%'
    }}>
      {/* 顶部栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid #f0f0f0', flexShrink: 0
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🍬</span> AI糖豆
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>你的全能 AI 助手，问啥答啥</div>
        </div>
        <button onClick={newChat} style={{
          padding: '6px 14px', border: '1px solid #e5e5e5', borderRadius: 8,
          background: '#fff', cursor: 'pointer', fontSize: 13, color: '#555'
        }}>＋ 新对话</button>
      </div>

      {/* 消息区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', marginTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🍬</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#333', marginBottom: 8 }}>你好，我是 AI糖豆</div>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>可以帮你写作、翻译、算题、写代码，或者随便聊聊天</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, maxWidth: 560, margin: '0 auto' }}>
              {['写一封求职信', 'Python 快速排序', '翻译成英文', '头脑风暴创业点子'].map((ex) => (
                <button key={ex} onClick={() => send(ex)} style={{
                  padding: '10px 18px', borderRadius: 20, border: '1px solid #e8e8e8',
                  background: '#fafafa', cursor: 'pointer', fontSize: 14, color: '#555',
                  transition: 'all .15s'
                }} onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0' }}
                   onMouseLeave={(e) => { e.currentTarget.style.background = '#fafafa' }}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
            {m.role === 'ai' && (
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#f5f0e8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0, marginRight: 10
              }}>🍬</div>
            )}
            <div style={{
              maxWidth: '78%', padding: '12px 16px', borderRadius: 16,
              background: m.role === 'user' ? '#c2410c' : '#f7f7f7',
              color: m.role === 'user' ? '#fff' : '#333',
              fontSize: 15, lineHeight: 1.7,
              borderTopRightRadius: m.role === 'user' ? 4 : 16,
              borderTopLeftRadius: m.role === 'user' ? 16 : 4,
              wordBreak: 'break-word'
            }}>
              {m.role === 'ai' ? renderContent(m.content) : <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>}
              {m.links && m.links.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #e5e5e5', fontSize: 13 }}>
                  <div style={{ color: '#888', marginBottom: 4 }}>🔗 参考资料：</div>
                  {m.links.slice(0, 4).map((lk, j) => (
                    <a key={j} href={lk.url} target="_blank" rel="noopener noreferrer"
                       style={{ display: 'block', color: '#1d4ed8', marginBottom: 2, textDecoration: 'none' }}>
                      {lk.title || lk.url}
                    </a>
                  ))}
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#e8e0d8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0, marginLeft: 10
              }}>我</div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: '#f5f0e8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0, marginRight: 10
            }}>🍬</div>
            <div style={{
              padding: '12px 16px', borderRadius: 16, background: '#f7f7f7',
              borderTopLeftRadius: 4, fontSize: 14, color: '#666'
            }}>
              <span style={{ marginRight: 8 }}>{phaseOf(elapsedMs)}</span>
              <span style={{ color: '#aaa', fontSize: 12 }}>{(elapsedMs / 1000).toFixed(1)}s</span>
            </div>
          </div>
        )}

        {error && <div style={{ color: '#b42318', fontSize: 14, textAlign: 'center', margin: '12px 0' }}>出错了：{error}</div>}
        <div ref={endRef} />
      </div>

      {/* 底部功能面板 + 输入区 */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #f0f0f0', background: '#fff' }}>
        {/* 功能面板（可折叠） */}
        {showActions && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
            padding: '12px 20px', borderBottom: '1px solid #f5f5f5'
          }}>
            {QUICK_ACTIONS.map((a) => (
              <button key={a.label} onClick={() => useAction(a)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 4px', borderRadius: 10, border: '1px solid #eee',
                background: '#fafafa', cursor: 'pointer', transition: 'all .15s'
              }} onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.borderColor = '#ddd' }}
                 onMouseLeave={(e) => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = '#eee' }}>
                <span style={{ fontSize: 20 }}>{a.icon}</span>
                <span style={{ fontSize: 12, color: '#666' }}>{a.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* 输入区 */}
        <div style={{ padding: '12px 20px 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            border: '1px solid #e5e5e5', borderRadius: 12, padding: '8px 8px 8px 14px',
            background: '#fafafa', transition: 'border-color .15s'
          }}>
            <textarea
              ref={inputRef}
              value={input}
              placeholder="发消息或点击下方功能…"
              onChange={(e) => { setInput(e.target.value); autoResize(e.target) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !loading) { e.preventDefault(); send() } }}
              rows={1}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 15, lineHeight: 1.6, resize: 'none', maxHeight: 160,
                fontFamily: 'inherit', padding: '6px 0'
              }}
            />
            {/* 功能面板切换按钮 */}
            <button onClick={() => setShowActions((v) => !v)} title="快捷功能" style={{
              width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: showActions ? '#c2410c' : '#eee', color: showActions ? '#fff' : '#666',
              fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all .15s'
            }}>⚡</button>
            {loading ? (
              <button onClick={stop} style={{
                width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#eee', fontSize: 14, flexShrink: 0
              }}>⏹</button>
            ) : (
              <button onClick={() => send()} disabled={!input.trim()} style={{
                width: 36, height: 36, borderRadius: 8, border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                background: input.trim() ? '#c2410c' : '#eee', color: input.trim() ? '#fff' : '#aaa',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all .15s'
              }}>↑</button>
            )}
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginTop: 6 }}>
            AI糖豆 由择校通平台提供 · 内容仅供参考
          </div>
        </div>
      </div>
    </div>
  )
}
