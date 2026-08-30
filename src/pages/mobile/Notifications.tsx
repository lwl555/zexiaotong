import { useNavigate } from 'react-router-dom'
import { CheckCircle2, UserCheck, Clock, Scale, MessageCircle, Mail, Megaphone, CheckCheck, ChevronLeft } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import {
  PageHeader,
  ListRow,
  BtnGhost,
  Tag,
  INK,
  MUTED,
  FAINT,
  ACCENT,
  FONT,
  MONO,
} from '../../components/Editorial'

const META: any = {
  task_status: { icon: CheckCircle2, color: 'text-green-600 bg-green-50', label: '任务状态' },
  task_taken: { icon: UserCheck, color: 'text-blue-600 bg-blue-50', label: '接单通知' },
  task_review: { icon: Clock, color: 'text-purple-600 bg-purple-50', label: '待验收' },
  arbitration: { icon: Scale, color: 'text-red-600 bg-red-50', label: '仲裁' },
  comment: { icon: MessageCircle, color: 'text-amber-600 bg-amber-50', label: '评论' },
  message: { icon: Mail, color: 'text-brand-600 bg-brand-50', label: '私信' },
  announce: { icon: Megaphone, color: 'text-clay bg-orange-50', label: '公告' }
}

export default function Notifications() {
  const nav = useNavigate()
  const me = useMe()
  const notifications = useStore(s => s.notifications)
  const list = notifications.filter(n => n.user_id === me.id)
  const markRead = useStore(s => s.markRead)
  const unread = list.filter(n => !n.read)

  const readAll = () => unread.forEach(n => markRead(n.id))
  const open = (n: any) => {
    markRead(n.id)
    if (n.type === 'message') nav('/messages')
    else if (n.type === 'task_status' || n.type === 'task_taken' || n.type === 'task_review' || n.type === 'arbitration') nav('/my-tasks')
    else if (n.type === 'comment') nav('/community')
    else nav('/')
  }

  return (
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader
        eyebrow="Notifications"
        title="消息通知"
        desc="任务、评论、私信与平台公告，一处看全。"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'inline-flex' }}>
              <ChevronLeft size={20} />
            </button>
            {unread.length > 0 && (
              <BtnGhost onClick={readAll} style={{ padding: '7px 12px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <CheckCheck size={14} /> 全部已读
                </span>
              </BtnGhost>
            )}
          </div>
        }
      />

      {list.length === 0 && (
        <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '64px 0' }}>暂无通知</div>
      )}

      <div>
        {list.map(n => {
          const m = META[n.type] || META.announce
          const Icon = m.icon
          return (
            <ListRow key={n.id} style={{ cursor: 'pointer', alignItems: 'flex-start', padding: '16px 2px' }} onClick={() => open(n)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: `2px solid ${INK}`,
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} color={INK} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Tag tone="accent">{m.label}</Tag>
                    {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT, flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.title}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{n.content}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: FAINT, marginTop: 6, letterSpacing: 0.5 }}>
                    {new Date(n.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            </ListRow>
          )
        })}
      </div>
    </div>
  )
}
