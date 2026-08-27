import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pin, Clock, MessageSquare, Flag, Share2, ChevronRight, CheckCircle2, Scale } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'

const STATUS_TEXT: any = { open: '待接单', accepted: '已接单·待交付', doing: '进行中', review: '待验收', done: '已完成', arbitration: '仲裁中', closed: '已关闭' }
const STATUS_COLOR: any = { open: 'bg-brand-50 text-brand-700', accepted: 'bg-blue-50 text-blue-600', doing: 'bg-amber-50 text-amber-600', review: 'bg-purple-50 text-purple-600', done: 'bg-green-50 text-green-600', arbitration: 'bg-red-50 text-red-600', closed: 'bg-gray-100 text-gray-500' }

export default function TaskDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const task = useStore(s => s.tasks.find(t => t.id === id))
  const takeTask = useStore(s => s.takeTask)
  const deliverTask = useStore(s => s.deliverTask)
  const reviewPass = useStore(s => s.reviewPass)
  const reviewReject = useStore(s => s.reviewReject)
  const applyArbitration = useStore(s => s.applyArbitration)
  const [showDeliver, setShowDeliver] = useState(false)
  const [deliverText, setDeliverText] = useState('')

  if (!task) return <div className="p-10 text-center text-gray-400">任务不存在</div>

  const isPoster = task.poster_id === me.id
  const isWorker = task.accepted_id === me.id

  const renderAction = () => {
    if (task.status === 'open') {
      return isPoster
        ? <div className="text-sm text-gray-500">等待同学接单中…</div>
        : <button className="btn-primary w-full" onClick={() => takeTask(task.id)}>我要接单</button>
    }
    if (task.status === 'accepted') {
      return isPoster
        ? <div className="text-sm text-blue-600 flex items-center gap-1"><CheckCircle2 size={14} /> {task.accepted_name} 已接单，等待其交付成果</div>
        : <button className="btn-primary w-full" onClick={() => setShowDeliver(true)}>去交付成果</button>
    }
    if (task.status === 'doing') {
      return isWorker
        ? <button className="btn-primary w-full" onClick={() => setShowDeliver(true)}>上传成果并交付</button>
        : <div className="text-sm text-amber-600">进行中，等待对方交付</div>
    }
    if (task.status === 'review') {
      return isPoster
        ? <div className="space-y-2">
            <button className="btn-primary w-full" onClick={() => reviewPass(task.id)}>验收通过并付款</button>
            <button className="btn-ghost w-full" onClick={() => reviewReject(task.id)}>驳回，要求重做</button>
          </div>
        : <div className="text-sm text-purple-600">已交付，等待雇主验收</div>
    }
    if (task.status === 'arbitration') {
      return <div className="text-sm text-red-600 flex items-center gap-1"><Scale size={14} /> 仲裁处理中，等待管理员判定资金归属</div>
    }
    if (task.status === 'done') return <div className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={14} /> 任务已完成并结算</div>
    return <div className="text-sm text-gray-500">任务已关闭</div>
  }

  return (
    <div className="px-4 pt-3 pb-10">
      <button onClick={() => nav(-1)} className="text-gray-400 mb-2">‹ 返回</button>

      {task.images[0] && <img src={task.images[0]} className="w-full h-36 object-cover rounded-2xl mb-3" alt="" />}

      <div className="flex items-start justify-between gap-2">
        <h1 className="text-[18px] font-bold text-ink leading-snug">{task.title}</h1>
        {task.top_until && <span className="tag bg-clay/10 text-clay shrink-0"><Pin size={11} /> 置顶</span>}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span className="tag bg-brand-50 text-brand-700">{task.category}</span>
        <span className={'tag ' + STATUS_COLOR[task.status]}>{STATUS_TEXT[task.status]}</span>
        <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} /> {task.deadline ? new Date(task.deadline).toLocaleString('zh-CN') : ''}</span>
      </div>

      <div className="text-brand-600 font-black text-xl my-4">¥{task.amount}
        <span className="text-xs text-gray-400 font-normal ml-2">{(() => { const c = useStore.getState().config; return c ? `平台抽佣 ${Math.round(c.commission_rate * 100)}%` : '' })()}</span>
      </div>

      <div className="card p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{task.description}</div>

      <div className="flex items-center gap-3 mt-4 p-3 rounded-2xl bg-gray-50">
        <img src={task.poster_avatar} className="w-10 h-10 rounded-full" alt="" />
        <div className="flex-1">
          <div className="font-medium text-sm">{task.poster_name}</div>
          <div className="text-xs text-gray-400">发布者</div>
        </div>
        {task.accepted_id && <div className="text-right">
          <div className="font-medium text-sm">{task.accepted_name}</div>
          <div className="text-xs text-gray-400">接单者</div>
        </div>}
      </div>

      {/* 操作区 */}
      <div className="mt-5 p-4 rounded-2xl bg-white shadow-card border border-gray-100">
        {renderAction()}
        {!isPoster && task.status === 'review' && isWorker && (
          <button className="btn-ghost w-full mt-2" onClick={() => applyArbitration(task.id, '对验收结果有异议')}>申请仲裁</button>
        )}
      </div>

      {/* 底部功能 */}
      <div className="flex items-center justify-around mt-6 text-gray-400 text-sm">
        <button className="flex flex-col items-center gap-1" onClick={() => nav('/messages?peer=' + task.poster_id)}><MessageSquare size={18} /><span>联系发布者</span></button>
        <button className="flex flex-col items-center gap-1" onClick={() => nav('/messages?peer=' + task.accepted_id)}><MessageSquare size={18} /><span>联系接单者</span></button>
        <button className="flex flex-col items-center gap-1" onClick={() => nav('/')}><Share2 size={18} /><span>分享</span></button>
      </div>

      {showDeliver && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end" onClick={() => setShowDeliver(false)}>
          <div className="bg-white w-full rounded-t-2xl p-4" onClick={e => e.stopPropagation()}>
            <div className="font-black mb-2">交付成果说明</div>
            <textarea className="input h-24 resize-none" value={deliverText} onChange={e => setDeliverText(e.target.value)} placeholder="描述交付内容 / 上传链接…" />
            <button className="btn-primary w-full mt-3" onClick={() => { deliverTask(task.id, deliverText); setShowDeliver(false); setDeliverText('') }}>确认交付</button>
          </div>
        </div>
      )}
    </div>
  )
}
