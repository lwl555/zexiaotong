import { useNavigate } from 'react-router-dom'
import { CheckCircle2, UserCheck, Clock, Scale, MessageCircle, Mail, Megaphone, CheckCheck, ChevronLeft } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'

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
    <div className="pb-10">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-100 sticky top-0 bg-white z-10">
        <button onClick={() => nav(-1)} className="text-gray-400"><ChevronLeft size={20} /></button>
        <h1 className="text-lg font-black text-ink flex-1">消息通知</h1>
        {unread.length > 0 && (
          <button onClick={readAll} className="text-xs text-brand-600 flex items-center gap-1"><CheckCheck size={14} /> 全部已读</button>
        )}
      </div>

      <div className="px-4 pt-3 space-y-2">
        {list.length === 0 && <div className="text-center text-gray-400 text-sm py-16">暂无通知</div>}
        {list.map(n => {
          const m = META[n.type] || META.announce
          const Icon = m.icon
          return (
            <button key={n.id} onClick={() => open(n)} className={'w-full flex gap-3 p-3 rounded-2xl text-left transition ' + (n.read ? 'bg-white' : 'bg-brand-50/60')}>
              <div className={'w-10 h-10 rounded-full flex items-center justify-center shrink-0 ' + m.color}><Icon size={18} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{m.label}</span>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                </div>
                <div className="text-sm font-medium text-ink truncate">{n.title}</div>
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.content}</div>
                <div className="text-[11px] text-gray-300 mt-1">{new Date(n.created_at).toLocaleString('zh-CN')}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
