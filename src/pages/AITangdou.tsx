import { useState, useRef, useEffect } from 'react'
import { agnesChat, ChatMsg, LinkInfo } from '../lib/agnes'
import { useIsMobile } from '../lib/useIsMobile'
import {
  Conversation, StoredMsg, getConversations, upsertConversation, deleteConversation, newId
} from '../lib/history'

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

// 顶部快捷气泡（千问风：3 个问题气泡 + 一排小功能标签）
const WELCOME_EXAMPLES = [
  '写一封求职信',
  'Python 快速排序',
  '翻译成英文',
  '头脑风暴创业点子'
]
const QUICK_TAGS = [
  { icon: '⚡', label: '帮我写作' },
  { icon: '🌐', label: '翻译' },
  { icon: '💻', label: '写代码' },
  { icon: '🧮', label: '算题' },
  { icon: '💡', label: '头脑风暴' },
  { icon: '📊', label: '做表格' },
  { icon: '🔍', label: '联网搜索' }
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
    reader.readAsDataURL(reader.result as string)
  })
}

// ─── Markdown 渲染 ─────────────────────────────────────────────

function renderMarkdown(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  const elements: JSX.Element[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].replace(/\r$/, '')

    if (!line.trim()) { i++; continue }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]); i++
      }
      i++
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

    if (line.trim().startsWith('|')) {
      const tableRows: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableRows.push(lines[i].trim()); i++
      }
      if (tableRows.length >= 2) {
        const headerRow = tableRows[0]
        const bodyRows = tableRows.slice(2)
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

    const hMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (hMatch) {
      const Tag = `h${hMatch[1].length}` as keyof JSX.IntrinsicElements
      const size = hMatch[1].length === 1 ? 18 : hMatch[1].length === 2 ? 16 : 15
      elements.push(<Tag key={i} style={{ margin: '14px 0 6px', fontSize: size, fontWeight: 600, color: '#1c1814' }}>{inlineRender(hMatch[2])}</Tag>)
      i++; continue
    }

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

    elements.push(<p key={i} style={{ margin: '4px 0', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{inlineRender(line)}</p>)
    i++
  }
  return elements
}

function inlineRender(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/)
    if (m) return <strong key={i} style={{ color: '#c2410c', fontWeight: 600 }}>{m[1]}</strong>
    if (p) return <span key={i}>{p}</span>
    return null
  })
}

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
  image?: string | null
}

const PAGE_KEY = 'ai-tangdou'
const CHANNEL = 'tangdou'

function msgToStored(m: Msg): StoredMsg {
  return {
    role: m.role,
    content: m.content,
    image: m.image ? { url: m.image, title: '用户图片' } : null,
    reasoning: m.reasoning ?? null,
    links: m.links ?? null
  }
}
function storedToMsg(s: StoredMsg): Msg {
  return {
    role: s.role,
    content: s.content,
    reasoning: s.reasoning ?? null,
    links: s.links ?? null,
    image: s.image?.url || null
  }
}

// ─── 历史抽屉 ──────────────────────────────────────────────────

function HistoryPanel({
  open, currentId, onClose, onSelect, onRename, onDelete, onNew
}: {
  open: boolean
  currentId: string
  onClose: () => void
  onSelect: (c: Conversation) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onNew: () => void
}) {
  const [convs, setConvs] = useState<Conversation[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  useEffect(() => {
    if (open) setConvs(getConversations().filter(c => c.pageKey === PAGE_KEY))
  }, [open])

  function refresh() { setConvs(getConversations().filter(c => c.pageKey === PAGE_KEY)) }
  function commitRename(id: string) {
    const t = editingTitle.trim()
    if (t) onRename(id, t)
    setEditingId(null)
    setEditingTitle('')
    refresh()
  }

  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100 }} />
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 'min(320px, 86vw)',
        background: '#fff', zIndex: 101, display: 'flex', flexDirection: 'column',
        boxShadow: '2px 0 12px rgba(0,0,0,.08)'
      }}>
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1c1814' }}>历史对话</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { onNew(); onClose() }} style={{
              border: 'none', background: '#c2410c', color: '#fff',
              borderRadius: 8, padding: '5px 12px', fontSize: 13, cursor: 'pointer'
            }}>＋ 新对话</button>
            <button onClick={onClose} style={{
              border: 'none', background: '#f5f5f5', color: '#666',
              borderRadius: 8, width: 28, height: 28, fontSize: 14, cursor: 'pointer'
            }}>✕</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {convs.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999', fontSize: 14 }}>
              还没有对话，发条消息就会自动保存
            </div>
          )}
          {convs.map(c => {
            const active = c.id === currentId
            const editing = editingId === c.id
            return (
              <div key={c.id} style={{
                padding: '10px 16px', cursor: editing ? 'default' : 'pointer',
                background: active ? '#fef3c7' : 'transparent',
                borderLeft: active ? '3px solid #c2410c' : '3px solid transparent',
                borderBottom: '1px solid #f8f8f8'
              }} onClick={() => !editing && onSelect(c)}>
                {editing ? (
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
                    <input
                      autoFocus value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename(c.id)
                        if (e.key === 'Escape') { setEditingId(null); setEditingTitle('') }
                      }}
                      style={{
                        flex: 1, border: '1px solid #c2410c', borderRadius: 6,
                        padding: '4px 8px', fontSize: 14, outline: 'none'
                      }}
                    />
                    <button onClick={() => commitRename(c.id)} style={{
                      border: 'none', background: '#c2410c', color: '#fff',
                      borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer'
                    }}>保存</button>
                  </div>
                ) : (
                  <>
                    <div style={{
                      fontSize: 14, color: '#1c1814', fontWeight: active ? 600 : 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>{c.title || '未命名对话'}</div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                      {c.messages.length} 条消息 · {new Date(c.updatedAt).toLocaleDateString('zh-CN')}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button onClick={e => {
                        e.stopPropagation()
                        setEditingId(c.id)
                        setEditingTitle(c.title)
                      }} style={{
                        border: 'none', background: 'transparent', color: '#666',
                        fontSize: 12, padding: 0, cursor: 'pointer'
                      }}>✏️ 重命名</button>
                      <button onClick={e => {
                        e.stopPropagation()
                        if (confirm(`删除对话「${c.title || '未命名'}」？`)) {
                          onDelete(c.id); refresh()
                        }
                      }} style={{
                        border: 'none', background: 'transparent', color: '#c2410c',
                        fontSize: 12, padding: 0, cursor: 'pointer'
                      }}>🗑 删除</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}

// ─── 主组件 ────────────────────────────────────────────────────

export default function AITangdou() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [showTags, setShowTags] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [currentConvId, setCurrentConvId] = useState<string>('')
  const [currentTitle, setCurrentTitle] = useState<string>('')
  const [mode, setMode] = useState<'chat' | 'work'>('chat')  // 对话 / 工作模式（PC端 tab）
  const [sidebarConvs, setSidebarConvs] = useState<Conversation[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const startRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMobile = useIsMobile()

  // 启动时尝试恢复最近一条对话
  useEffect(() => {
    const convs = getConversations().filter(c => c.pageKey === PAGE_KEY)
    if (convs.length > 0) {
      loadConv(convs[0])
    }
    refreshSidebar()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function refreshSidebar() {
    setSidebarConvs(getConversations().filter(c => c.pageKey === PAGE_KEY))
  }

  useEffect(() => {
    if (endRef.current && (messages.length > 0 || loading)) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  // 锁死整页滚动条：糖豆界面 mount 时禁止 body 滚动，unmount 时还原
  // 否则 Layout 的 .container padding-bottom 80px + footer ~76px 会把整页撑高
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyHeight = document.body.style.height
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.height = '100vh'
    return () => {
      document.body.style.overflow = prevOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.height = prevBodyHeight
    }
  }, [])

  function loadConv(c: Conversation) {
    setCurrentConvId(c.id)
    setCurrentTitle(c.title)
    setMessages(c.messages.map(storedToMsg))
  }

  function startNewChat() {
    abortRef.current?.abort()
    const id = `${PAGE_KEY}:${newId()}`
    setCurrentConvId(id)
    setCurrentTitle('')
    setMessages([])
    setInput('')
    setPendingImage(null)
    setError('')
  }

  function persist(messages: Msg[]) {
    if (!currentConvId || messages.length === 0) return
    const title = currentTitle || messages.find(m => m.role === 'user')?.content?.slice(0, 20) || '新对话'
    if (!currentTitle) setCurrentTitle(title)
    const conv: Conversation = {
      id: currentConvId,
      pageKey: PAGE_KEY,
      channel: CHANNEL,
      title,
      messages: messages.map(msgToStored),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    upsertConversation(conv)
    refreshSidebar()
  }

  async function run(next: Msg[]) {
    setLoading(true)
    startRef.current = Date.now()
    setElapsedMs(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startRef.current), 200)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const chatMessages: ChatMsg[] = [
        { role: 'system', content: PROMPT },
        ...next.slice(0, -1).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
      ]
      const lastMsg = next[next.length - 1]
      if (lastMsg.image) {
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
      const allMsgs = [...next, aiMsg]
      setMessages(allMsgs)
      persist(allMsgs)
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

    // 没在对话中：自动开新对话
    let convId = currentConvId
    if (!convId) {
      convId = `${PAGE_KEY}:${newId()}`
      setCurrentConvId(convId)
    }

    const next = [...messages, { role: 'user' as const, content: text, image: pendingImage }]
    setMessages(next)
    setInput('')
    setPendingImage(null)
    setShowTags(false)
    await run(next)
  }

  function stop() { abortRef.current?.abort(); abortRef.current = null }

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

  function useTag(tag: { icon: string; label: string }) {
    setInput(tag.label + '：')
    setShowTags(false)
    inputRef.current?.focus()
  }

  function renameConv(id: string, title: string) {
    const convs = getConversations().filter(c => c.pageKey === PAGE_KEY)
    const target = convs.find(c => c.id === id)
    if (!target) return
    upsertConversation({ ...target, title, updatedAt: Date.now() })
    if (id === currentConvId) setCurrentTitle(title)
    refreshSidebar()
  }

  function deleteConv(id: string) {
    deleteConversation(id)
    if (id === currentConvId) {
      const convs = getConversations().filter(c => c.pageKey === PAGE_KEY)
      if (convs.length > 0) loadConv(convs[0])
      else startNewChat()
    }
    refreshSidebar()
  }

  function autoResize(el: HTMLTextAreaElement) {
    // 固定初始高度（mobile 36 / PC 40），只在内容溢出时生长，最大 120
    const base = isMobile ? 36 : 40
    el.style.height = base + 'px'
    const next = Math.min(el.scrollHeight, 120)
    if (next > base) el.style.height = next + 'px'
  }

  const hasMessages = messages.length > 0

  // ─── PC 端左侧栏 ───────────────────────────────────────────
  const sidebar = !isMobile && (
    <aside style={{
      width: 260, flexShrink: 0, background: '#fafafa', borderRight: '1px solid #f0f0f0',
      display: 'flex', flexDirection: 'column', height: '100%'
    }}>
      {/* 顶部：糖豆 logo + 新对话 */}
      <div style={{ padding: '16px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 28, height: 28, borderRadius: '50%', background: '#fef3c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
          }}>🍬</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1c1814' }}>糖豆</span>
        </div>
        <button onClick={startNewChat} title="新对话" style={{
          width: 30, height: 30, borderRadius: 8, border: '1px solid #e5e5e5',
          background: '#fff', cursor: 'pointer', color: '#666', fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>＋</button>
      </div>

      {/* 导航项（豆包风：图标 + 文字） */}
      <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          { icon: '💬', label: '新对话', onClick: startNewChat },
          { icon: '🔍', label: '联网搜索', onClick: () => setInput('联网搜索：') },
          { icon: '✍️', label: '帮我写作', onClick: () => useTag({ icon: '', label: '帮我写作' }) },
          { icon: '📊', label: '做表格', onClick: () => useTag({ icon: '', label: '做表格' }) },
          { icon: '🌐', label: '翻译', onClick: () => useTag({ icon: '', label: '翻译' }) },
          { icon: '🖼️', label: '图像生成', onClick: () => fileRef.current?.click() },
          { icon: '🎬', label: '视频生成', onClick: () => fileRef.current?.click() }
        ].map(item => (
          <button key={item.label} onClick={item.onClick} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 8, border: 'none',
            background: 'transparent', cursor: 'pointer', color: '#333',
            fontSize: 14, textAlign: 'left', transition: 'background .15s'
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* 历史对话 */}
      <div style={{ padding: '14px 14px 6px', fontSize: 11, color: '#999', fontWeight: 600 }}>历史对话</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {sidebarConvs.length === 0 && (
          <div style={{ padding: '12px 10px', fontSize: 12, color: '#bbb' }}>还没有对话</div>
        )}
        {sidebarConvs.map(c => {
          const active = c.id === currentConvId
          return (
            <div key={c.id} onClick={() => loadConv(c)} style={{
              padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
              background: active ? '#fef3c7' : 'transparent',
              marginBottom: 2
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f0f0f0' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
              <div style={{
                fontSize: 13, color: '#1c1814', fontWeight: active ? 600 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>{c.title || '未命名对话'}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                {c.messages.length} 条
              </div>
            </div>
          )
        })}
      </div>

      {/* 底部用户区 */}
      <div style={{
        padding: '12px 14px', borderTop: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: '#e8e0d8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: '#666'
        }}>我</div>
        <span style={{ fontSize: 13, color: '#333' }}>我的</span>
      </div>
    </aside>
  )

  // ─── 主区消息气泡 ─────────────────────────────────────────
  const messageArea = (
    <div style={{
      flex: 1, overflowY: 'auto',
      // 不论有无消息，都保留上下 padding，让内容居中 / 第一个消息有安全距离
      padding: isMobile ? '16px' : '32px 48px'
    }}>
      {!hasMessages && !loading && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100%', padding: isMobile ? '40px 20px' : '40px 20px'
        }}>
          {!isMobile ? (
            /* PC端：豆包风 —— 大标题 + 双 tab + 推荐气泡 */
            <>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1c1814', marginBottom: 24 }}>
                有什么我能帮你的吗？
              </div>
              {/* 对话 / 工作 模式切换（豆包风） */}
              <div style={{
                display: 'inline-flex', background: '#f5f5f5', borderRadius: 24, padding: 4, marginBottom: 32
              }}>
                <button onClick={() => setMode('chat')} style={{
                  padding: '8px 28px', borderRadius: 20, border: 'none',
                  background: mode === 'chat' ? '#fff' : 'transparent',
                  color: '#1c1814', fontSize: 14, cursor: 'pointer',
                  fontWeight: mode === 'chat' ? 600 : 400,
                  boxShadow: mode === 'chat' ? '0 1px 3px rgba(0,0,0,.08)' : 'none'
                }}>对话</button>
                <button onClick={() => setMode('work')} style={{
                  padding: '8px 28px', borderRadius: 20, border: 'none',
                  background: mode === 'work' ? '#fff' : 'transparent',
                  color: '#1c1814', fontSize: 14, cursor: 'pointer',
                  fontWeight: mode === 'work' ? 600 : 400,
                  boxShadow: mode === 'work' ? '0 1px 3px rgba(0,0,0,.08)' : 'none'
                }}>工作</button>
              </div>
              {/* 推荐气泡列 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 560 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>为你推荐</div>
                {WELCOME_EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => send(ex)} style={{
                    padding: '12px 16px', borderRadius: 10, border: '1px solid #e8e8e8',
                    background: '#fff', cursor: 'pointer', fontSize: 14, color: '#333',
                    textAlign: 'left', transition: 'all .15s'
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = '#c2410c' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e8e8e8' }}>
                    {ex}
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Mobile端：圆形头像 + 标题 */
            <>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 30, marginBottom: 14
              }}>🍬</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#1c1814', marginBottom: 6 }}>
                你好，我是糖豆
              </div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 24, textAlign: 'center' }}>
                可以帮你写作、翻译、算题、写代码、识图分析，或者随便聊聊天
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 380 }}>
                {WELCOME_EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => send(ex)} style={{
                    padding: '12px 16px', borderRadius: 12, border: '1px solid #e8e8e8',
                    background: '#fff', cursor: 'pointer', fontSize: 14, color: '#555',
                    textAlign: 'left', transition: 'all .15s'
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = '#c2410c' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e8e8e8' }}>
                    {ex}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {messages.map((m, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
          {m.role === 'ai' && (
            <div style={{
              width: 30, height: 30, borderRadius: '50%', background: '#fef3c7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, flexShrink: 0, marginRight: 8
            }}>🍬</div>
          )}
          <div style={{
            maxWidth: isMobile ? '78%' : '70%', padding: m.image ? 0 : '10px 14px', borderRadius: 14,
            background: m.role === 'user' ? '#c2410c' : '#f5f5f5',
            color: m.role === 'user' ? '#fff' : '#1c1814',
            fontSize: 14, lineHeight: 1.7,
            borderTopRightRadius: m.role === 'user' ? 4 : 14,
            borderTopLeftRadius: m.role === 'user' ? 14 : 4,
            wordBreak: 'break-word', overflow: 'hidden'
          }}>
            {m.image && (
              <div style={{ padding: '8px 8px 0' }}>
                <img src={m.image} alt="用户发送的图片" style={{ maxWidth: 180, maxHeight: 160, borderRadius: 8, display: 'block' }} />
              </div>
            )}
            {m.image && m.content && <div style={{ padding: '6px 12px' }}>{m.content}</div>}
            {!m.image && m.role === 'ai' && renderMarkdown(m.content)}
            {!m.image && m.role === 'user' && <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>}
            {m.links && m.links.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #e5e5e5', fontSize: 12 }}>
                <div style={{ color: '#888', marginBottom: 3 }}>🔗 参考资料：</div>
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
              width: 30, height: 30, borderRadius: '50%', background: '#e8e0d8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, flexShrink: 0, marginLeft: 8
            }}>我</div>
          )}
        </div>
      ))}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: '#fef3c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, flexShrink: 0, marginRight: 8
          }}>🍬</div>
          <div style={{
            padding: '10px 14px', borderRadius: 14, background: '#f5f5f5',
            borderTopLeftRadius: 4, fontSize: 13, color: '#666'
          }}>
            <span style={{ marginRight: 6 }}>{phaseOf(elapsedMs)}</span>
            <span style={{ color: '#aaa', fontSize: 11 }}>{(elapsedMs / 1000).toFixed(1)}s</span>
          </div>
        </div>
      )}

      {error && <div style={{ color: '#b42318', fontSize: 13, textAlign: 'center', margin: '10px 0' }}>出错了：{error}</div>}
      <div ref={endRef} />
    </div>
  )

  // ─── 底部输入区 ───────────────────────────────────────────
  const bottomBar = (
    <div style={{ flexShrink: 0, background: '#fff' }}>
      {/* 待发送图片预览 */}
      {pendingImage && (
        <div style={{
          padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8,
          background: '#fef3c7', borderTop: '1px solid #fde68a'
        }}>
          <img src={pendingImage} alt="待发送" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
          <span style={{ fontSize: 12, color: '#92400e' }}>图片已压缩</span>
          <button onClick={removePendingImage} style={{
            marginLeft: 'auto', border: 'none', background: 'transparent',
            color: '#92400e', fontSize: 12, cursor: 'pointer', padding: 0
          }}>移除</button>
        </div>
      )}

      {/* Mobile 端：一行横排快捷功能（默认折叠，点 + 展开） */}
      {showTags && isMobile && (
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 16px',
          borderTop: '1px solid #f5f5f5', background: '#fafafa'
        }} className="no-scrollbar">
          {QUICK_TAGS.map(t => (
            <button key={t.label} onClick={() => useTag(t)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', borderRadius: 14, border: '1px solid #e5e5e5',
              background: '#fff', cursor: 'pointer', fontSize: 13, color: '#555',
              whiteSpace: 'nowrap', transition: 'all .15s'
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#c2410c'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e5e5'}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* 细长输入条 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: isMobile ? '8px 12px' : '10px 20px', borderTop: '1px solid #f0f0f0'
      }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} title="图片" style={{
          width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: pendingImage ? '#c2410c' : '#f5f5f5',
          color: pendingImage ? '#fff' : '#666',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 16, transition: 'all .15s'
        }}>📷</button>

        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: '#f5f5f5', borderRadius: isMobile ? 18 : 22,
          padding: '0 14px', height: isMobile ? 36 : 40,
          minHeight: isMobile ? 36 : 40, maxHeight: isMobile ? 36 : 40,
          overflow: 'hidden', boxSizing: 'border-box'
        }}>
          <textarea
            ref={inputRef}
            value={input}
            placeholder={isMobile ? '发消息或按住说话…' : '发消息或按住空格说话…'}
            onChange={(e) => { setInput(e.target.value); autoResize(e.target) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !loading) { e.preventDefault(); send() } }}
            rows={1}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, lineHeight: 1.4, resize: 'none',
              fontFamily: 'inherit', padding: 0,
              height: isMobile ? 36 : 40,
              boxSizing: 'border-box',
              minHeight: isMobile ? 36 : 40, maxHeight: 120,
              overflow: 'auto'
            }}
          />
        </div>

        {/* Mobile 端保留 + 按钮（快捷功能） */}
        {isMobile && (
          <button onClick={() => setShowTags(v => !v)} title="快捷功能" style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: showTags ? '#c2410c' : '#f5f5f5',
            color: showTags ? '#fff' : '#666',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 14, transition: 'all .15s'
          }}>＋</button>
        )}

        {loading ? (
          <button onClick={stop} style={{
            width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#f5f5f5', color: '#666', fontSize: 13, flexShrink: 0
          }}>⏹</button>
        ) : (input.trim() || pendingImage) ? (
          <button onClick={() => send()} style={{
            width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#c2410c', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 14
          }}>↑</button>
        ) : null}
      </div>

      {/* PC 端：输入条下方常驻一排小功能标签（豆包风） */}
      {!isMobile && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '8px 24px 4px',
          fontSize: 12, color: '#888'
        }}>
          {QUICK_TAGS.slice(0, 6).map(t => (
            <button key={t.label} onClick={() => useTag(t)} style={{
              border: 'none', background: 'transparent', color: '#666',
              fontSize: 12, cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', gap: 4
            }}
              onMouseEnter={e => e.currentTarget.style.color = '#c2410c'}
              onMouseLeave={e => e.currentTarget.style.color = '#666'}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', paddingBottom: 4 }}>
        糖豆 由择校通平台提供 · 内容仅供参考
      </div>
    </div>
  )

  // ─── 主区（顶部 + 中间 + 底部）────────────────────────────
  const mainArea = (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      minWidth: 0, height: '100%', background: '#fff'
    }}>
      {/* 顶部条：mobile 三件套，PC 极简只显示中间标题 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '10px 16px' : '14px 32px',
        borderBottom: '1px solid #f0f0f0',   // PC 端也加细线分隔，避免顶栏颜色混在一起
        background: '#fff', flexShrink: 0,
        minHeight: 48                       // 固定最小高度，避免被压缩
      }}>
        {isMobile ? (
          <>
            <button onClick={() => setHistoryOpen(true)} title="历史对话" style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              width: 36, height: 36, borderRadius: 8, fontSize: 20, color: '#333',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>☰</button>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 16, fontWeight: 600, color: '#1c1814'
            }}>
              <span style={{ fontSize: 20 }}>🍬</span>
              <span>{currentTitle || '糖豆'}</span>
            </div>
            <button onClick={startNewChat} title="新对话" style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              width: 36, height: 36, borderRadius: 8, fontSize: 18, color: '#666',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>＋</button>
          </>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 15, fontWeight: 600, color: '#1c1814'
          }}>
            <span style={{ fontSize: 18 }}>🍬</span>
            <span>{currentTitle || '糖豆'}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {messageArea}
        {bottomBar}
      </div>
    </div>
  )

  return (
    <div style={{
      display: 'flex',
      // body 已被 useEffect 锁死 overflow:hidden；这里只需扣顶栏 60px
      height: 'calc(100vh - 60px)',
      background: '#fff',
      maxWidth: isMobile ? 880 : '100%',
      margin: '0 auto', width: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      {sidebar}
      {mainArea}

      {/* Mobile 端历史抽屉 */}
      <HistoryPanel
        open={historyOpen}
        currentId={currentConvId}
        onClose={() => setHistoryOpen(false)}
        onSelect={loadConv}
        onRename={renameConv}
        onDelete={deleteConv}
        onNew={startNewChat}
      />
    </div>
  )
}