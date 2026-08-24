import { useState } from 'react'
import { Pin, Search, EyeOff, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { useStore } from '../../store/store'
import { PageHeader, StatusBadge, confirmDanger } from './ui'
import type { TaskStatus } from '../../lib/types'

const TASK_TONE: any = {
  open: 'brand', accepted: 'blue', doing: 'amber', review: 'amber',
  done: 'green', arbitration: 'red', closed: 'gray'
}
const TASK_TEXT: any = {
  open: '待接单', accepted: '已接单', doing: '进行中', review: '待验收',
  done: '已完成', arbitration: '仲裁中', closed: '已关闭'
}
const STATUS_OPTIONS: TaskStatus[] = ['open', 'accepted', 'doing', 'review', 'done', 'arbitration', 'closed']

export default function TaskAudit() {
  const tasks = useStore(s => s.tasks)
  const setTaskStatus = useStore(s => s.setTaskStatus)
  const removeTask = useStore(s => s.removeTask)
  const topTask = useStore(s => s.topTask)
  const [kw, setKw] = useState('')
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  let list = tasks
  if (kw) list = tasks.filter(t => t.title.includes(kw) || t.poster_name.includes(kw))

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 2500)
  }

  const doTop = async (id: string) => {
    const r = await topTask(id, 3)
    showToast(r.ok ? 'ok' : 'err', r.msg)
  }

  return (
    <div>
      {/* Toast 通知 */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <PageHeader title="悬赏任务审核" desc="管理任务上下架、状态流转与置顶；违规任务可强制关闭">
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
          <Search size={16} className="text-gray-400" />
          <input className="bg-transparent outline-none text-sm w-40" placeholder="搜索任务 / 发布者" value={kw} onChange={e => setKw(e.target.value)} />
        </div>
      </PageHeader>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left font-medium px-4 py-3">任务</th>
              <th className="text-left font-medium px-4 py-3">发布者</th>
              <th className="text-right font-medium px-4 py-3">金额</th>
              <th className="text-center font-medium px-4 py-3">状态</th>
              <th className="text-center font-medium px-4 py-3">置顶</th>
              <th className="text-right font-medium px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map(t => (
              <tr key={t.id} className="border-t border-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink max-w-[240px] truncate">{t.title}</div>
                  <div className="text-xs text-gray-400">{t.category} · {t.id}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{t.poster_name}</td>
                <td className="px-4 py-3 text-right text-brand-600 font-bold">¥{t.amount}</td>
                <td className="px-4 py-3 text-center">
                  <select className="input !py-1 !px-2 text-xs w-24" value={t.status}
                    onChange={e => setTaskStatus(t.id, e.target.value as TaskStatus)}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{TASK_TEXT[s]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  {t.top_until && new Date(t.top_until) > new Date()
                    ? <StatusBadge text="置顶中" tone="clay" />
                    : <button className="text-clay text-xs font-medium" onClick={() => doTop(t.id)}><Pin size={13} className="inline" /> 置顶</button>}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {t.status !== 'closed'
                    ? <button className="text-red-500 text-xs font-medium mr-3" onClick={() => { if (confirmDanger('确认强制关闭该任务？将下架且不退款冻结金额。')) removeTask(t.id) }}><EyeOff size={13} className="inline" /> 下架</button>
                    : <span className="text-gray-300 text-xs">已下架</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-3 flex items-center gap-1"><Trash2 size={12} /> 强制下架仅作演示：本地将任务标记为「已关闭」，真实环境应联动解冻/退款流程。</p>
    </div>
  )
}
