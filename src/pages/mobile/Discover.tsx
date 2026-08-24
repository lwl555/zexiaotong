import { useNavigate } from 'react-router-dom'
import { Radio, Clock, Star, Megaphone, Compass, FileText, AlertTriangle, Coins } from 'lucide-react'

// 发现：资讯 / 历史 / 收藏 / 活动（微信「发现」观感）
const ITEMS = [
  { to: '/ai-tutor', icon: Radio, glyph: '讯', color: '#1d4ed8', label: '实时资讯台', desc: '最新招生快讯' },
  { to: '/ai-history', icon: Clock, glyph: '历', color: '#0f766e', label: 'AI 对话历史', desc: '查看过往问答' },
  { to: '/mine', icon: Star, glyph: '藏', color: '#be123c', label: '我的收藏', desc: '帖子 / 院校 / 报告' },
  { to: '/community', icon: Megaphone, glyph: '校', color: '#c2410c', label: '校园广场', desc: '热门讨论 / 活动' },
  { to: '/ai-search', icon: Compass, glyph: '百', color: '#0f766e', label: 'AI 百事通', desc: '随手问院校问题' },
  { to: '/document-workshop', icon: FileText, glyph: '档', color: '#5b21b6', label: '文档工坊', desc: '生成志愿报告' },
  { to: '/warnings', icon: AlertTriangle, glyph: '⚠', color: '#b91c1c', label: '避雷清单', desc: '避坑预警' },
  { to: '/money', icon: Coins, glyph: '¥', color: '#a16207', label: '搞钱项目', desc: '佣金任务' },
]

export default function Discover() {
  const nav = useNavigate()
  return (
    <div className="wx-page">
      <header className="wx-header">
        <button className="wx-h-icon" aria-label="返回">‹‹</button>
        <div className="wx-title">发现</div>
        <div className="wx-h-right"><span className="wx-h-icon" style={{ visibility: 'hidden' }}>＋</span></div>
      </header>

      <div className="wx-discover">
        {ITEMS.map(it => (
          <button key={it.to} className="wx-discover-row" onClick={() => nav(it.to)}>
            <span className="wx-discover-avatar" style={{ background: it.color }}>{it.glyph}</span>
            <span className="wx-discover-text">
              <span className="wx-discover-name">{it.label}</span>
              <span className="wx-discover-desc">{it.desc}</span>
            </span>
            <span className="wx-discover-arrow">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
