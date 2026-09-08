import { useNavigate } from 'react-router-dom'
import { ChevronRight, MessageSquare, ShoppingBag, ClipboardList, Coins, Radio, Clock, Bot, Compass, Sparkles, GraduationCap, FileText, AlertTriangle } from 'lucide-react'
import {
  PageHeader,
  SectionLabel,
  SoftCard,
  ListRow,
  INK,
  MUTED,
  FAINT,
  ACCENT,
  FONT,
} from '../../components/Editorial'

// 分组聚合入口（暖陶土编辑风）：图标方块 + 名称 + 描述 + chevron
interface Entry {
  to: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>
  label: string
  desc: string
}

const GROUPS: { label: string; items: Entry[] }[] = [
  {
    label: '社区',
    items: [
      { to: '/community', icon: MessageSquare, label: '择校社区', desc: '帖子 · 互助 · 问答' },
      { to: '/goods', icon: ShoppingBag, label: '二手市场', desc: '校内闲置 · 好物流转' },
      { to: '/publish', icon: ClipboardList, label: '任务大厅', desc: '发任务 · 接单赚钱' },
    ],
  },
  {
    label: '机会',
    items: [
      { to: '/money', icon: Coins, label: '搞钱项目', desc: '兼职 / 副业 / 创业聚合' },
    ],
  },
  {
    label: '资讯',
    items: [
      { to: '/news', icon: Radio, label: '实时资讯台', desc: '联网检索 · 每日快讯' },
      { to: '/ai-history', icon: Clock, label: 'AI 查询记录', desc: '接着聊，不重问' },
    ],
  },
  {
    label: 'AI 工具',
    items: [
      { to: '/chat', icon: Bot, label: 'AI 聊天', desc: '多角色 · 图文视频生成' },
      { to: '/ai-search', icon: Compass, label: 'AI 百事通', desc: '查院校 · 查公司 · 按城市' },
      { to: '/ai-tangdou', icon: Sparkles, label: '糖豆·学习搭子', desc: '复习计划 · 答疑' },
      { to: '/ai-tutor', icon: GraduationCap, label: '学习导师', desc: 'AI 1v1 路径规划' },
      { to: '/document-workshop', icon: FileText, label: '文档工坊', desc: '报告 / 简历 一键生成' },
      { to: '/warnings', icon: AlertTriangle, label: '避雷清单', desc: '公共看板 · 人人可加' },
    ],
  },
]

export default function Discover() {
  const nav = useNavigate()
  return (
    <div style={{ padding: '8px 16px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader eyebrow="Discover" title="发现" desc="社区、市场与 AI 工具，一站聚合。" />

      {GROUPS.map(g => (
        <div key={g.label} style={{ marginBottom: 22 }}>
          <SectionLabel label={g.label} />
          <SoftCard style={{ padding: 0 }}>
            {g.items.map((it, i) => (
              <ListRow
                key={it.to}
                onClick={() => nav(it.to)}
                style={{ padding: '13px 14px', borderBottom: i === g.items.length - 1 ? 'none' : `1px solid rgba(28,24,20,0.06)` }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 4,
                      border: '1px solid #e3d9c6',
                      background: '#fbeede',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: ACCENT,
                      flexShrink: 0,
                    }}
                  >
                    <it.icon size={17} strokeWidth={1.9} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: INK }}>{it.label}</span>
                    <span style={{ display: 'block', fontFamily: FONT, fontSize: 11.5, color: MUTED, marginTop: 2 }}>{it.desc}</span>
                  </span>
                </span>
                <ChevronRight size={16} color={FAINT} />
              </ListRow>
            ))}
          </SoftCard>
        </div>
      ))}

      <p style={{ textAlign: 'center', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 11, color: FAINT, marginTop: 8, letterSpacing: 1 }}>
        ZEXIAO · DISCOVER
      </p>
    </div>
  )
}
