import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, Compass, Bot, Radio, FileText, AlertTriangle, Coins,
  Wallet as WalletIcon, GraduationCap, BellRing, Users, MessageCircleQuestion
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// 顶部一排快捷卡片（横滑）—— 微信「服务」宫格的变体，最高频入口
// 点击 → 进对应微信式聊天页（/chat/xxx）。图标化头像，去掉色块占位感。
const QUICK: { to: string; label: string; Icon: LucideIcon; color: string }[] = [
  { to: '/chat/baishitong', label: '百事通', Icon: Compass, color: '#0f766e' },
  { to: '/chat/tangdou', label: '糖豆', Icon: Bot, color: '#9d174d' },
  { to: '/chat/tutor', label: '资讯台', Icon: Radio, color: '#1d4ed8' },
  { to: '/chat/doc', label: '文档工坊', Icon: FileText, color: '#5b21b6' },
  { to: '/chat/warnings', label: '避雷', Icon: AlertTriangle, color: '#b91c1c' },
  { to: '/chat/money', label: '搞钱', Icon: Coins, color: '#a16207' },
  { to: '/chat/wallet', label: '钱包', Icon: WalletIcon, color: '#047857' },
]

// 微信式会话列表：去 AI 化预览、去 [应用消息] 前缀、改成自然聊天
// type: 'ai' 普通图标头像 | 'app' 微信绿应用消息头像 | 'group' 群聊
const SESSIONS: {
  key: string; to: string; type: 'ai' | 'app' | 'group'
  Icon: LucideIcon; color: string; name: string; preview: string; time: string; unread: number
}[] = [
  {
    key: 'community', to: '/chat/community', type: 'group',
    Icon: Users, color: '#c2410c', name: '择校社区',
    preview: '学姐:下周三有学长分享会,主题考研规划', time: '16:26', unread: 86,
  },
  {
    key: 'service', to: '/chat/service', type: 'app',
    Icon: BellRing, color: '#1aad19', name: '服务通知',
    preview: '您的账号近期有 1 次登录提醒', time: '14:48', unread: 1,
  },
  {
    key: 'baishitong', to: '/chat/baishitong', type: 'ai',
    Icon: Compass, color: '#0f766e', name: '百事通',
    preview: '上海交大 2026 招生章程有调整,详见 招生处官网', time: '14:48', unread: 0,
  },
  {
    key: 'tangdou', to: '/chat/tangdou', type: 'ai',
    Icon: Bot, color: '#9d174d', name: '糖豆',
    preview: '今天的小测我已经批完,平均分 82', time: '13:00', unread: 2,
  },
  {
    key: 'tutor', to: '/chat/tutor', type: 'app',
    Icon: Radio, color: '#1d4ed8', name: '资讯台',
    preview: '今日招生快讯 3 条 · 志愿填报新动态', time: '12:39', unread: 1,
  },
  {
    key: 'doc', to: '/chat/doc', type: 'app',
    Icon: FileText, color: '#5b21b6', name: '文档工坊',
    preview: '您的志愿报告已生成,点击查看', time: '昨天', unread: 0,
  },
  {
    key: 'warnings', to: '/chat/warnings', type: 'app',
    Icon: AlertTriangle, color: '#b91c1c', name: '避雷',
    preview: '新增预警: 1 所院校存在虚假宣传', time: '周五', unread: 0,
  },
  {
    key: 'money', to: '/chat/money', type: 'app',
    Icon: Coins, color: '#a16207', name: '搞钱',
    preview: '第 3 单佣金 ¥18.00 已到账', time: '周一', unread: 0,
  },
  {
    key: 'wallet', to: '/chat/wallet', type: 'ai',
    Icon: WalletIcon, color: '#047857', name: '钱包',
    preview: '余额 ¥126.50 · 上次佣金已到账', time: '8月13日', unread: 0,
  },
]

function Avatar({ type, Icon, color }: { type: string; Icon: LucideIcon; color: string }) {
  if (type === 'app') {
    return (
      <div className="wx-avatar wx-app">
        <Icon size={24} strokeWidth={2} />
      </div>
    )
  }
  return (
    <div className="wx-avatar wx-ic" style={{ color }}>
      <Icon size={24} strokeWidth={2} />
    </div>
  )
}

export default function MobileWechatHome() {
  const nav = useNavigate()
  const totalUnread = SESSIONS.reduce((a, s) => a + (s.unread || 0), 0)

  return (
    <div className="wx-page">
      {/* 微信式 header：左 ‹‹、中"首页(N)"、右 搜索/＋ */}
      <header className="wx-header">
        <button className="wx-h-icon" aria-label="聊天列表" onClick={() => nav('/contacts')}>‹‹</button>
        <div className="wx-title">首页{totalUnread > 0 ? `(${totalUnread})` : ''}</div>
        <div className="wx-h-right">
          <button className="wx-h-icon" aria-label="搜索" onClick={() => nav('/discover')}><Search size={20} /></button>
          <button className="wx-h-icon" aria-label="更多" onClick={() => nav('/mine')}><Plus size={22} /></button>
        </div>
      </header>

      {/* 顶部一排快捷卡片（横滑）：最高频功能，一点即进对应聊天页 */}
      <div className="wx-quick">
        {QUICK.map(q => (
          <button key={q.to} className="wx-quick-item" onClick={() => nav(q.to)}>
            <div className="wx-quick-ic" style={{ color: q.color }}>
              <q.Icon size={24} strokeWidth={2} />
            </div>
            <span className="wx-quick-label">{q.label}</span>
          </button>
        ))}
      </div>

      {/* 会话列表（微信式） */}
      <div className="wx-list">
        {SESSIONS.map(s => (
          <button key={s.key} className="wx-row" onClick={() => nav(s.to)}>
            <div className="wx-row-avatar">
              <Avatar type={s.type} Icon={s.Icon} color={s.color} />
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
