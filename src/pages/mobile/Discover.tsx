import { useNavigate } from 'react-router-dom'
import { Radio, Clock, Star, Megaphone, Compass, FileText, AlertTriangle, Coins } from 'lucide-react'

// 发现：去 AI 化、贴近"朋友圈/视频号/直播/附近"那种自然入口
const ITEMS = [
  { to: '/community', icon: Megaphone, glyph: '圈', color: '#1aad19', label: '朋友圈', desc: '同学动态 · 点赞' },
  { to: '/ai-tutor', icon: Radio, glyph: '讯', color: '#1d4ed8', label: '资讯台', desc: '最新快讯' },
  { to: '/ai-history', icon: Clock, glyph: '历', color: '#0f766e', label: '历史对话', desc: '过往问答' },
  { to: '/mine', icon: Star, glyph: '藏', color: '#be123c', label: '收藏', desc: '帖子 · 报告' },
  { to: '/ai-search', icon: Compass, glyph: '百', color: '#0f766e', label: '百事通', desc: '随手问' },
  { to: '/document-workshop', icon: FileText, glyph: '档', color: '#5b21b6', label: '文档工坊', desc: '生成报告' },
  { to: '/warnings', icon: AlertTriangle, glyph: '⚠', color: '#b91c1c', label: '避雷', desc: '院校预警' },
  { to: '/money', icon: Coins, glyph: '¥', color: '#a16207', label: '搞钱', desc: '佣金任务' },
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
