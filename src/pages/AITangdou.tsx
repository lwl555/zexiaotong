import { useState, useRef, useEffect } from 'react'
import { agnesChatStream, agnesImageGen, agnesVideoSubmit, agnesVideoPoll, ChatMsg, LinkInfo } from '../lib/agnes'
import { useIsMobile } from '../lib/useIsMobile'
import { useStore } from '../store/store'
import {
  MessageSquare, Search, PenLine, Table2, Globe, Image as ImageIcon,
  Clapperboard, Plus, User, Sparkles, Wand, Code2, Calculator,
  Lightbulb, Languages, Home, Bot, SquarePen, Square, X, Trash2,
  Link2, Menu, ChevronDown, ChevronLeft
} from 'lucide-react'
import {
  Conversation, StoredMsg, getConversations, upsertConversation, deleteConversation, newId
} from '../lib/history'
import { useNavigate } from 'react-router-dom'

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
  { icon: SquarePen, label: '帮我写作' },
  { icon: Languages, label: '翻译' },
  { icon: Code2, label: '写代码' },
  { icon: Calculator, label: '算题' },
  { icon: Lightbulb, label: '头脑风暴' },
  { icon: Table2, label: '做表格' }
  // 注意："联网搜索"已从此处移除 —— 它现在是独立的搜索模式开关（自动/手动/关闭），不再是快捷模式
]

// 模式 = 注入系统提示词的「行为增量」（参考 Omnifact Response Modes / Gemini Gems / 豆包快捷指令）
// 选中后在整个对话中持续生效，而非只发一句废话。
const MODE_SYSTEM: Record<string, string> = {
  '帮我写作': '【当前模式：写作】用户希望得到结构清晰、有观点的文章或文案。必要时用一两个问题快速澄清主题与风格，然后直接动笔；成稿用标题、分段、列表组织。',
  '翻译': '【当前模式：翻译】把用户的内容翻译成目标语言，保持原意与语气；未指定目标语言时默认译为英文。优先只输出译文，必要时附极简说明。',
  '写代码': '【当前模式：编程】帮用户写或改代码。先一句话说明思路，再给可运行代码并附关键注释；优先使用用户所用的语言与框架。',
  '算题': '【当前模式：计算】逐步推导用户的计算/数学题，给出过程与最终答案；不确定处先说明假设。',
  '头脑风暴': '【当前模式：头脑风暴】围绕用户的话题给出多条有创意、可落地的想法或方案，分点列出，可附简短优劣说明。',
  '做表格': '【当前模式：表格】帮用户整理结构化 Markdown 表格，列清字段与示例数据；复杂信息优先表格化。',
  '联网搜索': '【当前模式：联网检索】优先联网获取最新资料再回答，并在末尾附【资料·来源：xxx】链接；自身整理部分标注"根据公开信息整理"。'
}

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
  // 检测图片 URL（http(s)://.../*.jpg|png|webp|gif）并渲染为内联图片
  const imgExt = /\.(jpe?g|png|webp|gif)(\?|$)/i
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/)
    if (m) return <strong key={i} style={{ color: '#c2410c', fontWeight: 600 }}>{m[1]}</strong>
    if (!p) return null
    // 检测 URL 是否为图片链接
    const urlMatch = p.match(/(https?:\/\/[^\s]+\.(?:jpe?g|png|webp|gif)(?:\?[^\s]*)?)/i)
    if (urlMatch) {
      const before = p.slice(0, urlMatch.index)
      const after = p.slice((urlMatch.index || 0) + urlMatch[0].length)
      return <span key={i}>{before}<img src={urlMatch[1]} alt="" style={{ maxWidth: 200, maxHeight: 160, borderRadius: 8, display: 'block', margin: '6px 0' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />{after}</span>
    }
    return <span key={i}>{p}</span>
  })
}

function phaseOf(ms: number): string {
  if (ms < 3000) return '正在联网搜索…'
  if (ms < 12000) return '正在思考…'
  if (ms < 30000) return '正在整理回答…'
  return '生成中，请稍候…'
}

interface Msg {
  role: 'user' | 'ai'
  content: string
  reasoning?: string | null
  links?: LinkInfo[] | null
  image?: string | null
  videoUrl?: string | null
  error?: boolean  // 错误气泡：true 时渲染为红色错误样式
}

const PAGE_KEY = 'ai-tangdou'
const CHANNEL = 'tangdou'

function msgToStored(m: Msg): StoredMsg {
  return {
    role: m.role,
    content: m.content,
    image: m.image ? { url: m.image, title: '用户图片' } : null,
    videoUrl: m.videoUrl ?? null,
    reasoning: m.reasoning ?? null,
    links: m.links ?? null,
    error: m.error ?? null
  }
}
function storedToMsg(s: StoredMsg): Msg {
  return {
    role: s.role,
    content: s.content,
    reasoning: s.reasoning ?? null,
    links: s.links ?? null,
    image: s.image?.url || null,
    videoUrl: s.videoUrl ?? null,
    error: s.error ?? undefined
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
  // 退出动画状态：open→false 时先设 closing=true，等动画结束后再卸载
  const [closing, setClosing] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      setConvs(getConversations().filter(c => c.pageKey === PAGE_KEY))
    } else if (mounted) {
      setClosing(true)
      const timer = setTimeout(() => {
        setClosing(false)
        setMounted(false)
      }, 280)
      return () => clearTimeout(timer)
    }
  }, [open])

  function refresh() { setConvs(getConversations().filter(c => c.pageKey === PAGE_KEY)) }
  function commitRename(id: string) {
    const t = editingTitle.trim()
    if (t) onRename(id, t)
    setEditingId(null)
    setEditingTitle('')
    refresh()
  }

  if (!mounted && !closing) return null

  // 动画变量：面板 translateX、背景 opacity
  const panelX = open && !closing ? '0' : '-100%'
  const backdropAlpha = open && !closing ? 0.4 : 0

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: `rgba(0,0,0,${backdropAlpha})`, zIndex: 100,
        transition: 'background .28s cubic-bezier(.4,0,.2,1)',
        pointerEvents: open ? 'auto' : 'none'
      }} />
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 'min(320px, 86vw)',
        background: '#fff', zIndex: 101, display: 'flex', flexDirection: 'column',
        boxShadow: '2px 0 12px rgba(0,0,0,.08)',
        transform: `translateX(${panelX})`,
        transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
        willChange: 'transform'
      }}>
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1c1814' }}>历史对话</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { onNew(); onClose() }} style={{
              border: 'none', background: '#c2410c', color: '#fff',
              borderRadius: 8, padding: '5px 12px', fontSize: 13, cursor: 'pointer',
              transition: 'transform .1s cubic-bezier(.4,0,.2,1)'
            }} onMouseDown={e => e.currentTarget.style.transform = 'scale(.94)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>＋ 新对话</button>
            <button onClick={onClose} style={{
              border: 'none', background: '#f5f5f5', color: '#666',
              borderRadius: 8, width: 28, height: 28, fontSize: 14, cursor: 'pointer',
              transition: 'transform .1s cubic-bezier(.4,0,.2,1), background .15s'
            }} onMouseDown={e => e.currentTarget.style.transform = 'scale(.9)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}><X size={14} strokeWidth={2} /></button>
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
                borderBottom: '1px solid #f8f8f8',
                transition: 'background .15s cubic-bezier(.4,0,.2,1)'
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
                      borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                      transition: 'transform .1s cubic-bezier(.4,0,.2,1)'
                    }} onMouseDown={e => e.currentTarget.style.transform = 'scale(.94)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>保存</button>
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
                        fontSize: 12, padding: 0, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 3
                      }}><SquarePen size={12} strokeWidth={1.9} /> 重命名</button>
                      <button onClick={e => {
                        e.stopPropagation()
                        if (confirm(`删除对话「${c.title || '未命名'}」？`)) {
                          onDelete(c.id); refresh()
                        }
                      }} style={{
                        border: 'none', background: 'transparent', color: '#c2410c',
                        fontSize: 12, padding: 0, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 3
                      }}><Trash2 size={12} strokeWidth={1.9} /> 删除</button>
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
  // PC 侧边栏历史对话的 inline 编辑态（修 PC 改对话名 bug）
  const [sidebarEditingId, setSidebarEditingId] = useState<string | null>(null)
  const [sidebarEditingTitle, setSidebarEditingTitle] = useState('')
  // Mobile 顶部状态栏 中间标题的 inline 编辑态
  const [mobileTitleEditing, setMobileTitleEditing] = useState(false)
  const [mobileTitleDraft, setMobileTitleDraft] = useState('')
  const [mode, setMode] = useState<'chat' | 'work'>('chat')  // 对话 / 工作模式（PC端 tab）
  const [sidebarConvs, setSidebarConvs] = useState<Conversation[]>([])
  const [activeMode, setActiveMode] = useState<string | null>(null)  // 快捷模式：选中后持续注入系统提示词
  const [searchMode, setSearchMode] = useState<'auto' | 'manual' | 'off'>('auto')  // 联网搜索：自动判断 / 手动强制 / 关闭
  const [deepThink, setDeepThink] = useState(false)  // 深度思考常驻开关（千问式，输入框附近一行）
  const [reasoningExpanded, setReasoningExpanded] = useState<Record<number, boolean>>({})  // 每条AI消息的思考过程展开状态
  const [liveReasoning, setLiveReasoning] = useState('')  // 流式：AI 思考过程中的实时增量，loading 气泡里实时展示
  // 图片/视频生成对话框：'idle' | 'image' | 'video' | 'generating'
  const [genDialog, setGenDialog] = useState<'idle' | 'image' | 'video' | 'generating'>('idle')
  const [genPrompt, setGenPrompt] = useState('')
  const [genError, setGenError] = useState('')
  const [genMode, setGenMode] = useState<'text' | 'image'>('text')  // 文生图 / 图生图
  const [genVideoMode, setGenVideoMode] = useState<'text' | 'image'>('text')  // 文生视频 / 图生视频
  const [genImage, setGenImage] = useState<string | null>(null)  // 图生图/图生视频的输入图片
  const [genDuration, setGenDuration] = useState(121)  // 视频帧数：81=3s, 121=5s, 241=10s, 441=18s
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const genFileRef = useRef<HTMLInputElement>(null)
  const startRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMobile = useIsMobile()
  const nav = useNavigate()

  // 启动时只刷新侧栏（历史可点开），不再自动 loadConv(convs[0])。
  // 原因：用户每次退出再进，都想从清爽的欢迎页开始；若自动恢复历史，
  // 旧的「抱歉，没有联网检索功能」之类的失败回复会被强塞出来，体验很差。
  // 想继续上次对话的话，可以在欢迎页顶部的「继续上次对话」一键恢复。
  useEffect(() => {
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

  // 不再锁 body 滚动 —— 副作用：顶部内容会被吞掉
  // 改用 position: fixed 方案（见下方 return），自然无需锁滚动条

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
    setActiveMode(null)
    setError('')
    setLiveReasoning('')
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

  async function run(next: Msg[], modeOverride?: string | null) {
    setLoading(true)
    setLiveReasoning('')
    startRef.current = Date.now()
    setElapsedMs(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startRef.current), 200)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      // 模式系统提示增量：选中模式后持续注入，让整段对话都带模式行为
      const mode = modeOverride ?? activeMode
      const sysContent = mode ? `${PROMPT}\n\n${MODE_SYSTEM[mode] ?? ''}`.trim() : PROMPT
      const chatMessages: ChatMsg[] = [
        { role: 'system', content: sysContent },
        ...next.slice(0, -1).map(m => ({ role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.content }))
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

      // 流式：正文增量边生成边通过 onContent 推到 loading 气泡（"深度思考中"阶段即可看到思考流出）；
      // 上游 agnes-2.0-flash 无独立 reasoning 通道，故让模型先写思考再以【回答】分隔，结束后在此拆分。
      let settled = false
      await agnesChatStream(chatMessages, {
        autoSearch: searchMode === 'auto',
        webSearch: searchMode === 'manual',
        structuredReasoning: deepThink,  // 深度思考开关：开=三段式推理；关=轻量直接回答
        signal: controller.signal,
        onContent: (delta) => {
          // 首个增量到达即自动展开思考区，用户立刻看到「思考流程在流出」
          setLiveReasoning(prev => prev + delta)
        },
        onDone: (res) => {
          settled = true
          const raw = (res.content || '').trim() || '这一轮没拿到回复，请换个说法再试试。'
          // 拆分思考过程与正式回答：模型在【回答】前写思考，之后写正式回答
          let reasoning: string | null = null
          let answer = raw
          const marker = raw.indexOf('【回答】')
          if (marker >= 0) {
            const r = raw.slice(0, marker).trim()
            const a = raw.slice(marker + '【回答】'.length).trim()
            if (r) reasoning = r
            if (a) answer = a
          }
          const aiMsg: Msg = {
            role: 'ai',
            content: answer,
            reasoning,
            links: res.search?.links ?? null
          }
          const allMsgs = [...next, aiMsg]
          setMessages(allMsgs)
          persist(allMsgs)
        }
      })
      if (!settled) throw new Error('未收到完成信号')
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        // 错误信息以 AI 气泡样式显示在聊天框中，与正常 AI 回复风格一致
        const aiMsg: Msg = {
          role: 'ai',
          content: `❌ 请求出错：${e?.message || '请检查网络后重试'}\n\n💡 可以尝试：\n- 点击下方「重新生成」按钮\n- 换个问题再试试\n- 检查网络连接`,
          error: true
        }
        setMessages(prev => [...prev, aiMsg])
      }
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setLoading(false)
      setLiveReasoning('')
      abortRef.current = null
    }
  }

  async function send(override?: string, opts?: { mode?: string | null }) {
    const text = (override ?? input).trim()
    if (!text && !pendingImage) return
    setError('')

    // 没在对话中：自动开新对话
    let convId = currentConvId
    if (!convId) {
      convId = `${PAGE_KEY}:${newId()}`
      setCurrentConvId(convId)
    }

    if (opts?.mode !== undefined) setActiveMode(opts.mode)

    const next = [...messages, { role: 'user' as const, content: text, image: pendingImage }]
    setMessages(next)
    setInput('')
    setPendingImage(null)
    setShowTags(false)
    await run(next, opts?.mode)
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

  async function handleGenFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImage(file, 1024, 0.7)
      setGenImage(compressed)
    } catch { /* ignore */ }
    e.target.value = ''
  }

  function useTag(tag: { icon?: any; label: string }) {
    const label = tag.label
    setShowTags(false)
    const text = input.trim()
    if (text) {
      // 用户已输入内容：直接按该模式发送，绝不丢弃原文字
      send(text, { mode: label })
      return
    }
    // 空输入：进入该模式（持续生效、可见、可退出），不浪费一轮对话
    setActiveMode(label)
    setInput('')
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

  // 图片/视频生成处理
  async function handleGen() {
    const prompt = genPrompt.trim()
    if (!prompt) return
    setGenDialog('generating')
    setGenError('')
    try {
      if (genDialog === 'image') {
        // 图片：同步等待结果
        const res = await agnesImageGen({
          prompt,
          image: genMode === 'image' ? genImage || undefined : undefined,
          strength: genMode === 'image' ? 0.7 : undefined
        })
        if (res.ok && res.url) {
          setGenDialog('idle')
          setGenPrompt('')
          setGenImage(null)
          // 在聊天区显示生成的图片
          const aiMsg: Msg = {
            role: 'ai',
            content: `🖼️ AI 生图：${prompt}`,
            image: res.url
          }
          const allMsgs = [...messages, aiMsg]
          setMessages(allMsgs)
        } else {
          setGenDialog('image')
          setGenError(res.error || '生成失败，请重试')
        }
      } else if (genDialog === 'video') {
        // 视频：异步提交
        const res = await agnesVideoSubmit({
          prompt,
          num_frames: genDuration,
          image: genVideoMode === 'image' ? genImage || undefined : undefined
        })
        if (res.ok && res.video_id) {
          // 轮询等待完成
          const videoId = res.video_id
          let pollCount = 0
          const maxPolls = 60 // 最多等 3 分钟
          const poll = async (): Promise<void> => {
            pollCount++
            const pollRes = await agnesVideoPoll(videoId)
            if (pollRes.ok && pollRes.status === 'completed' && pollRes.url) {
              setGenDialog('idle')
              setGenPrompt('')
              setGenImage(null)
              const aiMsg: Msg = {
                role: 'ai',
                content: `🎬 AI 生视频：${prompt}`,
                videoUrl: pollRes.url
              }
              const allMsgs = [...messages, aiMsg]
              setMessages(allMsgs)
            } else if (pollRes.status === 'failed') {
              setGenDialog('video')
              setGenError('视频生成失败，请重试')
            } else if (pollCount >= maxPolls) {
              setGenDialog('video')
              setGenError('生成超时，请稍后在历史对话中查看')
            } else {
              await new Promise(r => setTimeout(r, 3000))
              return poll()
            }
          }
          await poll()
        } else {
          setGenDialog('video')
          setGenError(res.error || '提交失败，请重试')
        }
      }
    } catch (e: any) {
      setGenDialog(genDialog === 'generating' ? 'idle' : genDialog)
      setGenError(e?.message || '请求失败')
    }
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
      {/* 顶部：糖豆 logo + 新对话 — 已删除（"糖豆"文字 + 整块状态栏）*/}

      {/* 导航项（几何线性图标 + 文字，黑色 currentColor） */}
      <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          { icon: MessageSquare, label: '新对话', onClick: startNewChat },
          { icon: PenLine, label: '帮我写作', onClick: () => useTag({ icon: SquarePen, label: '帮我写作' }) },
          { icon: Table2, label: '做表格', onClick: () => useTag({ icon: Table2, label: '做表格' }) },
          { icon: Languages, label: '翻译', onClick: () => useTag({ icon: Languages, label: '翻译' }) },
          { icon: ImageIcon, label: '图像生成', onClick: () => setGenDialog('image') },
          { icon: Clapperboard, label: '视频生成', onClick: () => setGenDialog('video') }
        ].map(item => {
          const Icon = item.icon
          return (
            <button key={item.label} onClick={item.onClick} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer', color: '#333',
              fontSize: 14, textAlign: 'left', transition: 'background .15s'
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Icon size={18} strokeWidth={1.9} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* 联网搜索模式切换（PC 端）：自动 / 手动 / 关闭 */}
      <div style={{
        padding: '6px 14px 10px', marginTop: 4,
        borderTop: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', gap: 6
      }}>
        <Search size={15} strokeWidth={1.9} color="#666" />
        <span style={{ fontSize: 12, color: '#666' }}>联网</span>
        <div style={{
          marginLeft: 'auto',
          display: 'inline-flex', borderRadius: 6, overflow: 'hidden',
          border: '1px solid #e5e5e5'
        }}>
          {(['auto', 'manual', 'off'] as const).map(s => (
            <button key={s} onClick={() => setSearchMode(s)} style={{
              padding: '3px 8px', fontSize: 11, border: 'none', cursor: 'pointer',
              background: searchMode === s ? '#1c1814' : '#fff',
              color: searchMode === s ? '#fff' : '#666',
              transition: 'all .15s',
              borderRight: s !== 'off' ? '1px solid #e5e5e5' : 'none'
            }}>
              {s === 'auto' ? '自动' : s === 'manual' ? '手动' : '关闭'}
            </button>
          ))}
        </div>
      </div>

      {/* 历史对话 */}
      <div style={{ padding: '14px 14px 6px', fontSize: 11, color: '#999', fontWeight: 600 }}>历史对话</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {sidebarConvs.length === 0 && (
          <div style={{ padding: '12px 10px', fontSize: 12, color: '#bbb' }}>还没有对话</div>
        )}
        {sidebarConvs.map(c => {
          const active = c.id === currentConvId
          const isEditing = sidebarEditingId === c.id
          return (
            <div key={c.id} style={{
              padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
              background: active ? '#fef3c7' : 'transparent',
              marginBottom: 2
            }}
              onClick={() => { setSidebarEditingId(null); loadConv(c) }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f0f0f0' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
              {isEditing ? (
                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    autoFocus value={sidebarEditingTitle}
                    onChange={e => setSidebarEditingTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const t = sidebarEditingTitle.trim()
                        if (t) renameConv(c.id, t)
                        setSidebarEditingId(null)
                      }
                      if (e.key === 'Escape') setSidebarEditingId(null)
                    }}
                    style={{
                      flex: 1, border: '1px solid #c2410c', borderRadius: 6,
                      padding: '3px 7px', fontSize: 13, outline: 'none',
                      background: '#fff', color: '#1c1814'
                    }} />
                  <button onClick={() => {
                    const t = sidebarEditingTitle.trim()
                    if (t) renameConv(c.id, t)
                    setSidebarEditingId(null)
                  }} style={{
                    border: 'none', background: '#c2410c', color: '#fff',
                    borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer'
                  }}>保存</button>
                </div>
              ) : (
                <>
                  <div style={{
                    fontSize: 13, color: '#1c1814', fontWeight: active ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>{c.title || '未命名对话'}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{c.messages.length} 条</span>
                    <span onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
                      <button onClick={e => {
                        e.stopPropagation()
                        setSidebarEditingId(c.id)
                        setSidebarEditingTitle(c.title)
                      }} style={{
                        border: 'none', background: 'transparent', color: '#666',
                        fontSize: 11, padding: 0, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 2
                      }}><SquarePen size={11} strokeWidth={1.9} /> 重命名</button>
                      <button onClick={e => {
                        e.stopPropagation()
                        if (confirm(`删除对话「${c.title || '未命名'}」？`)) {
                          deleteConv(c.id)
                          setSidebarEditingId(null)
                        }
                      }} style={{
                        border: 'none', background: 'transparent', color: '#c2410c',
                        fontSize: 11, padding: 0, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 2
                      }}><Trash2 size={11} strokeWidth={1.9} /> 删除</button>
                    </span>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      </aside>
  )

  // ─── 主区消息气泡 ─────────────────────────────────────────
  const messageArea = (
    <div style={{
      flex: 1, overflowY: 'auto',
      // 不论有无消息，都保留上下 padding，让内容居中 / 第一个消息有安全距离
      padding: isMobile ? '12px' : '32px 48px'
    }}>
      {!hasMessages && !loading && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100%', padding: isMobile ? '40px 20px' : '40px 20px'
        }}>
          {/* 继续上次对话：仅当存在历史且当前是空白态时显示（一键 loadConv）。 */}
          {sidebarConvs.length > 0 && (() => {
            const last = sidebarConvs[0]
            const preview = last.messages.find(m => m.role === 'user')?.content?.slice(0, 18) || last.title || '上次对话'
            return (
              <button
                onClick={() => loadConv(last)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: isMobile ? '7px 12px' : '8px 14px',
                  marginBottom: isMobile ? 20 : 24,
                  borderRadius: 999,
                  border: '1px solid #e8e8e8',
                  background: '#fff',
                  fontSize: isMobile ? 12.5 : 13,
                  color: '#1c1814',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,.03)',
                  transition: 'all .15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#c2410c'; e.currentTarget.style.background = '#fafafa' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.background = '#fff' }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeaveCapture={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <MessageSquare size={isMobile ? 13 : 14} strokeWidth={1.9} color="#666" />
                <span>继续上次对话：<span style={{ color: '#666' }}>{preview}…</span></span>
                <span style={{ color: '#999', fontSize: isMobile ? 11 : 12 }}>· {new Date(last.updatedAt).toLocaleDateString('zh-CN')}</span>
              </button>
            )
          })()}
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
            /* Mobile端：圆形头像 + 标题 + 2 列示例卡片网格（对齐千问/豆包/元宝空状态） */
            <>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: '#1c1814', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12
              }}><Sparkles size={26} color="#fff" strokeWidth={1.8} /></div>
              <div style={{ fontSize: 19, fontWeight: 600, color: '#1c1814', marginBottom: 5 }}>
                你好，我是糖豆
              </div>
              <div style={{ fontSize: 12.5, color: '#999', marginBottom: 20, textAlign: 'center' }}>
                可以帮你写作、翻译、算题、写代码、识图分析，或者随便聊聊天
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
                width: '100%', maxWidth: 420
              }}>
                {WELCOME_EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => send(ex)} style={{
                    padding: '10px 12px', borderRadius: 12, border: '1px solid #ececec',
                    background: '#fff', cursor: 'pointer', fontSize: 13, color: '#555',
                    textAlign: 'left', lineHeight: 1.4, minHeight: 44,
                    transition: 'all .15s', boxShadow: '0 1px 2px rgba(0,0,0,.03)'
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = '#c2410c' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ececec' }}>
                    {ex}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {messages.map((m, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
          marginBottom: isMobile ? 8 : 14,
          animation: 'fadeInUp .3s cubic-bezier(.4,0,.2,1) backwards',
          animationDelay: `${i * 50}ms`
        }}>
          {m.role === 'ai' && (
            <div style={{
              width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, borderRadius: '50%', background: '#5b7c99',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginRight: 6
            }}><Sparkles size={isMobile ? 13 : 16} color="#fff" strokeWidth={2} /></div>
          )}
          <div style={{
            maxWidth: isMobile ? '82%' : '70%',
            padding: m.image ? 0 : (isMobile ? '8px 11px' : '10px 14px'),
            borderRadius: 14,
            background: m.role === 'user' ? '#07c160' : (m.error ? '#fef2f2' : '#ffffff'),
            border: m.error ? '1px solid #fecaca' : '1px solid rgba(0,0,0,0.06)',
            color: m.role === 'user' ? '#fff' : (m.error ? '#b42318' : '#1c1814'),
            fontSize: isMobile ? 13.5 : 14,
            lineHeight: isMobile ? 1.55 : 1.7,
            borderTopRightRadius: m.role === 'user' ? 4 : 14,
            borderTopLeftRadius: m.role === 'user' ? 14 : 4,
            wordBreak: 'break-word', overflow: 'hidden'
          }}>
            {m.image && (
              <div style={{ padding: '8px 8px 0' }}>
                <img src={m.image} alt="AI 生成的图片" style={{ maxWidth: 180, maxHeight: 160, borderRadius: 8, display: 'block' }} />
              </div>
            )}
            {m.videoUrl && (
              <div style={{ padding: '8px 8px 0' }}>
                <video
                  src={m.videoUrl}
                  controls
                  style={{ maxWidth: 240, maxHeight: 200, borderRadius: 8, display: 'block' }}
                />
              </div>
            )}
            {m.image && m.content && <div style={{ padding: '6px 12px' }}>{m.content}</div>}
            {m.videoUrl && m.content && <div style={{ padding: '6px 12px' }}>{m.content}</div>}
            {!m.image && !m.videoUrl && m.role === 'ai' && renderMarkdown(m.content)}
            {!m.image && !m.videoUrl && m.role === 'user' && <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>}
            {/* 深度思考过程：最后一条 AI 消息默认展开（刚才已实时看过），其余可手动展开 */}
            {m.role === 'ai' && m.reasoning && (() => {
              const expanded = reasoningExpanded[i] ?? (i === messages.length - 1)
              return (
                <div style={{ marginTop: 8, borderTop: '1px solid #e5e5e5', paddingTop: 6 }}>
                  <button
                    onClick={() => setReasoningExpanded(prev => ({ ...prev, [i]: !expanded }))}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888'
                    }}>
                    <ChevronDown size={12} strokeWidth={2} style={{
                      transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform .15s'
                    }} />
                    <span>深度思考</span>
                  </button>
                  {expanded && (
                    <div style={{
                      marginTop: isMobile ? 4 : 6,
                      padding: isMobile ? '6px 8px' : 10,
                      borderRadius: 8,
                      background: '#fafafa', border: '1px solid #f0f0f0',
                      fontSize: isMobile ? 11.5 : 12,
                      lineHeight: isMobile ? 1.5 : 1.6,
                      color: '#666',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      maxHeight: isMobile ? 180 : 320,
                      overflowY: 'auto',
                      animation: 'slideDown .2s cubic-bezier(.4,0,.2,1)'
                    }}>
                      {m.reasoning}
                    </div>
                  )}
                </div>
              )
            })()}
            {m.links && m.links.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #e5e5e5', fontSize: 12 }}>
                <div style={{ color: '#888', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}><Link2 size={12} strokeWidth={1.9} /> 参考资料：</div>
                {m.links.slice(0, 4).map((lk, j) => (
                  <a key={j} href={lk.url} target="_blank" rel="noopener noreferrer"
                     style={{ display: 'block', color: '#1d4ed8', marginBottom: 2, textDecoration: 'none' }}>
                    {lk.title || lk.url}
                  </a>
                ))}
              </div>
            )}
            {/* AI 回复操作栏：重新生成 + 复制 */}
            {m.role === 'ai' && !m.error && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { navigator.clipboard?.writeText(m.content) }}
                  style={{ fontSize: 11, color: '#888', background: 'none', border: '1px solid #e5e5e5', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                >📋 复制</button>
                <button
                  onClick={() => { stop(); run(messages.slice(0, -1)) }}
                  style={{ fontSize: 11, color: '#888', background: 'none', border: '1px solid #e5e5e5', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                >🔄 重新生成</button>
              </div>
            )}
            {m.role === 'ai' && m.error && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { stop(); run(messages.slice(0, -1)) }}
                  style={{ fontSize: 11, color: '#888', background: 'none', border: '1px solid #e5e5e5', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                >🔄 重新生成</button>
              </div>
            )}
          </div>
          {m.role === 'user' && !m.image && (
            <div style={{
              width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, borderRadius: '50%', background: '#e8e0d8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isMobile ? 11 : 13, flexShrink: 0, marginLeft: 6
            }}>我</div>
          )}
        </div>
      ))}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: isMobile ? 8 : 14 }}>
          <div style={{
            width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, borderRadius: '50%', background: '#1c1814',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginRight: 6
          }}><Sparkles size={isMobile ? 13 : 16} color="#fff" strokeWidth={2} /></div>
          <div style={{
            maxWidth: isMobile ? '82%' : '80%',
            padding: isMobile ? '8px 11px' : '10px 14px',
            borderRadius: 14, background: '#f5f5f5',
            borderTopLeftRadius: 4,
            fontSize: isMobile ? 12.5 : 13,
            lineHeight: 1.55, color: '#666'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: liveReasoning ? 4 : 0 }}>
              <span style={{ marginRight: 2 }}>{deepThink ? '● 深度思考中…' : '● 思考中…'}</span>
              <span style={{ color: '#aaa', fontSize: 11 }}>{(elapsedMs / 1000).toFixed(1)}s</span>
            </div>
            {liveReasoning ? (() => {
              const switched = liveReasoning.includes('【回答】')
              const thinkPart = switched ? liveReasoning.slice(0, liveReasoning.indexOf('【回答】')) : liveReasoning
              const answerPart = switched ? liveReasoning.slice(liveReasoning.indexOf('【回答】') + '【回答】'.length).trim() : ''
              return (
                <div style={{
                  maxHeight: isMobile ? 160 : 320, overflowY: 'auto',
                  padding: isMobile ? '5px 8px' : '8px 10px', borderRadius: 8, background: '#fafafa', border: '1px solid #f0f0f0',
                  fontSize: isMobile ? 11.5 : 12, lineHeight: isMobile ? 1.5 : 1.6, color: '#666',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {thinkPart}
                  {switched && (
                    <div style={{ borderTop: '1px dashed #e0d8cf', margin: '5px 0 3px', color: '#c2410c', fontSize: 11 }}>
                      —— 正式回答 ——
                    </div>
                  )}
                  {answerPart}
                  <span style={{ color: '#c2410c' }}>▍</span>
                </div>
              )
            })() : (
              <span style={{ color: '#bbb' }}>正在梳理思路…</span>
            )}
          </div>
        </div>
      )}

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

      {/* 当前快捷模式条（选中模式后可见，可一键退出） */}
      {activeMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: isMobile ? '6px 12px' : '6px 24px',
          background: '#fafafa', borderTop: '1px solid #f5f5f5'
        }}>
          <span style={{
            fontSize: 12, color: '#92400e', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 4
          }}><Wand size={13} strokeWidth={2} /> {activeMode}模式</span>
          <button onClick={() => setActiveMode(null)} style={{
            marginLeft: 'auto', border: 'none', background: 'transparent',
            color: '#999', fontSize: 12, cursor: 'pointer', padding: 0,
            display: 'inline-flex', alignItems: 'center', gap: 2
          }}><X size={12} strokeWidth={2} /> 退出</button>
        </div>
      )}

      {/* Mobile 端：「+」功能弹层（默认折叠）。包含：联网三态切换 + 6 个快捷功能 + 关于说明。
          一次性收起所有次要控件，底部常驻只剩一行输入条。 */}
      {showTags && isMobile && (
        <div style={{
          background: '#fafafa', borderTop: '1px solid #f5f5f5',
          padding: '10px 12px 8px',
          animation: 'tagsSlideUp .2s cubic-bezier(.4,0,.2,1)'
        }}>
          <style>{`
            @keyframes tagsSlideUp {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes popIn {
              from { opacity: 0; transform: scale(.92); }
              to { opacity: 1; transform: scale(1); }
            }
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideDown {
              from { opacity: 0; max-height: 0; }
              to { opacity: 1; max-height: 300px; }
            }
          `}</style>
          {/* 联网搜索模式切换 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10
          }}>
            <Search size={13} strokeWidth={1.9} color="#666" />
            <span style={{ fontSize: 12, color: '#666' }}>联网搜索</span>
            <div style={{
              marginLeft: 'auto',
              display: 'inline-flex', borderRadius: 6, overflow: 'hidden',
              border: '1px solid #e5e5e5'
            }}>
              {(['auto', 'manual', 'off'] as const).map(s => (
                <button key={s} onClick={() => setSearchMode(s)} style={{
                  padding: '4px 10px', fontSize: 11, border: 'none', cursor: 'pointer',
                  background: searchMode === s ? '#1c1814' : '#fff',
                  color: searchMode === s ? '#fff' : '#666',
                  transition: 'all .15s',
                  borderRight: s !== 'off' ? '1px solid #e5e5e5' : 'none'
                }}>
                  {s === 'auto' ? '自动' : s === 'manual' ? '手动' : '关闭'}
                </button>
              ))}
            </div>
          </div>
          {/* 6 个快捷功能（2 行 × 3 列，节省横向滚动） */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6
          }}>
            {QUICK_TAGS.map(t => (
              <button key={t.label} onClick={() => useTag(t)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                padding: '8px 4px', borderRadius: 8, border: '1px solid #e5e5e5',
                background: '#fff', cursor: 'pointer', color: '#555',
                transition: 'all .15s'
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#c2410c'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e5e5'}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}><t.icon size={16} strokeWidth={1.9} /></span>
                <span style={{ fontSize: 11, color: '#666' }}>{t.label}</span>
              </button>
            ))}
          </div>
          {/* 媒体入口：图像生成 / 视频生成（点击打开生成对话框，而非文件上传） */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 6
          }}>
            <button onClick={() => { setShowTags(false); setGenDialog('image') }} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              padding: '8px 4px', borderRadius: 8, border: '1px solid #e5e5e5',
              background: '#fff', cursor: 'pointer', color: '#555', transition: 'all .15s'
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#c2410c'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e5e5'}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><ImageIcon size={16} strokeWidth={1.9} /></span>
              <span style={{ fontSize: 11, color: '#666' }}>图像生成</span>
            </button>
            <button onClick={() => { setShowTags(false); setGenDialog('video') }} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              padding: '8px 4px', borderRadius: 8, border: '1px solid #e5e5e5',
              background: '#fff', cursor: 'pointer', color: '#555', transition: 'all .15s'
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#c2410c'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e5e5'}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><Clapperboard size={16} strokeWidth={1.9} /></span>
              <span style={{ fontSize: 11, color: '#666' }}>视频生成</span>
            </button>
          </div>
          {/* 关于说明（从底部输入区搬来） */}
          <div style={{ textAlign: 'center', fontSize: 10, color: '#bbb', marginTop: 8, lineHeight: 1.4 }}>
            糖豆 由择校通平台提供 · 内容仅供参考
          </div>
        </div>
      )}

      {/* Mobile 端：常驻快捷开关行（千问式）——深度思考常驻可见，联网三态收进 + 弹层 */}
      {isMobile && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          // mobile：透明（贴浅灰底，不再形成白排）；PC 维持白底
          padding: '6px 12px',
          background: isMobile ? 'transparent' : '#fff',
          borderTop: isMobile ? 'none' : '1px solid #f5f5f5'
        }}>
          <button onClick={() => setDeepThink(v => !v)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 14, border: '1px solid',
            borderColor: deepThink ? '#c2410c' : '#e5e5e5',
            background: deepThink ? '#fff7ed' : '#fff',
            color: deepThink ? '#c2410c' : '#666',
            fontSize: 12, cursor: 'pointer', transition: 'all .15s'
          }}>
            <span style={{
              width: 13, height: 13, borderRadius: '50%',
              background: deepThink ? '#c2410c' : '#e5e5e5',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 9, fontWeight: 700
            }}>{deepThink ? '✓' : ''}</span>
            深度思考
          </button>
          <span style={{ fontSize: 11, color: '#bbb' }}>
            {deepThink ? '已开启' : '轻量回答'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>
            点 ＋ 设置联网
          </span>
        </div>
      )}

      {/* 细长输入条（手机端进一步收紧：按钮 30×30，胶囊 32 高） */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        // mobile：浅灰底无缝融入页面（无 borderTop 白线）；PC 维持白底细线
        padding: isMobile ? '6px 10px' : '10px 20px',
        background: isMobile ? '#f0f0f1' : '#fff',
        borderTop: isMobile ? 'none' : '1px solid #f0f0f0'
      }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} title="图片" style={{
          width: isMobile ? 30 : 36, height: isMobile ? 30 : 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: pendingImage ? '#c2410c' : '#f5f5f5',
          color: pendingImage ? '#fff' : '#666',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 16, transition: 'all .15s'
        }}><ImageIcon size={17} strokeWidth={1.9} /></button>

        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: '#f5f5f5', borderRadius: isMobile ? 16 : 22,
          padding: '0 12px', height: isMobile ? 32 : 40,
          minHeight: isMobile ? 32 : 40, maxHeight: isMobile ? 32 : 40,
          overflow: 'hidden', boxSizing: 'border-box'
        }}>
          <textarea
            ref={inputRef}
            value={input}
            placeholder={activeMode ? `${activeMode}模式：输入内容后发送` : (isMobile ? '发消息或按住说话…' : '发消息或按住空格说话…')}
            onChange={(e) => { setInput(e.target.value); autoResize(e.target) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !loading) { e.preventDefault(); send() } }}
            rows={1}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, lineHeight: 1.4, resize: 'none',
              fontFamily: 'inherit', padding: 0,
              height: isMobile ? 32 : 40,
              boxSizing: 'border-box',
              minHeight: isMobile ? 32 : 40, maxHeight: 120,
              overflow: 'auto'
            }}
          />
        </div>

        {/* Mobile 端保留 + 按钮（功能弹层） */}
        {isMobile && (
          <button onClick={() => setShowTags(v => !v)} title="功能" style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: showTags ? '#c2410c' : '#f5f5f5',
            color: showTags ? '#fff' : '#666',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 14, transition: 'all .15s',
            transform: showTags ? 'scale(.92)' : 'scale(1)'
          }} onMouseDown={e => e.currentTarget.style.transform = 'scale(.85)'} onMouseUp={e => e.currentTarget.style.transform = showTags ? 'scale(.92)' : 'scale(1)'} onMouseLeave={e => e.currentTarget.style.transform = showTags ? 'scale(.92)' : 'scale(1)'}>＋</button>
        )}

        {loading ? (
          <button onClick={stop} title="停止" style={{
            width: isMobile ? 30 : 36, height: isMobile ? 30 : 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#f5f5f5', color: '#666', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform .1s cubic-bezier(.4,0,.2,1)',
            transform: 'scale(1)'
          }} onMouseDown={e => e.currentTarget.style.transform = 'scale(.85)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}><Square size={12} strokeWidth={2.4} fill="#666" /></button>
        ) : (
          // 发送按钮：永远显示，避免用户在空状态下找不到「↑」而误以为功能缺失
          // 空状态置灰禁用，有内容/有图时高亮可点（与主流 AI 聊天 app 一致）
          <button
            onClick={() => (input.trim() || pendingImage) && send()}
            disabled={!(input.trim() || pendingImage)}
            title="发送"
            style={{
              width: isMobile ? 30 : 36, height: isMobile ? 30 : 36, borderRadius: '50%',
              border: 'none',
              cursor: (input.trim() || pendingImage) ? 'pointer' : 'not-allowed',
              background: (input.trim() || pendingImage) ? '#c2410c' : '#f5f5f5',
              color: (input.trim() || pendingImage) ? '#fff' : '#bbb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 14,
              transition: 'all .15s cubic-bezier(.4,0,.2,1)',
              transform: 'scale(1)'
            }} onMouseDown={e => { if (input.trim() || pendingImage) e.currentTarget.style.transform = 'scale(.88)' }} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>↑</button>
        )}
      </div>

      {/* PC 端：输入条下方常驻一排小功能标签（豆包风） */}
      {!isMobile && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '8px 24px 4px',
          fontSize: 12, color: '#888'
        }}>
          {QUICK_TAGS.slice(0, 6).map(t => {
            const Icon = t.icon
            return (
              <button key={t.label} onClick={() => useTag(t)} style={{
                border: 'none', background: 'transparent', color: '#666',
                fontSize: 12, cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: 4
              }}
                onMouseEnter={e => e.currentTarget.style.color = '#c2410c'}
                onMouseLeave={e => e.currentTarget.style.color = '#666'}>
                <Icon size={13} strokeWidth={1.9} /><span>{t.label}</span>
              </button>
            )
          })}
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 10, color: 'transparent', paddingBottom: 2, userSelect: 'none' }}>
        ·
      </div>
    </div>
  )

  // ─── 主区（顶部 + 中间 + 底部）────────────────────────────
  const mainArea = (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      minWidth: 0, height: '100%',
      // mobile：整页浅灰底（对齐豆包/元宝空状态），彻底去掉"顶部一排白"；PC 维持白底
      background: isMobile ? '#f6f6f7' : '#fff',
      position: 'relative'  // 给 mobile 浮顶按钮条做定位锚
    }}>
      {/* mobile：微信风顶栏 — 左 ‹ 返回首页 / 中 当前对话名（可点编辑）/ 右 ☰ 历史 */}
      {isMobile && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 44,
          display: 'flex', alignItems: 'center',
          background: '#fff', borderBottom: '1px solid #f0f0f0',
          zIndex: 8, paddingLeft: 4, paddingRight: 4
        }}>
          <button onClick={() => nav('/')} title="返回首页" style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            width: 44, height: 44, color: '#1c1814',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform .1s cubic-bezier(.4,0,.2,1)',
            transform: 'scale(1)'
          }} onMouseDown={e => e.currentTarget.style.transform = 'scale(.9)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}><ChevronLeft size={22} strokeWidth={2} /></button>
          <div style={{
            flex: 1, minWidth: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {mobileTitleEditing ? (
              <input
                autoFocus value={mobileTitleDraft}
                onChange={e => setMobileTitleDraft(e.target.value)}
                onBlur={() => {
                  const t = mobileTitleDraft.trim()
                  if (t && currentConvId) renameConv(currentConvId, t)
                  setMobileTitleEditing(false)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const t = mobileTitleDraft.trim()
                    if (t && currentConvId) renameConv(currentConvId, t)
                    setMobileTitleEditing(false)
                  }
                  if (e.key === 'Escape') setMobileTitleEditing(false)
                }}
                placeholder="糖豆"
                style={{
                  width: '100%', maxWidth: 220, border: '1px solid #c2410c',
                  borderRadius: 6, padding: '4px 10px', fontSize: 14,
                  outline: 'none', textAlign: 'center',
                  background: '#fff', color: '#1c1814'
                }} />
            ) : (
              <div
                onClick={() => {
                  if (!currentConvId) return  // 没创建对话不能改
                  setMobileTitleDraft(currentTitle)
                  setMobileTitleEditing(true)
                }}
                title={currentConvId ? '点击修改对话名' : '糖豆'}
                style={{
                  maxWidth: 240, fontSize: 14, fontWeight: 600, color: '#1c1814',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  cursor: currentConvId ? 'pointer' : 'default',
                  padding: '4px 12px', borderRadius: 6,
                  border: '1px solid transparent',
                  transition: 'border-color .15s, background .15s'
                }}
                onMouseEnter={e => { if (currentConvId) { e.currentTarget.style.background = '#f8f8f8'; e.currentTarget.style.borderColor = '#e8e8e8' } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}>
                {currentTitle || '糖豆'}
              </div>
            )}
          </div>
          {/* 右侧：☰ 历史对话（移到右侧，符合微信「左返回、右功能」约定） */}
          <button onClick={() => setHistoryOpen(true)} title="历史对话" style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            width: 44, height: 44, color: '#1c1814',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform .1s cubic-bezier(.4,0,.2,1)',
            transform: 'scale(1)'
          }} onMouseDown={e => e.currentTarget.style.transform = 'scale(.9)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}><Menu size={22} strokeWidth={2} /></button>
        </div>
      )}

      <div style={{
        display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
        // mobile paddingTop 44：留出位置给顶部状态栏；PC 不留
        paddingTop: isMobile ? 44 : 0
      }}>
        {messageArea}
        {bottomBar}
      </div>
    </div>
  )

  // 用 position: fixed 把糖豆容器从正常文档流抽离（仅桌面端）：
  // 这样 .container 的 padding-bottom:80px + footer 不会撑大整页
  // 桌面端 top:60 给顶部导航栏留偏移。
  // 手机端走 normal flow 让 MobileLayout 底栏正常露出（fixed z-100 会挡住 z-30 的底栏）。
  return (
    <div style={{
      position: 'fixed',
      top: isMobile ? 0 : 60,
      left: 0,
      right: 0,
      // mobile 40：让输入条底端紧贴底部导航栏（40 = 48 导航高 - 8 上拱），更"碍拢"
      bottom: isMobile ? 40 : 0,
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      background: isMobile ? '#f6f6f7' : '#fff',
      zIndex: isMobile ? 50 : 100,
      overflow: 'hidden'
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

      {/* 图片/视频生成对话框 */}
      {genDialog !== 'idle' && (
        <div onClick={() => { setGenDialog('idle'); setGenError(''); setGenImage(null); setGenMode('text'); setGenVideoMode('text'); setGenDuration(121) }} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, padding: '20px 24px', width: '100%', maxWidth: 420,
            boxShadow: '0 8px 32px rgba(0,0,0,.18)', animation: 'popIn .2s cubic-bezier(.4,0,.2,1)'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14
            }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1c1814' }}>
                {genDialog === 'image' ? '🖼️ AI 生图' : genDialog === 'video' ? '🎬 AI 生视频' : genDialog === 'generating' ? '⏳ 生成中…' : ''}
              </div>
              <button onClick={() => { setGenDialog('idle'); setGenError(''); setGenImage(null); setGenMode('text'); setGenVideoMode('text'); setGenDuration(121) }} style={{
                border: 'none', background: 'transparent', cursor: 'pointer', color: '#999', fontSize: 18
              }}>×</button>
            </div>

            {genDialog !== 'generating' ? (
              <>
                {/* 模式切换：文生图 / 图生图 或 文生视频 / 图生视频 */}
                <div style={{
                  display: 'inline-flex', borderRadius: 8, overflow: 'hidden',
                  border: '1px solid #e5e5e5', marginBottom: 12
                }}>
                  <button
                    onClick={() => genDialog === 'image' ? setGenMode('text') : setGenVideoMode('text')}
                    style={{
                      padding: '6px 16px', fontSize: 13, border: 'none', cursor: 'pointer',
                      background: (genDialog === 'image' ? genMode : genVideoMode) === 'text' ? '#1c1814' : '#fff',
                      color: (genDialog === 'image' ? genMode : genVideoMode) === 'text' ? '#fff' : '#666',
                      transition: 'all .15s'
                    }}>
                    {genDialog === 'image' ? '文生图' : '文生视频'}
                  </button>
                  <button
                    onClick={() => genDialog === 'image' ? setGenMode('image') : setGenVideoMode('image')}
                    style={{
                      padding: '6px 16px', fontSize: 13, border: 'none', cursor: 'pointer',
                      background: (genDialog === 'image' ? genMode : genVideoMode) === 'image' ? '#1c1814' : '#fff',
                      color: (genDialog === 'image' ? genMode : genVideoMode) === 'image' ? '#fff' : '#666',
                      transition: 'all .15s'
                    }}>
                    {genDialog === 'image' ? '图生图' : '图生视频'}
                  </button>
                </div>

                {/* 图生图/图生视频：图片上传区 */}
                {(genDialog === 'image' && genMode === 'image') || (genDialog === 'video' && genVideoMode === 'image') ? (
                  <div style={{ marginBottom: 12 }}>
                    <input ref={genFileRef} type="file" accept="image/*" onChange={handleGenFile} style={{ display: 'none' }} />
                    {genImage ? (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img src={genImage} alt="输入图" style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8, border: '1px solid #e5e5e5' }} />
                        <button onClick={() => setGenImage(null)} style={{
                          position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                          borderRadius: '50%', border: 'none', background: '#999', color: '#fff',
                          fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>×</button>
                      </div>
                    ) : (
                      <button onClick={() => genFileRef.current?.click()} style={{
                        width: '100%', padding: '16px 12px', borderRadius: 10,
                        border: '2px dashed #d4d4d4', background: '#fafafa', cursor: 'pointer',
                        color: '#888', fontSize: 13, transition: 'all .15s'
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#c2410c'; e.currentTarget.style.background = '#fff7ed' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#d4d4d4'; e.currentTarget.style.background = '#fafafa' }}>
                        📷 上传参考图片
                        <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>作为生成基础（支持 JPG/PNG）</div>
                      </button>
                    )}
                  </div>
                ) : null}

                {/* 视频时长选择 */}
                {genDialog === 'video' && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>视频时长</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[
                        { frames: 81, label: '3秒' },
                        { frames: 121, label: '5秒' },
                        { frames: 241, label: '10秒' },
                        { frames: 441, label: '18秒' }
                      ].map(opt => (
                        <button key={opt.frames} onClick={() => setGenDuration(opt.frames)} style={{
                          flex: 1, padding: '6px 4px', borderRadius: 8, border: '1px solid',
                          borderColor: genDuration === opt.frames ? '#c2410c' : '#e5e5e5',
                          background: genDuration === opt.frames ? '#fff7ed' : '#fff',
                          color: genDuration === opt.frames ? '#c2410c' : '#666',
                          fontSize: 12, cursor: 'pointer', transition: 'all .15s'
                        }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  autoFocus
                  value={genPrompt}
                  onChange={e => setGenPrompt(e.target.value)}
                  placeholder={genDialog === 'image'
                    ? (genMode === 'image' ? '描述你想要的修改，例如：把背景换成星空，保留人物' : '描述你想生成的图片内容，例如：一只在月光下奔跑的白狐，电影级光影')
                    : (genVideoMode === 'image' ? '描述你想要的视频效果，例如：镜头缓慢推进，花瓣飘落' : '描述你想生成的视频内容，例如：海边日落，浪花轻拍沙滩，电影感')}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && genPrompt.trim()) { e.preventDefault(); handleGen() } }}
                  rows={3}
                  style={{
                    width: '100%', border: '1px solid #e5e5e5', borderRadius: 10,
                    padding: '10px 12px', fontSize: 14, outline: 'none', resize: 'none',
                    boxSizing: 'border-box', color: '#333'
                  }} />
                {genError && <div style={{ color: '#b42318', fontSize: 12, marginTop: 6 }}>{genError}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setGenDialog('idle'); setGenError(''); setGenImage(null); setGenMode('text'); setGenVideoMode('text'); setGenDuration(121) }} style={{
                    border: '1px solid #e5e5e5', background: '#fff', borderRadius: 8,
                    padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#666'
                  }}>取消</button>
                  <button onClick={handleGen} disabled={!genPrompt.trim()} style={{
                    border: 'none', background: genPrompt.trim() ? '#c2410c' : '#e5e5e5',
                    color: genPrompt.trim() ? '#fff' : '#999',
                    borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: genPrompt.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all .15s'
                  }}>生成</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', border: '3px solid #e5e5e5',
                  borderTopColor: '#c2410c', margin: '0 auto 14px',
                  animation: 'spin 1s linear infinite'
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                <div style={{ fontSize: 13, color: '#666' }}>
                  {genDialog === 'generating' ? '正在生成，请稍候…' : ''}
                </div>
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>
                  {genDialog === 'generating' ? (genMode === 'image' || genVideoMode === 'image' ? '图生图/视频约 30-60 秒' : '图片约 10-30 秒 · 视频约 2-3 分钟') : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}