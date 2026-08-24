import { useNavigate } from 'react-router-dom'
import { Search, Plus } from 'lucide-react'
import { useStore } from '../../store/store'

// 顶部一排快捷卡片（最高频入口）
const QUICK = [
  { to: '/ai-search', label: '百事通', glyph: '百', color: '#0f766e' },
  { to: '/ai-tangdou', label: '糖豆', glyph: '豆', color: '#9d174d' },
  { to: '/ai-tutor', label: '资讯台', glyph: '讯', color: '#1d4ed8' },
  { to: '/document-workshop', label: '文档工坊', glyph: '档', color: '#5b21b6' },
  { to: '/warnings', label: '避雷', glyph: '⚠', color: '#b91c1c' },
  { to: '/money', label: '搞钱', glyph: '¥', color: '#a16207' },
]

// 微信式会话列表：把每个平台功能做成一条 chat session
// type: 'ai' 普通彩色头像 | 'app' 绿色应用消息头像 | 'group' 群聊（九宫格用单色块占位）
const SESSIONS = [
  {
    key: 'community', to: '/community', type: 'group' as const,
    glyph: '校', color: '#c2410c', name: '择校社区',
    preview: '护考姐妹：26 护考大纲已上传，点开看 >>', time: '16:26', unread: 86,
  },
  {
    key: 'baishitong', to: '/ai-search', type: 'ai' as const,
    glyph: '百', color: '#0f766e', name: 'AI 百事通',
    preview: '百事通：查到上海交大 2026 招生章程，要发你吗？', time: '14:48', unread: 0,
  },
  {
    key: 'tangdou', to: '/ai-tangdou', type: 'ai' as const,
    glyph: '豆', color: '#9d174d', name: '糖豆 · 学习搭子',
    preview: '糖豆：再来一组今天的复习卡？', time: '13:00', unread: 2,
  },
  {
    key: 'tutor', to: '/ai-tutor', type: 'app' as const,
    glyph: '讯', color: '#1d4ed8', name: '实时资讯台',
    preview: '[应用消息] 今日 3 条快讯 · 志愿填报新动态', time: '12:39', unread: 1,
  },
  {
    key: 'doc', to: '/document-workshop', type: 'app' as const,
    glyph: '档', color: '#5b21b6', name: '文档工坊',
    preview: '[应用消息] 上次的志愿报告已生成', time: '昨天', unread: 0,
  },
  {
    key: 'warnings', to: '/warnings', type: 'app' as const,
    glyph: '⚠', color: '#b91c1c', name: '避雷清单',
    preview: '[应用消息] 新增 1 所预警院校', time: '周五', unread: 0,
  },
  {
    key: 'money', to: '/money', type: 'app' as const,
    glyph: '¥', color: '#a16207', name: '搞钱项目',
    preview: '[应用消息] 今日第 3 单佣金已到账', time: '周一', unread: 0,
  },
  {
    key: 'wallet', to: '/wallet', type: 'ai' as const,
    glyph: '¥', color: '#047857', name: '钱包 · 我的资产',
    preview: '余额 ¥126.50 · 上次佣金已到账', time: '8月13日', unread: 0,
  },
]

function Avatar({ type, glyph, color }: { type: string; glyph: string; color: string }) {
  if (type === 'app') {
    return (
      <div className="wx-avatar wx-app">
        <span>{glyph}</span>
      </div>
    )
  }
  return (
    <div className="wx-avatar" style={{ background: color }}>
      <span>{glyph}</span>
    </div>
  )
}

export default function MobileWechatHome() {
  const nav = useNavigate()
  const me = useStore(s => s.me)
  const unread = useStore(s => (me ? s.notifications.filter(n => n.user_id === me.id && !n.read).length : 0))
  const totalUnread = SESSIONS.reduce((a, s) => a + (s.unread || 0), 0) + unread

  return (
    <div className="wx-page">
      {/* 微信式 header */}
      <header className="wx-header">
        <button className="wx-h-icon" aria-label="返回">‹‹</button>
        <div className="wx-title">择校通{totalUnread > 0 ? `(${totalUnread})` : ''}</div>
        <div className="wx-h-right">
          <button className="wx-h-icon" aria-label="搜索" onClick={() => nav('/ai-search')}><Search size={20} /></button>
          <button className="wx-h-icon" aria-label="更多" onClick={() => nav('/mine')}><Plus size={22} /></button>
        </div>
      </header>

      {/* 一行轻提示 banner（仿微信登录设备提示） */}
      <div className="wx-banner">
        <span className="wx-banner-dot" />
        <span>学习季 · AI 已更新 2026 招生数据</span>
      </div>

      {/* 顶部快捷卡片横排（scroll-snap 横滑） */}
      <div className="wx-quick">
        {QUICK.map(q => (
          <button key={q.to} className="wx-quick-item" onClick={() => nav(q.to)}>
            <span className="wx-quick-avatar" style={{ background: q.color }}>{q.glyph}</span>
            <span className="wx-quick-label">{q.label}</span>
          </button>
        ))}
      </div>

      {/* 会话列表 */}
      <div className="wx-list">
        {SESSIONS.map(s => (
          <button key={s.key} className="wx-row" onClick={() => nav(s.to)}>
            <div className="wx-row-avatar">
              <Avatar type={s.type} glyph={s.glyph} color={s.color} />
              {s.unread > 0 && <span className="wx-badge">{s.unread > 99 ? '99+' : s.unread}</span>}
            </div>
            <div className="wx-row-main">
              <div className="wx-row-top">
                <span className="wx-row-name">{s.name}</span>
                <span className="wx-row-time">{s.time}</span>
              </div>
              <div className="wx-row-preview">{s.preview}</div>
            </div>
          </button>
        ))}
        {/* 微信式「折叠置顶聊天」分隔行 */}
        <div className="wx-fold">折叠置顶聊天</div>
      </div>
    </div>
  )
}
