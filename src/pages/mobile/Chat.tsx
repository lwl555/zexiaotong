import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, MoreVertical, Mic, Plus, Smile, Image as ImageIcon, Folder, Calculator, FileText, History } from 'lucide-react'
import { useStore } from '../../store/store'

// 每个会话的基础信息
type MsgSide = 'them' | 'me'
interface ChatMsg { side: MsgSide; text: string }
interface ChatDef {
  name: string
  glyph: string
  color: string
  status: string
  messages: ChatMsg[]
  jump?: { to: string; label: string }  // 跳原功能页的入口
}

const CHATS: Record<string, ChatDef> = {
  baishitong: {
    name: '百事通', glyph: '百', color: '#0f766e', status: '在线',
    messages: [
      { side: 'them', text: '你好,我是百事通,查院校、问政策都可以找我。' },
      { side: 'them', text: '上海交大 2026 招生章程有调整,详见 招生处官网。' },
    ],
    jump: { to: '/ai-search', label: '打开百事通' },
  },
  tangdou: {
    name: '糖豆', glyph: '豆', color: '#9d174d', status: '在线',
    messages: [
      { side: 'them', text: '早上好呀,今天复习哪一科?' },
      { side: 'them', text: '今天的小测我已经批完,平均分 82。' },
    ],
    jump: { to: '/ai-tangdou', label: '打开糖豆' },
  },
  tutor: {
    name: '资讯台', glyph: '讯', color: '#1d4ed8', status: '服务号',
    messages: [
      { side: 'them', text: '今日招生快讯 3 条' },
      { side: 'them', text: '· 志愿填报新动态已发布' },
      { side: 'them', text: '· 强基计划报名截止提醒' },
      { side: 'them', text: '· 2026 综合评价招生章程更新' },
    ],
    jump: { to: '/ai-tutor', label: '打开资讯台' },
  },
  doc: {
    name: '文档工坊', glyph: '档', color: '#5b21b6', status: '服务号',
    messages: [
      { side: 'them', text: '您的志愿报告已生成。' },
      { side: 'them', text: '点击下方按钮查看完整内容。' },
    ],
    jump: { to: '/document-workshop', label: '打开文档工坊' },
  },
  warnings: {
    name: '避雷', glyph: '⚠', color: '#b91c1c', status: '服务号',
    messages: [
      { side: 'them', text: '新增预警: 1 所院校存在虚假宣传。' },
      { side: 'them', text: '建议谨慎填报,详见详情。' },
    ],
    jump: { to: '/warnings', label: '打开避雷' },
  },
  money: {
    name: '搞钱', glyph: '¥', color: '#a16207', status: '服务号',
    messages: [
      { side: 'them', text: '第 3 单佣金 ¥18.00 已到账。' },
      { side: 'them', text: '本周累计 ¥52.00,继续加油! ' },
    ],
    jump: { to: '/money', label: '打开搞钱' },
  },
  wallet: {
    name: '钱包', glyph: '¥', color: '#047857', status: '服务号',
    messages: [
      { side: 'them', text: '余额 ¥126.50。' },
      { side: 'them', text: '上次佣金已到账,点击查看账单。' },
    ],
    jump: { to: '/wallet', label: '打开钱包' },
  },
  community: {
    name: '择校社区', glyph: '校', color: '#c2410c', status: '群聊 8 人',
    messages: [
      { side: 'them', text: '学姐:下周三有学长分享会,主题考研规划。' },
      { side: 'them', text: '小王:收到,我来负责场地。' },
      { side: 'them', text: '小李:可以线上同步吗?' },
    ],
    jump: { to: '/community', label: '打开社区' },
  },
  service: {
    name: '服务通知', glyph: '✓', color: '#1aad19', status: '系统',
    messages: [
      { side: 'them', text: '您的账号近期有 1 次登录提醒。' },
      { side: 'them', text: '如非本人操作,请及时修改密码。' },
    ],
  },
}

function formatTime(d: Date) {
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

export default function Chat() {
  const nav = useNavigate()
  const { type = 'service' } = useParams<{ type: string }>()
  const me = useStore(s => s.me)
  const meNick = me?.nickname || '我'
  const meColor = me?.avatar ? '#7c3aed' : '#666'
  const chat = CHATS[type] || CHATS.service

  const [messages, setMessages] = useState<ChatMsg[]>(chat.messages)
  const [input, setInput] = useState('')
  const [plusOpen, setPlusOpen] = useState(false)
  const [topTime] = useState(formatTime(new Date()))
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 切到不同会话时重置消息 + 滚到底
    setMessages(CHATS[type]?.messages || [])
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, 0)
  }, [type])

  function send() {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [...prev, { side: 'me', text }])
    setInput('')
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, 0)
    // 模拟对方回复一条(更真实)
    setTimeout(() => {
      setMessages(prev => [...prev, { side: 'them', text: '收到,稍后回复你。' }])
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }, 0)
    }, 900)
  }

  return (
    <div className="wx-chat">
      {/* 顶部 */}
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

      {/* 消息区 */}
      <div className="wx-chat-body" ref={scrollRef}>
        <div className="wx-chat-time">{topTime}</div>
        {messages.map((m, i) => (
          <div key={i} className={'wx-msg-row ' + (m.side === 'me' ? 'me' : 'them')}>
            {m.side === 'them' ? (
              <div className="wx-msg-avatar" style={{ background: chat.color }}>{chat.glyph}</div>
            ) : (
              <div className="wx-msg-avatar" style={{ background: meColor }}>{meNick.slice(0, 1)}</div>
            )}
            <div className="wx-msg-bubble">{m.text}</div>
          </div>
        ))}

        {/* 跳原功能页的入口（卡片式） */}
        {chat.jump && (
          <div className="wx-msg-row them">
            <div className="wx-msg-avatar" style={{ background: chat.color }}>{chat.glyph}</div>
            <button className="wx-msg-card" onClick={() => nav(chat.jump!.to)}>
              <div className="wx-msg-card-title">{chat.name} · 完整功能</div>
              <div className="wx-msg-card-sub">点这里打开完整版</div>
              <div className="wx-msg-card-btn">{chat.jump.label} ›</div>
            </button>
          </div>
        )}
      </div>

      {/* 底部输入栏 */}
      <div className="wx-chat-input">
        <button className="wx-chat-icon" aria-label="语音"><Mic size={22} /></button>
        <div className="wx-chat-textbox">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send() }}
            placeholder="输入消息..."
          />
          <Smile size={20} className="text-gray-400" />
        </div>
        {input.trim() ? (
          <button className="wx-chat-send" onClick={send}>发送</button>
        ) : (
          <button className="wx-chat-icon" onClick={() => setPlusOpen(v => !v)} aria-label="更多">
            <Plus size={22} />
          </button>
        )}
      </div>

      {/* ＋号弹出的菜单 */}
      {plusOpen && (
        <div className="wx-chat-plus" onClick={() => setPlusOpen(false)}>
          <div className="wx-chat-plus-grid" onClick={e => e.stopPropagation()}>
            <div className="wx-chat-plus-item"><ImageIcon size={22} /><span>照片</span></div>
            <div className="wx-chat-plus-item"><Folder size={22} /><span>文件</span></div>
            <div className="wx-chat-plus-item"><FileText size={22} /><span>模板</span></div>
            <div className="wx-chat-plus-item"><History size={22} /><span>历史</span></div>
            {chat.jump && (
              <div className="wx-chat-plus-item" onClick={() => { setPlusOpen(false); nav(chat.jump!.to) }}>
                <Calculator size={22} /><span>{chat.jump.label}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
