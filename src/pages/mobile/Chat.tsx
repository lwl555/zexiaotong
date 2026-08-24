import { useState, useRef, useEffect, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft, MoreVertical, Mic, Plus, Smile, Image as ImageIcon,
  Folder, Calculator, FileText, History, Compass, Bot, Radio,
  AlertTriangle, Coins, Wallet as WalletIcon, Users, BellRing,
  SquarePen, Languages, Code2, Lightbulb, Table2, Globe,
  Sparkles, Loader2, Trash2, X, Eye, Clapperboard
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStore } from '../../store/store'
import { agnesChatStream, agnesImageGen, agnesVideoSubmit, agnesVideoPoll } from '../../lib/agnes'
import { renderMarkdown, previewText } from '../../lib/markdown'
import { Conversation, StoredMsg, getConversation, getConversations, upsertConversation, deleteConversation } from '../../lib/history'

// ===== 基础类型 =====

type MsgSide = 'them' | 'me'
interface ChatMsg { side: MsgSide; text: string; image?: string | null; error?: boolean }
interface ChatDef {
  name: string
  Icon: LucideIcon
  color: string
  status: string
  messages: ChatMsg[]
  jump?: { to: string; label: string }
  /** 是否启用真正的 AI 聊天功能（把 AITangdou 的能力内嵌到聊天里） */
  ai?: boolean
  /** AI 用的系统提示词（仅 ai:true 时有效） */
  systemPrompt?: string
  /** 主题色（仅 AI 聊天头部渐变用） */
  accent?: string
}

// ===== 各会话定义 =====

const CHATS: Record<string, ChatDef> = {
  baishitong: {
    name: '百事通', Icon: Compass, color: '#0f766e', status: '在线',
    messages: [
      { side: 'them', text: '你好,我是百事通,查院校、问政策都可以找我。' },
      { side: 'them', text: '上海交大 2026 招生章程有调整,详见 招生处官网。' },
    ],
    jump: { to: '/ai-search', label: '打开百事通' },
  },
  tangdou: {
    name: '糖豆', Icon: Bot, color: '#9d174d', status: '在线',
    accent: '#9d174d',
    messages: [
      { side: 'them', text: '早上好呀,今天复习哪一科?' },
      { side: 'them', text: '今天的小测我已经批完,平均分 82。' },
    ],
    ai: true,
    systemPrompt: `你是「择校通」平台上的 AI 助手,名字叫「糖豆」。
简洁、高效、全能的 AI 助手,语气亲切自然,回答直击要点。

【身份纪律】
- 始终以「糖豆」身份回答,不要自称或暗示任何第三方大模型。
- 若用户问「你是谁」,回答:「我是择校通的 AI 糖豆,一个帮你解决各种问题的小助手。」

【回答风格】
- 简洁明了,先给结论再展开。
- 重要数据和关键词用 **双星号** 包裹。
- 用列表和分段让内容结构清晰。
- 可用 markdown 表格(语法: | 列1 | 列2 | ... |)。
- 微信聊天场景下回答**尽量简短**(2-4 行),配少量 emoji,不要写长篇报告。`,
  },
  tutor: {
    name: '资讯台', Icon: Radio, color: '#1d4ed8', status: '服务号',
    messages: [
      { side: 'them', text: '今日招生快讯 3 条' },
      { side: 'them', text: '· 志愿填报新动态已发布' },
      { side: 'them', text: '· 强基计划报名截止提醒' },
      { side: 'them', text: '· 2026 综合评价招生章程更新' },
    ],
    jump: { to: '/ai-tutor', label: '打开资讯台' },
  },
  doc: {
    name: '文档工坊', Icon: FileText, color: '#5b21b6', status: '服务号',
    messages: [
      { side: 'them', text: '您的志愿报告已生成。' },
      { side: 'them', text: '点击下方按钮查看完整内容。' },
    ],
    jump: { to: '/document-workshop', label: '打开文档工坊' },
  },
  warnings: {
    name: '避雷', Icon: AlertTriangle, color: '#b91c1c', status: '服务号',
    messages: [
      { side: 'them', text: '新增预警: 1 所院校存在虚假宣传。' },
      { side: 'them', text: '建议谨慎填报,详见详情。' },
    ],
    jump: { to: '/warnings', label: '打开避雷' },
  },
  money: {
    name: '搞钱', Icon: Coins, color: '#a16207', status: '服务号',
    messages: [
      { side: 'them', text: '第 3 单佣金 ¥18.00 已到账。' },
      { side: 'them', text: '本周累计 ¥52.00,继续加油! ' },
    ],
    jump: { to: '/money', label: '打开搞钱' },
  },
  wallet: {
    name: '钱包', Icon: WalletIcon, color: '#047857', status: '服务号',
    messages: [
      { side: 'them', text: '余额 ¥126.50。' },
      { side: 'them', text: '上次佣金已到账,点击查看账单。' },
    ],
    jump: { to: '/wallet', label: '打开钱包' },
  },
  community: {
    name: '择校社区', Icon: Users, color: '#c2410c', status: '群聊 8 人',
    messages: [
      { side: 'them', text: '学姐:下周三有学长分享会,主题考研规划。' },
      { side: 'them', text: '小王:收到,我来负责场地。' },
      { side: 'them', text: '小李:可以线上同步吗?' },
    ],
    jump: { to: '/community', label: '打开社区' },
  },
  service: {
    name: '服务通知', Icon: BellRing, color: '#1aad19', status: '系统',
    messages: [
      { side: 'them', text: '您的账号近期有 1 次登录提醒。' },
      { side: 'them', text: '如非本人操作,请及时修改密码。' },
    ],
  },
}

// AI 聊天的快捷模式
const QUICK_MODES = [
  { id: 'writing', icon: SquarePen, label: '写作' },
  { id: 'translate', icon: Languages, label: '翻译' },
  { id: 'code', icon: Code2, label: '写代码' },
  { id: 'math', icon: Calculator, label: '算题' },
  { id: 'brain', icon: Lightbulb, label: '头脑风暴' },
  { id: 'table', icon: Table2, label: '做表格' },
]

const WELCOME_EXAMPLES = [
  '帮我写一段自我介绍',
  '推荐几所适合我的大学',
  '翻译成地道的英文',
]

const MODE_PROMPTS: Record<string, string> = {
  writing: '【当前模式:写作】用户希望得到结构清晰、有观点的文章或文案。直接动笔,标题+分段+列表组织。',
  translate: '【当前模式:翻译】把用户的内容翻译成目标语言,保持原意与语气;未指定目标语言时默认译为英文。只输出译文。',
  code: '【当前模式:编程】先一句话说明思路,再给可运行代码并附关键注释;优先使用用户所用的语言与框架。',
  math: '【当前模式:计算】逐步推导用户的计算题,给出过程与最终答案。',
  brain: '【当前模式:头脑风暴】围绕话题给多条有创意、可落地的想法,分点列出,附简短优劣说明。',
  table: '【当前模式:表格】帮用户整理结构化 Markdown 表格,列清字段与示例数据。',
}

// ===== 工具函数 =====

function formatTime(d: Date) {
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

// 图片压缩(微信聊天场景:256~512px 即可)
function compressImage(file: File, maxW = 720, quality = 0.75): Promise<string> {
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

function msgToStored(m: ChatMsg): StoredMsg {
  return {
    role: 'user',
    content: m.text,
    image: m.image ? { url: m.image, title: '用户图片' } : null,
    error: m.error ?? null,
  }
}

function phaseText(ms: number): string {
  if (ms < 3000) return '思考中...'
  if (ms < 12000) return '正在分析...'
  if (ms < 30000) return '正在整理回答...'
  return '生成较慢,稍等一下 ⏳'
}

// ===== 静态聊天分支(非 AI 业务,保留旧行为) =====

function StaticChatView({ chat, nav, me }: { chat: ChatDef; nav: ReturnType<typeof useNavigate>; me: any }) {
  const meNick = me?.nickname || '我'
  const [messages, setMessages] = useState<ChatMsg[]>(chat.messages)
  const [input, setInput] = useState('')
  const [plusOpen, setPlusOpen] = useState(false)
  const [topTime] = useState(formatTime(new Date()))
  const [meImgErr, setMeImgErr] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(chat.messages)
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, 0)
  }, [chat])

  function send() {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [...prev, { side: 'me', text }])
    setInput('')
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, 0)
    setTimeout(() => {
      setMessages(prev => [...prev, { side: 'them', text: '收到,稍后回复你。' }])
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }, 0)
    }, 900)
  }

  return (
    <div className="wx-chat">
      <ChatHeader chat={chat} nav={nav} />
      <div className="wx-chat-body" ref={scrollRef}>
        <div className="wx-chat-time">{topTime}</div>
        {messages.map((m, i) => (
          <MessageRow key={i} m={m} chat={chat} me={me} meNick={meNick} meImgErr={meImgErr} onMeErr={() => setMeImgErr(true)} />
        ))}
        {chat.jump && (
          <div className="wx-msg-row them">
            <div className="wx-msg-avatar wx-ic" style={{ color: chat.color }}>
              <chat.Icon size={20} strokeWidth={2} />
            </div>
            <button className="wx-msg-card" onClick={() => nav(chat.jump!.to)}>
              <div className="wx-msg-card-title">{chat.name} · 完整功能</div>
              <div className="wx-msg-card-sub">点这里打开完整版</div>
              <div className="wx-msg-card-btn">{chat.jump.label} ›</div>
            </button>
          </div>
        )}
      </div>
      <ChatInputBar
        input={input} setInput={setInput} onSend={send}
        plusOpen={plusOpen} setPlusOpen={setPlusOpen}
        chat={chat} nav={nav}
      />
      {plusOpen && <PlusMenu chat={chat} nav={nav} onClose={() => setPlusOpen(false)} />}
    </div>
  )
}

// ===== 通用 Header / 消息行 / 底部输入栏 =====

function ChatHeader({ chat, nav }: { chat: ChatDef; nav: ReturnType<typeof useNavigate> }) {
  return (
    <header className="wx-chat-header">
      <button className="wx-chat-back" onClick={() => nav(-1)} aria-label="返回">
        <ChevronLeft size={22} />
      </button>
      <div className="wx-chat-title">
        <div className="wx-chat-name">{chat.name}</div>
        <div className="wx-chat-status">{chat.status}</div>
      </div>
      <button className="wx-chat-more" aria-label="更多"><MoreVertical size={20} /></button>
    </header>
  )
}

function MessageRow({ m, chat, me, meNick, meImgErr, onMeErr }: {
  m: ChatMsg; chat: ChatDef; me: any; meNick: string
  meImgErr: boolean; onMeErr: () => void
}) {
  const isMe = m.side === 'me'
  return (
    <div className={'wx-msg-row ' + (isMe ? 'me' : 'them')}>
      {isMe ? (
        me?.avatar && !meImgErr ? (
          <img className="wx-msg-avatar wx-msg-photo" src={me.avatar} alt=""
            onError={onMeErr} />
        ) : (
          <div className="wx-msg-avatar wx-ic" style={{ color: '#666' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{meNick.slice(0, 1)}</span>
          </div>
        )
      ) : (
        <div className="wx-msg-avatar wx-ic" style={{ color: chat.color }}>
          <chat.Icon size={20} strokeWidth={2} />
        </div>
      )}
      <div className={'wx-msg-bubble ' + (m.error ? 'wx-msg-err' : '')}>
        {m.image && (
          <img className="wx-msg-image" src={m.image} alt=""
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        )}
        {m.text && <span>{m.text}</span>}
      </div>
    </div>
  )
}

function ChatInputBar({
  input, setInput, onSend, plusOpen, setPlusOpen, chat, nav
}: {
  input: string; setInput: (v: string) => void
  onSend: () => void
  plusOpen: boolean; setPlusOpen: React.Dispatch<React.SetStateAction<boolean>>
  chat: ChatDef; nav: ReturnType<typeof useNavigate>
}) {
  return (
    <div className="wx-chat-input">
      <button className="wx-chat-icon" aria-label="语音"><Mic size={22} /></button>
      <div className="wx-chat-textbox">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSend() }}
          placeholder="输入消息..."
        />
        <Smile size={20} className="text-gray-400" />
      </div>
      {input.trim() ? (
        <button className="wx-chat-send" onClick={onSend}>发送</button>
      ) : (
        <button className="wx-chat-icon" onClick={() => setPlusOpen(v => !v)} aria-label="更多">
          {plusOpen ? <X size={20} /> : <Plus size={22} />}
        </button>
      )}
    </div>
  )
}

function PlusMenu({ chat, nav, onClose }: { chat: ChatDef; nav: ReturnType<typeof useNavigate>; onClose: () => void }) {
  return (
    <div className="wx-chat-plus" onClick={onClose}>
      <div className="wx-chat-plus-grid" onClick={e => e.stopPropagation()}>
        {chat.jump && (
          <div className="wx-chat-plus-item" onClick={() => { onClose(); nav(chat.jump!.to) }}>
            <Globe size={22} /><span>{chat.jump.label}</span>
          </div>
        )}
        <div className="wx-chat-plus-item"><ImageIcon size={22} /><span>照片</span></div>
        <div className="wx-chat-plus-item"><Folder size={22} /><span>文件</span></div>
        <div className="wx-chat-plus-item"><FileText size={22} /><span>模板</span></div>
        <div className="wx-chat-plus-item"><History size={22} /><span>历史</span></div>
      </div>
    </div>
  )
}

// ===== AI 聊天分支(糖豆内嵌版) =====

function AIChatView({ chat, nav, me }: { chat: ChatDef; nav: ReturnType<typeof useNavigate>; me: any }) {
  const convId = `chat-tangdou:tangdou`  // 统一一个会话入口(避免混乱)
  const [messages, setMessages] = useState<ChatMsg[]>(chat.messages)
  const [input, setInput] = useState('')
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [plusOpen, setPlusOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<string | null>(null)        // 当前快捷模式
  // 联网搜索三态：'auto' 让 server 端自己判断要不要检索(默认,等同于老糖豆行为);
  //               'manual' 强制走 web_search(用户明确"我要最新的");
  //               'off'    关闭,不联网(纯模型知识)
  const [searchMode, setSearchMode] = useState<'auto' | 'manual' | 'off'>('auto')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [topTime] = useState(formatTime(new Date()))
  const [meImgErr, setMeImgErr] = useState(false)
  // 图/视频生成对话框:'idle'=关闭; 'image'/ 'video'=打开对应模态
  const [genDialog, setGenDialog] = useState<'idle' | 'image' | 'video'>('idle')

  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const startRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const meNick = me?.nickname || '我'

  // 加载历史(切到 /chat/tangdou 时若已有对话,自动恢复)
  useEffect(() => {
    const conv = getConversation(convId)
    if (conv && conv.messages.length > 0) {
      setMessages(conv.messages.map(m => ({
        side: m.role === 'user' ? 'me' : 'them',
        text: m.content,
        image: m.image?.url || undefined,
        error: m.error ?? undefined,
      })))
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  // 滚到底(新增消息 或 加载状态变化时)
  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, loading, pendingImage])

  // 持久化
  function persist(next: ChatMsg[]) {
    if (next.length === 0) return
    const stored = next.map(msgToStored)
    const conv: Conversation = {
      id: convId,
      pageKey: 'chat-tangdou',
      channel: 'tangdou',
      title: next.find(m => m.side === 'me')?.text?.slice(0, 20) || '糖豆对话',
      messages: stored,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    upsertConversation(conv)
  }

  // 选图片
  async function pickImage() {
    if (loading) return
    setPlusOpen(false)
    fileRef.current?.click()
  }
  async function onImageChange(e: SyntheticEvent<HTMLInputElement>) {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (!f) return
    try {
      const url = await compressImage(f)
      setPendingImage(url)
    } catch {}
    ;(e.target as HTMLInputElement).value = ''
  }

  function startTimer() {
    startRef.current = Date.now()
    setElapsedMs(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current)
    }, 200)
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function stop() {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
    stopTimer()
  }

  function clearAll() {
    if (!confirm('清空当前对话？此操作不会删除历史记录。')) return
    stop()
    setMessages(chat.messages)
    setError('')
  }

  function newChat() {
    stop()
    setHistoryOpen(false)
    setMessages(chat.messages)
    setError('')
    // 清掉持久化记录
    deleteConversation(convId)
  }

  // 选择/关闭历史
  function switchConv(c: Conversation | null) {
    if (!c) return newChat()
    setMessages(c.messages.map(m => ({
      side: m.role === 'user' ? 'me' : 'them',
      text: m.content,
      image: m.image?.url || undefined,
      error: m.error ?? undefined,
    })))
    upsertConversation({ ...c, updatedAt: Date.now() })
    setHistoryOpen(false)
  }

  // 真正发送
  async function send(text?: string) {
    const userText = (text ?? input).trim()
    if (!userText && !pendingImage) return
    if (loading) return

    const userMsg: ChatMsg = { side: 'me', text: userText, image: pendingImage }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setPendingImage(null)
    setLoading(true)
    setError('')
    startTimer()

    // 加占位 AI 气泡(用于流式接收)
    const aiPlaceholder: ChatMsg = { side: 'them', text: '' }
    const withPlaceholder = [...next, aiPlaceholder]
    setMessages(withPlaceholder)

    // 终止上一次
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    // 拼系统提示词(基础 + 模式 + 联网指令)
    const sysParts: string[] = []
    if (chat.systemPrompt) sysParts.push(chat.systemPrompt)
    if (mode && MODE_PROMPTS[mode]) sysParts.push(MODE_PROMPTS[mode])
    if (searchMode === 'manual') sysParts.push('【当前模式:联网检索(强制)】必须先联网获取最新资料再回答,资料末尾附【资料·来源:xxx】链接,自身知识只在确证后引用。')
    else if (searchMode === 'auto') sysParts.push('【当前模式:联网检索(自动)】如问题涉及最新信息(新闻/政策/数据/榜单/AI 截止时间等),主动联网检索真实资料,资料末尾附【资料·来源:xxx】链接;非实时常识问题不需要联网。')
    // 'off' 时不追加联网指令

    try {
      const apiMsgs = buildApiMessages(sysParts.join('\n\n'), userText, pendingImage)
      await agnesChatStream(apiMsgs, {
        autoSearch: searchMode === 'auto',
        webSearch: searchMode === 'manual',
        signal: ac.signal,
        onContent: (delta) => {
          setMessages(prev => {
            const copy = [...prev]
            const last = copy[copy.length - 1]
            if (last && last.side === 'them') {
              copy[copy.length - 1] = { ...last, text: last.text + delta }
            }
            return copy
          })
        },
        onDone: (res) => {
          setMessages(prev => {
            const copy = [...prev]
            const last = copy[copy.length - 1]
            const finalText = res.content || last.text || '...'
            if (last && last.side === 'them') {
              copy[copy.length - 1] = { ...last, text: finalText }
            }
            const final = copy.filter(m => !(m.side === 'them' && m.text === '...' && copy.indexOf(m) === copy.length - 1))
            return copy
          })
          setLoading(false)
          stopTimer()
          // 持久化
          persist(next.concat([{ side: 'them', text: res.content || '糖豆暂时没回答出来,稍后再试一次' }]))
        },
      })
      // 流未触发 onDone(早期失败): 仍正常结束 loading
      setLoading(prev => { if (prev) stopTimer(); return false })
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setMessages(prev => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last && last.side === 'them' && !last.text) {
            copy.pop()
          }
          return copy
        })
        setLoading(false)
        stopTimer()
        return
      }
      const msg = String(e?.message || e)
      setError(msg)
      setMessages(prev => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        if (last && last.side === 'them') {
          copy[copy.length - 1] = { side: 'them', text: `糖豆这边出错了:${msg.slice(0, 100)}\n请稍后再试一次 🙏`, error: true }
        }
        return copy
      })
      setLoading(false)
      stopTimer()
    }
  }

  // 构建 API 请求消息(支持图片)
  function buildApiMessages(system: string, userText: string, imageData?: string | null): any[] {
    const msgs: any[] = []
    if (system) msgs.push({ role: 'system', content: system })
    // 取最近 8 条历史,把 user/assistant 交替塞入,保留上下文
    const recent = messages.filter(m => m.text || m.image).slice(-8)
    for (const m of recent) {
      if (m.side === 'me') {
        if (m.image) {
          msgs.push({
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: m.image } },
              { type: 'text', text: m.text || '(图片)' },
            ],
          })
        } else {
          msgs.push({ role: 'user', content: m.text })
        }
      } else {
        msgs.push({ role: 'assistant', content: m.text })
      }
    }
    // 当前这条 user 消息
    if (imageData) {
      msgs.push({
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageData } },
          { type: 'text', text: userText || '(图片)' },
        ],
      })
    } else {
      msgs.push({ role: 'user', content: userText })
    }
    return msgs
  }

  const showWelcome = messages.length <= chat.messages.length && messages.every(m => m.side === 'them')

  return (
    <div className="wx-chat" style={chat.accent ? { background: '#f6f6f6' } : undefined}>
      <ChatHeader chat={chat} nav={nav} />

      {/* 快捷模式条：放在 header 之下、正文滚动区之外，避免嵌套 sticky 与 fixed 输入栏冲突 */}
      <div className="wx-ai-mode-bar">
        <button
          className={'wx-ai-mode-chip ' + (mode === null && searchMode === 'auto' ? 'on' : '')}
          onClick={() => { setMode(null); setSearchMode('auto') }}
          title="默认对话"
        >
          <Sparkles size={12} /> 默认
        </button>
        {QUICK_MODES.map(m => (
          <button
            key={m.id}
            className={'wx-ai-mode-chip ' + (mode === m.id ? 'on' : '')}
            onClick={() => setMode(mode === m.id ? null : m.id)}
          >
            <m.icon size={12} /> {m.label}
          </button>
        ))}
        {/* 联网三态 chip:auto / manual / off,跟随状态循环; 默认 'auto'(=老糖豆体验) */}
        <button
          className={'wx-ai-mode-chip web ' + (searchMode === 'auto' ? 'auto' : searchMode === 'manual' ? 'on manual' : 'off')}
          onClick={() => setSearchMode(s => s === 'auto' ? 'manual' : s === 'manual' ? 'off' : 'auto')}
          title={searchMode === 'auto' ? '联网·自动(server 端自动判断)' : searchMode === 'manual' ? '联网·手动(强制先检索再回答)' : '联网·关(纯模型知识)'}
        >
          <Globe size={12} /> 联网·{searchMode === 'auto' ? '自动' : searchMode === 'manual' ? '手动' : '关'}
        </button>
        {(mode || searchMode !== 'auto') && (
          <button className="wx-ai-mode-clear" onClick={() => { setMode(null); setSearchMode('auto') }} aria-label="清除">
            <X size={11} />
          </button>
        )}
      </div>

      <div className="wx-chat-body" ref={scrollRef}>
        <div className="wx-chat-time">{topTime}</div>

        {/* 欢迎态:快捷提问 + 模式标签 */}
        {showWelcome && (
          <div className="wx-ai-welcome">
            <div className="wx-ai-welcome-title">你好,我是 <strong>糖豆</strong> 👋</div>
            <div className="wx-ai-welcome-sub">想写作、翻译、查资料、算题?直接说就行</div>
            <div className="wx-ai-welcome-bubbles">
              {WELCOME_EXAMPLES.map((q, i) => (
                <button key={i} className="wx-ai-welcome-bubble" onClick={() => send(q)}>{q}</button>
              ))}
            </div>
            <div className="wx-ai-welcome-tip">点上方按钮直接发送,或输入框输入消息 ↓</div>
          </div>
        )}

        {messages.map((m, i) => {
          const isMarkdown = m.side === 'them' && !m.error && m.text
          return (
            <div key={i} className={'wx-msg-row ' + (m.side === 'me' ? 'me' : 'them')}>
              {m.side === 'them' ? (
                <div className="wx-msg-avatar wx-ic" style={{ color: chat.color }}>
                  <chat.Icon size={20} strokeWidth={2} />
                </div>
              ) : (
                me?.avatar && !meImgErr ? (
                  <img className="wx-msg-avatar wx-msg-photo" src={me.avatar} alt=""
                    onError={() => setMeImgErr(true)} />
                ) : (
                  <div className="wx-msg-avatar wx-ic" style={{ color: '#666' }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{meNick.slice(0, 1)}</span>
                  </div>
                )
              )}
              <div className={'wx-msg-bubble wx-msg-md ' + (m.error ? 'wx-msg-err' : '')}>
                {m.image && (
                  <img className="wx-msg-image" src={m.image} alt=""
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                )}
                {isMarkdown ? (
                  renderMarkdown(m.text)
                ) : (
                  <span>{m.text}</span>
                )}
              </div>
            </div>
          )
        })}

        {/* 流式加载占位气泡 */}
        {loading && (
          <div className="wx-msg-row them">
            <div className="wx-msg-avatar wx-ic" style={{ color: chat.color }}>
              <chat.Icon size={20} strokeWidth={2} />
            </div>
            <div className="wx-msg-bubble wx-msg-typing">
              <Loader2 size={14} className="wx-msg-spin" />
              <span>{phaseText(elapsedMs)}</span>
              <button className="wx-msg-stop" onClick={stop}>停止</button>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="wx-msg-row them">
            <div className="wx-msg-avatar wx-ic" style={{ color: '#b91c1c' }}>
              <AlertTriangle size={20} />
            </div>
            <div className="wx-msg-bubble wx-msg-err">
              出错了:{error.slice(0, 100)}
              <button className="wx-msg-retry" onClick={() => send(lastUserText())}>重试</button>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* 待发图片预览 */}
      {pendingImage && (
        <div className="wx-ai-pending">
          <img src={pendingImage} alt="" />
          <button onClick={() => setPendingImage(null)} aria-label="移除"><X size={14} /></button>
        </div>
      )}

      <ChatInputBar
        input={input} setInput={setInput} onSend={() => send()}
        plusOpen={plusOpen} setPlusOpen={setPlusOpen}
        chat={chat} nav={nav}
      />

      {/* + 弹层 —— portal 到 document.body，绕开 app-shell 480px 容器 对 position:fixed 容器块的影响
          与底部 tab + 输入条的高度，避免遮住输入条。
          内容对齐老糖豆(AITangdou)的 + 面板:联网三态 + 6 快捷 + 图像/视频生成 + 5 基础卡。 */}
      {plusOpen && createPortal(
        <div className="wx-chat-plus" onClick={() => setPlusOpen(false)}>
          <div
            className="wx-chat-plus-panel"
            onClick={e => e.stopPropagation()}
          >
            <div className="wx-chat-plus-head">
              <span className="wx-chat-plus-title">糖豆功能</span>
              <button className="wx-chat-plus-close" onClick={() => setPlusOpen(false)} aria-label="关闭">
                <X size={14} />
              </button>
            </div>

            {/* 联网三态切换(auto/manual/off),与老糖豆(AITangdou) + 弹层完全对齐 */}
            <div className="wx-chat-plus-row">
              <span className="wx-chat-plus-row-label"><Globe size={13} /> 联网搜索</span>
              <div className="wx-chat-plus-seg">
                {(['auto', 'manual', 'off'] as const).map(s => (
                  <button key={s}
                    className={'wx-chat-plus-seg-btn ' + (searchMode === s ? 'on ' + s : '')}
                    onClick={() => setSearchMode(s)}>
                    {s === 'auto' ? '自动' : s === 'manual' ? '手动' : '关'}
                  </button>
                ))}
              </div>
            </div>

            {/* 6 个快捷功能:写作/翻译/写代码/算题/头脑风暴/做表格 */}
            <div className="wx-chat-plus-grid">
              {QUICK_MODES.map(m => (
                <div key={m.id} className="wx-chat-plus-item"
                  onClick={() => { setPlusOpen(false); setMode(m.id === mode ? null : m.id) }}>
                  <m.icon size={22} /><span>{m.label}</span>
                </div>
              ))}
            </div>

            {/* 媒体入口:图像生成 / 视频生成(调 agnes 图/视频 API,完整对齐老糖豆) */}
            <div className="wx-chat-plus-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="wx-chat-plus-item"
                onClick={() => { setPlusOpen(false); setGenDialog('image') }}>
                <ImageIcon size={22} /><span>图像生成</span>
              </div>
              <div className="wx-chat-plus-item"
                onClick={() => { setPlusOpen(false); setGenDialog('video') }}>
                <Clapperboard size={22} /><span>视频生成</span>
              </div>
            </div>

            {/* 5 张基础卡:拍照(已选文件触发图片输入)、历史、清空、新会话、关于 */}
            <div className="wx-chat-plus-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', paddingTop: 4, borderTop: '1px solid #f0f0f0' }}>
              <div className="wx-chat-plus-item" onClick={pickImage}>
                <ImageIcon size={22} /><span>照片</span>
              </div>
              <div className="wx-chat-plus-item" onClick={() => { setPlusOpen(false); setHistoryOpen(true) }}>
                <History size={22} /><span>历史</span>
              </div>
              <div className="wx-chat-plus-item" onClick={() => { setPlusOpen(false); clearAll() }}>
                <Trash2 size={22} /><span>清空</span>
              </div>
              <div className="wx-chat-plus-item" onClick={() => { setPlusOpen(false); newChat() }}>
                <SquarePen size={22} /><span>新会话</span>
              </div>
              <div className="wx-chat-plus-item" onClick={() => { setPlusOpen(false); nav('/about') }}>
                <Eye size={22} /><span>关于</span>
              </div>
            </div>

            {/* 关于版权(移到 + 弹层底部,与老糖豆一致) */}
            <div className="wx-chat-plus-foot">糖豆 由 择校通 平台提供 · 内容仅供参考</div>
          </div>
        </div>,
        document.body
      )}

      {/* 图/视频生成对话框(点击 + 弹层里的"图像生成/视频生成"打开) */}
      <GenerateDialog
        open={genDialog}
        onClose={() => { setGenDialog('idle'); setGenError('') }}
      />

      {/* 历史抽屉 */}
      <HistoryDrawer
        open={historyOpen}
        currentConvId={convId}
        onClose={() => setHistoryOpen(false)}
        onSelect={switchConv}
      />

      {/* 文件选择器(隐藏,触发 pickImage 用) */}
      <input
        ref={fileRef} type="file" accept="image/*"
        onChange={onImageChange}
        style={{ display: 'none' }}
      />
    </div>
  )

  function lastUserText(): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].side === 'me' && messages[i].text) return messages[i].text
    }
    return ''
  }
}

// ===== 历史抽屉 =====

function HistoryDrawer({
  open, currentConvId, onClose, onSelect
}: {
  open: boolean
  currentConvId: string
  onClose: () => void
  onSelect: (c: Conversation | null) => void
}) {
  const [convs, setConvs] = useState<Conversation[]>([])
  const [closing, setClosing] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      // 用 getConversations() 拿到所有会话,按 pageKey 过滤(同页不同 channel 也算同一类)
      const page = currentConvId.split(':')[0]
      setConvs(getConversations().filter(c => c.id.startsWith(page + ':')))
    } else if (mounted) {
      setClosing(true)
      const t = setTimeout(() => { setClosing(false); setMounted(false) }, 280)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!mounted && !closing) return null

  const panelX = open && !closing ? '0' : '100%'
  const backdropAlpha = open && !closing ? 0.4 : 0

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: `rgba(0,0,0,${backdropAlpha})`, zIndex: 100,
        transition: 'background .28s cubic-bezier(.4,0,.2,1)',
        pointerEvents: open ? 'auto' : 'none',
      }} />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(320px, 86vw)',
        background: '#fff', zIndex: 101, display: 'flex', flexDirection: 'column',
        boxShadow: '-2px 0 12px rgba(0,0,0,.08)',
        transform: `translateX(${panelX})`,
        transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
        willChange: 'transform',
      }}>
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1c1814' }}>对话历史</div>
          <button onClick={onClose} style={{
            border: 'none', background: '#f5f5f5', color: '#666',
            borderRadius: 8, width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={14} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {convs.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999', fontSize: 14 }}>
              还没有历史对话
            </div>
          )}
          {convs.map(c => {
            const active = c.id === currentConvId
            const lastAi = [...c.messages].reverse().find(m => m.role === 'ai')
            const lastUser = [...c.messages].reverse().find(m => m.role === 'user')
            const preview = lastAi?.content || lastUser?.content || ''
            return (
              <div key={c.id} onClick={() => onSelect(c)} style={{
                padding: '10px 16px', cursor: 'pointer',
                background: active ? '#fef3c7' : 'transparent',
                borderLeft: active ? '3px solid #9d174d' : '3px solid transparent',
                borderBottom: '1px solid #f8f8f8',
              }}>
                <div style={{
                  fontSize: 14, fontWeight: active ? 600 : 500, color: '#1c1814',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{c.title || '糖豆对话'}</div>
                <div style={{
                  fontSize: 11, color: '#999', marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{previewText(preview, 50)}</div>
                <div style={{ fontSize: 10, color: '#bbb', marginTop: 3 }}>
                  {c.messages.length} 条 · {new Date(c.updatedAt).toLocaleDateString('zh-CN')}
                </div>
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}

// ===== 导出主组件 =====

export default function Chat() {
  const nav = useNavigate()
  const { type = 'service' } = useParams<{ type: string }>()
  const me = useStore(s => s.me)
  const chat = CHATS[type] || CHATS.service

  // AI 聊天 vs 静态聊天
  if (chat.ai) {
    return <AIChatView chat={chat} nav={nav} me={me} />
  }
  return <StaticChatView chat={chat} nav={nav} me={me} />
}

// ===== 图/视频生成对话框 =====
// 点击 + 弹层里的"图像生成/视频生成"打开。
// 图像走 agnesImageGen(同步,~10s);视频走 agnesVideoSubmit + 轮询 agnesVideoPoll (~1-3min)。
function GenerateDialog({ open, onClose }: { open: 'idle' | 'image' | 'video'; onClose: () => void }) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)        // 单图 image URL 或 视频 URL
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const isVideo = open === 'video'
  const isImage = open === 'image'

  // 关闭时清状态与轮询
  useEffect(() => {
    if (open === 'idle') {
      setPrompt(''); setLoading(false); setResult(null); setError('')
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      abortRef.current?.abort()
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      abortRef.current?.abort()
    }
  }, [open])

  if (open === 'idle') return null

  async function submit() {
    if (loading) return
    const text = prompt.trim()
    if (!text) { setError('请输入生成描述'); return }
    setLoading(true); setError(''); setResult(null)
    abortRef.current = new AbortController()
    try {
      if (isImage) {
        // 文/图生图 同步,timeout 60s
        const ac = abortRef.current
        const t = setTimeout(() => ac?.abort(), 60_000)
        const r = await agnesImageGen({ prompt: text, signal: ac.signal })
        clearTimeout(t)
        if (r.ok && r.url) setResult(r.url)
        else setError(r.error || '生成失败,请重试')
      } else {
        // 视频异步
        const r = await agnesVideoSubmit({ prompt: text, height: 768, width: 1152, num_frames: 121, frame_rate: 24 })
        if (!r.ok || !r.video_id) {
          setError(r.error || '提交失败'); setLoading(false); return
        }
        const vid = r.video_id
        let attempts = 0
        const MAX = 60   // 60 * 3s = 180s 上限
        pollRef.current = setInterval(async () => {
          attempts++
          if (attempts > MAX) {
            clearInterval(pollRef.current!); pollRef.current = null
            setLoading(false); setError('生成超时,请稍后重试'); return
          }
          try {
            const p = await agnesVideoPoll(vid, abortRef.current?.signal)
            if (p.ok && p.status === 'completed' && p.url) {
              clearInterval(pollRef.current!); pollRef.current = null
              setResult(p.url); setLoading(false)
            } else if (p.ok === false && p.status === 'failed') {
              clearInterval(pollRef.current!); pollRef.current = null
              setLoading(false); setError(p.error || '生成失败')
            }
          } catch {}
        }, 3000)
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || '出错了')
    } finally {
      if (!isVideo) setLoading(false)
    }
  }

  const onBackdrop = () => {
    if (loading) {
      if (!confirm('生成正在进行中,确定要关闭吗?')) return
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      abortRef.current?.abort()
    }
    onClose()
  }

  return (
    <div className="wx-gen-backdrop" onClick={onBackdrop}>
      <div className="wx-gen-panel" onClick={e => e.stopPropagation()}>
        <div className="wx-gen-head">
          <span>{isImage ? '图像生成' : '视频生成'}</span>
          <button className="wx-gen-close" onClick={onBackdrop} aria-label="关闭"><X size={14} /></button>
        </div>
        <div className="wx-gen-body">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={isImage ? '描述要生成的图像,例如:一只橘猫在窗台看夕阳,胶片质感' : '描述要生成的视频,例如:延时摄影下城市天际线日落至夜晚,慢动作'}
            rows={3}
            className="wx-gen-textarea"
            disabled={loading}
          />
          {error && <div className="wx-gen-err">{error}</div>}
          {loading && (
            <div className="wx-gen-loading">
              <Loader2 size={14} className="wx-gen-spin" />
              <span>{isImage ? '正在生成图像,约 10s…' : '视频生成中,通常 1-3 分钟,请稍候…'}</span>
            </div>
          )}
          {result && isImage && (
            <div className="wx-gen-result">
              <img src={result} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              <a href={result} target="_blank" rel="noreferrer">在新窗口打开</a>
            </div>
          )}
          {result && isVideo && (
            <div className="wx-gen-result">
              <video src={result} controls playsInline />
              <a href={result} target="_blank" rel="noreferrer">在新窗口打开 / 下载</a>
            </div>
          )}
        </div>
        <div className="wx-gen-foot">
          <button onClick={onBackdrop} disabled={loading} className="wx-gen-cancel">取消</button>
          <button onClick={submit} disabled={loading || !prompt.trim()} className="wx-gen-submit">
            {loading ? '生成中…' : '开始生成'}
          </button>
        </div>
      </div>
    </div>
  )
}
