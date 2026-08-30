import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import {
  PageHeader,
  HardCard,
  Tag,
  INK,
  MUTED,
  ACCENT,
  HAIR,
  FONT,
  MONO,
} from '../../components/Editorial'

const TABS = [
  { key: 'poster', label: '我发布的' },
  { key: 'worker', label: '我接的单' },
]
const STATUS_TEXT: any = { open: '待接单', accepted: '已接单·待交付', doing: '进行中', review: '待验收', done: '已完成', arbitration: '仲裁中', closed: '已关闭' }
const STATUS_TONE: any = {
  open: 'accent', accepted: 'ink', doing: 'ink', review: 'ink', done: 'line', arbitration: 'ink', closed: 'line',
}

export default function MyTasks() {
  const nav = useNavigate()
  const me = useMe()
  const tasks = useStore(s => s.tasks)
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'poster' | 'worker'>((params.get('role') as any) || 'poster')

  const list = tasks.filter(t => (tab === 'poster' ? t.poster_id === me.id : t.accepted_id === me.id))

  return (
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'inline-flex', padding: 4 }}>
          <ChevronLeft size={20} />
        </button>
        <h1 style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color: INK, margin: 0 }}>我的任务</h1>
      </div>

      {/* 标签切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            style={{ flex: 1, padding: '10px 0', borderRadius: 2, fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: `2px solid ${INK}`, background: tab === t.key ? ACCENT : PAPER, color: tab === t.key ? PAPER : INK }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '64px 0' }}>
          {tab === 'poster' ? '还没有发布任务' : '还没有接单'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {list.map(t => (
          <HardCard key={t.id} onClick={() => nav('/task/' + t.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: INK, lineHeight: 1.4 }}>{t.title}</div>
              <Tag tone={STATUS_TONE[t.status] || 'line'}>{STATUS_TEXT[t.status]}</Tag>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${HAIR}` }}>
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: MUTED }}>{t.category}</span>
              <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: ACCENT }}>¥{t.amount}</span>
            </div>
          </HardCard>
        ))}
      </div>
    </div>
  )
}
