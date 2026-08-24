import { useNavigate } from 'react-router-dom'
import { Search, Compass, Sparkles, Radio, FileText, AlertTriangle, Coins, ShoppingBag, MessageSquare, Wallet } from 'lucide-react'

// 通讯录：去 AI 化标签,改为中性描述
const GROUPS = [
  {
    letter: 'A',
    items: [
      { to: '/ai-search', label: '百事通', icon: Compass, glyph: '百', color: '#0f766e', desc: '查院校 · 政策' },
      { to: '/ai-tangdou', label: '糖豆', icon: Sparkles, glyph: '豆', color: '#9d174d', desc: '学习搭子' },
      { to: '/ai-tutor', label: '资讯台', icon: Radio, glyph: '讯', color: '#1d4ed8', desc: '每日快讯' },
    ],
  },
  {
    letter: 'D',
    items: [
      { to: '/document-workshop', label: '文档工坊', icon: FileText, glyph: '档', color: '#5b21b6', desc: '生成报告' },
    ],
  },
  {
    letter: 'L',
    items: [
      { to: '/warnings', label: '避雷', icon: AlertTriangle, glyph: '⚠', color: '#b91c1c', desc: '院校预警' },
    ],
  },
  {
    letter: 'M',
    items: [
      { to: '/money', label: '搞钱', icon: Coins, glyph: '¥', color: '#a16207', desc: '佣金任务' },
      { to: '/mine', label: '我的', icon: Wallet, glyph: '我', color: '#047857', desc: '账号 · 钱包' },
    ],
  },
  {
    letter: 'S',
    items: [
      { to: '/goods', label: '二手集市', icon: ShoppingBag, glyph: '市', color: '#be123c', desc: '校内闲置' },
      { to: '/community', label: '校园社区', icon: MessageSquare, glyph: '校', color: '#c2410c', desc: '帖子 · 互助' },
    ],
  },
]

export default function Contacts() {
  const nav = useNavigate()
  return (
    <div className="wx-page">
      <header className="wx-header">
        <button className="wx-h-icon" aria-label="返回">‹‹</button>
        <div className="wx-title">通讯录</div>
        <div className="wx-h-right"><span className="wx-h-icon" style={{ visibility: 'hidden' }}>＋</span></div>
      </header>

      <div className="wx-search-bar">
        <Search size={16} className="text-gray-400" />
        <span className="text-sm text-gray-400">搜索</span>
      </div>

      {GROUPS.map(g => (
        <div key={g.letter} className="wx-contact-group">
          <div className="wx-letter">{g.letter}</div>
          {g.items.map(it => (
            <button key={it.to} className="wx-contact-row" onClick={() => nav(it.to)}>
              <span className="wx-contact-avatar" style={{ background: it.color }}>{it.glyph}</span>
              <span className="wx-contact-text">
                <span className="wx-contact-name">{it.label}</span>
                <span className="wx-contact-desc">{it.desc}</span>
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
