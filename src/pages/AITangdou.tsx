import { useState, useRef, useEffect } from 'react'
import { agnesChat, ChatMsg, LinkInfo } from '../lib/agnes'

// ─── 提示词 ─────────────────────────────────────────────────────

const PROMPT = `你是「择校通」平台上的 AI 助手，名字叫「糖豆」。
你是一个简洁、高效、全能的 AI 助手，语气亲切自然，回答直击要点。

【身份纪律】
- 始终以「糖豆」身份回答，不要自称或暗示任何第三方大模型。
- 若用户问「你是谁」，回答：「我是择校通的 AI 糖豆，一个帮你解决各种问题的小助手。」

【回答风格】
- 简洁明了，不要废话，先给结论再展开。
- 重要数据和关键词用 **双星号** 包裹。
- 用列表和分段让内容结构清晰。
- 回答中如需整理成表格，使用 markdown 表格语法（| 列1 | 列2 | ... |），前端会自动渲染为真实表格。

【联网检索】
- 可以联网检索获取最新信息，检索到的资料要标注【资料·来源：xxx】。
- 自身知识整理的部分如实标注"根据公开信息整理"。`

const QUICK_ACTIONS = [
  { icon: '📝', label: '帮我写作', prompt: '帮我写一篇关于以下主题的文案：' },
  { icon: '🌐', label: '翻译', prompt: '请将以下内容翻译成英文：' },
  { icon: '💻', label: '写代码', prompt: '请用代码帮我实现：' },
  { icon: '🧮', label: '算题', prompt: '请帮我解答这道题：' },
  { icon: '💡', label: '头脑风暴', prompt: '帮我想几个关于以下主题的创意：' },
  { icon: '📊', label: '做表格', prompt: '帮我整理成表格：' },
  { icon: '✏️', label: '改写润色', prompt: '帮我润色以下内容，让表达更流畅专业：' },
  { icon: '🔍', label: '联网搜索', prompt: '帮我搜索以下最新信息：' }
]

// ─── 图片压缩 ───────────────────────────────────────────────────

function compressImage(file: File, maxW = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > maxW) { h = h * maxW / w; w = maxW }
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Markdown 渲染（支持表格、列表、代码块、标题、加粗） ──────

function renderMarkdown(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  const elements: JSX.Element[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].replace(/\r$/, '')

    // 空行
    if (!line.trim()) { i++; continue }

    // 代码块
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]); i++
      }
      i++ // skip closing ```
      elements.push(
        <div key={i} style={{
          margin: '10px 0', borderRadius: 10, overflow: 'hidden',
          border: '1px solid #e5e7eb', background: '#f9fafb'
        }}>
          {lang && <div style={{ padding: '6px 12px', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f3f4f6' }}>{lang}</div>}
          <pre style={{ padding: '12px 14px', overflow: 'auto', fontSize: 13, lineHeight: 1.6, margin: 0, fontFamily: 'ui-monospace, SF Mono, Menlo, monospace' }}>
            <code>{buf.join('\n')}</code>
          </pre>
        </div>
      )
      continue
    }

    // 表格：连续以 | 开头的行
    if (line.trim().startsWith('|')) {
      const tableRows: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableRows.push(lines[i].trim()); i++
      }
      if (tableRows.length >= 2) {
        const headerRow = tableRows[0]
        const bodyRows = tableRows.slice(2) // skip separator
        const parseRow = (r: string) => r.split('|').filter(c => c.trim() !== '').map(c => c.trim())
        const headers = parseRow(headerRow)
        elements.push(
          <div key={i} style={{ margin: '12px 0', overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#fef3c7' }}>
                  {headers.map((h, j) => <th key={j} style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #f59e0b', fontWeight: 600, color: '#92400e' }}>{inlineRender(h)}</th>)}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => {
                  const cells = parseRow(row)
                  return (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      {cells.map((c, ci) => <td key={ci} style={{ padding: '9px 14px', borderBottom: '1px solid #e5e7eb' }}>{inlineRender(c)}</td>)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
        continue
      }
    }

    // 标题
    const hMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (hMatch) {
      const Tag = `h${hMatch[1].length}` as keyof JSX.IntrinsicElements
      const size = hMatch[1].length === 1 ? 18 : hMatch[1].length === 2 ? 16 : 15
      elements.push(<Tag key={i} style={{ margin: '14px 0 6px', fontSize: size, fontWeight: 600, color: '#1c1814' }}>{inlineRender(hMatch[2])}</Tag>)
      i++; continue
    }

    // 列表
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, '')); i++
      }
      elements.push(
        <ul key={i} style={{ margin: '6px 0', paddingLeft: 20, lineHeight: 1.8 }}>
          {items.map((item, j) => <li key={j}>{inlineRender(item)}</li>)}
        </ul>
      )
      continue
    }

    // 普通段落
    elements.push(<p key={i} style={{ margin: '4px 0', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{inlineRender(line)}</p>)
    i++
  }
  return elements
}

// **加粗** 标红
function inlineRender(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/)
    if (m) return <strong key={i} style={{ color: '#c2410c', fontWeight: 600 }}>{m[1]}</strong>
    if (p) return <span key={i}>{p}</span>
    return null
  })
}

// ─── 联网阶段提示 ───────────────────────────────────────────────

function phaseOf(ms: number): string {
  if (ms < 3000) return '🌐 正在联网搜索…'
  if (ms < 12000) return '🤔 正在思考…'
  if (ms < 30000) return '✍️ 正在整理回答…'
  return '⏳ 生成中，请稍候…'
}

// ─── 消息类型 ───────────────────────────────────────────────────

interface Msg {
  role: 'user' | 'ai'
  content: string
  reasoning?: string | null
  links?: LinkInfo[] | null
  image?: string | null  // base64 for sent image
}

// ─── 组件 ───────────────────────────────────────────────────────

export default function AITangdou() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [showActions, setShowActions] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const startRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current) } }, [])
  useEffect(() => {
    if (endRef.current && (messages.length > 0 || loading)) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  async function run(next: Msg[]) {
    setLoading(true)
    startRef.current = Date.now()
    setElapsedMs(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startRef.current), 200)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      // 构造 messages：如果有图片，放在最后一条 user message 里
      const chatMessages: ChatMsg[] = [
        { role: 'system', content: PROMPT },
        ...next.slice(0, -1).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
      ]
      const lastMsg = next[next.length - 1]
      if (lastMsg.image) {
        // multimodal: content = text + image_url
        chatMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: lastMsg.content || '请描述这张图片' },
            { type: 'image_url', image_url: { url: lastMsg.image } }
          ] as any
        })
      } else {
        chatMessages.push({ role: 'user', content: lastMsg.content })
      }

      const { content, search, reasoning } = await agnesChat(chatMessages, {
        autoSearch: true,
        signal: controller.signal
      })

      const safeContent = content?.trim() || '⚠️ 这一轮没拿到回复，请换个说法再试试。'
      const aiMsg: Msg = { role: 'ai', content: safeContent, reasoning: reasoning ?? null, links: search?.links ?? null }
      setMessages([...next, aiMsg])
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || '请求失败')
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setLoading(false)
      abortRef.current = null
    }
  }

  async function send(override?: string) {
    const text = (override ?? input).trim()
    if (!text && !pendingImage) return
    setError('')
    const next = [...messages, { role: 'user' as const, content: text, image: pendingImage }]
    setMessages(next)
    setInput('')
    setPendingImage(null)
    setShowActions(false)
    await run(next)
  }

  function stop() { abortRef.current?.abort(); abortRef.current = null }

  function newChat() {
    abortRef.current?.abort()
    setMessages([])
    setInput('')
    setPendingImage(null)
    setError('')
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImage(file, 1024, 0.7)
      setPendingImage(compressed)
    } catch { /* ignore */ }
    e.target.value = ''
  }

  function removePendingImage() { setPendingImage(null) }

  function useAction(action: typeof QUICK_ACTIONS[0]) {
    setInput(action.prompt)
    setShowActions(false)
    inputRef.current?.focus()
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)',
      background: '#ffffff', maxWidth: 880, margin: '0 auto', width: '100%'
    }}>
      {/* 消息区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', marginTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🍬</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#333', marginBottom: 8 }}>你好，我是糖豆</div>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>可以帮你写作、翻译、算题、写代码、识图分析，或者随便聊聊天</div>
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
              maxWidth: '78%', padding: m.image ? 0 : '12px 16px', borderRadius: 16,
              background: m.role === 'user' ? '#c2410c' : '#f7f7f7',
              color: m.role === 'user' ? '#fff' : '#333',
              fontSize: 15, lineHeight: 1.7,
              borderTopRightRadius: m.role === 'user' ? 4 : 16,
              borderTopLeftRadius: m.role === 'user' ? 16 : 4,
              wordBreak: 'break-word', overflow: 'hidden'
            }}>
              {m.image && (
                <div style={{ padding: '10px 10px 0' }}>
                  <img src={m.image} alt="用户发送的图片" style={{ maxWidth: 200, maxHeight: 180, borderRadius: 10, display: 'block' }} />
                </div>
              )}
              {m.image && m.content && <div style={{ padding: '8px 12px' }}>{m.content}</div>}
              {!m.image && m.role === 'ai' && renderMarkdown(m.content)}
              {!m.image && m.role === 'user' && <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>}
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
            {m.role === 'user' && !m.image && (
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

      {/* 底部 */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #f0f0f0', background: '#fff' }}>
        {/* 功能面板 */}
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

        {/* 待发送图片预览 */}
        {pendingImage && (
          <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10, background: '#fef3c7' }}>
            <img src={pendingImage} alt="待发送" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
            <span style={{ fontSize: 13, color: '#92400e' }}>图片已压缩，将与消息一起发送</span>
            <button onClick={removePendingImage} style={{
              marginLeft: 'auto', border: 'none', background: '#f59e0b', color: '#fff',
              borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer'
            }}>移除</button>
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
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} title="上传图片" style={{
              width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: pendingImage ? '#c2410c' : '#f5f5f5', fontSize: 16, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, transition: 'all .15s'
            }}>📷</button>
            <button onClick={newChat} title="新对话" style={{
              width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#f5f5f5', fontSize: 16, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, transition: 'all .15s'
            }}>＋</button>
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
              <button onClick={() => send()} disabled={!input.trim() && !pendingImage} style={{
                width: 36, height: 36, borderRadius: 8, border: 'none', cursor: (input.trim() || pendingImage) ? 'pointer' : 'default',
                background: (input.trim() || pendingImage) ? '#c2410c' : '#eee', color: (input.trim() || pendingImage) ? '#fff' : '#aaa',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all .15s'
              }}>↑</button>
            )}
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginTop: 6 }}>
            糖豆 由择校通平台提供 · 内容仅供参考
          </div>
        </div>
      </div>
    </div>
  )
}
