import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'

const TABS = [
  { key: 'poster', label: '我发布的' },
  { key: 'worker', label: '我接的单' }
]
const STATUS_TEXT: any = { open: '待接单', accepted: '已接单·待交付', doing: '进行中', review: '待验收', done: '已完成', arbitration: '仲裁中', closed: '已关闭' }
const STATUS_TONE: any = {
  open: 'bg-brand-50 text-brand-700', accepted: 'bg-blue-50 text-blue-600', doing: 'bg-amber-50 text-amber-600',
  review: 'bg-purple-50 text-purple-600', done: 'bg-green-50 text-green-600', arbitration: 'bg-red-50 text-red-600', closed: 'bg-gray-100 text-gray-500'
}

export default function MyTasks() {
  const nav = useNavigate()
  const me = useMe()
  const tasks = useStore(s => s.tasks)
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'poster' | 'worker'>((params.get('role') as any) || 'poster')

  const list = tasks.filter(t => tab === 'poster' ? t.poster_id === me.id : t.accepted_id === me.id)

  return (
    <div className="px-4 pt-3 pb-10">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => nav(-1)} className="text-gray-400"><ChevronLeft size={20} /></button>
        <h1 className="text-lg font-black text-ink">我的任务</h1>
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={'flex-1 py-2.5 rounded-xl text-sm font-medium ' + (tab === t.key ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600')}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.length === 0 && <div className="text-center text-gray-400 text-sm py-16">{tab === 'poster' ? '还没有发布任务' : '还没有接单'}</div>}
        {list.map(t => (
          <div key={t.id} onClick={() => nav('/task/' + t.id)} className="card p-3 active:scale-[.99] transition">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium leading-snug">{t.title}</div>
              <span className={'tag shrink-0 ' + STATUS_TONE[t.status]}>{STATUS_TEXT[t.status]}</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
              <span>{t.category}</span>
              <span className="text-brand-600 font-black">¥{t.amount}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
