import { useState } from 'react'
import { Gavel, Scale, CheckCircle2 } from 'lucide-react'
import { useStore } from '../../store/store'
import { PageHeader, StatusBadge, Empty } from './ui'

export default function Arbitration() {
  const arbitrations = useStore(s => s.arbitrations)
  const users = useStore(s => s.users)
  const adminDecide = useStore(s => s.adminDecide)
  const [openId, setOpenId] = useState<string | null>(null)
  const [result, setResult] = useState('')

  const decide = (arbId: string, winner: 'plaintiff' | 'defendant' | 'split') => {
    const text = result.trim() || (winner === 'defendant' ? '判定接单方完成交付，平台正常分账。'
      : winner === 'plaintiff' ? '判定雇主主张成立，任务关闭、冻结金额退还雇主。'
      : '双方各执一词，裁定金额五五平分。')
    adminDecide(arbId, winner, text)
    setOpenId(null)
    setResult('')
  }

  return (
    <div>
      <PageHeader title="订单与仲裁" desc="处理任务争议，终审判定资金归属（雇主 / 接单者 / 平分）" />

      {arbitrations.length === 0 && <Empty text="暂无仲裁案件" />}

      <div className="space-y-4">
        {arbitrations.map(a => {
          const task = useStore.getState().tasks.find(t => t.id === a.task_id)
          const amount = task?.amount || 0
          const open = openId === a.id
          return (
            <div key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-ink flex items-center gap-2">
                    <Gavel size={16} className="text-clay" /> {a.task_title}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">争议编号 {a.id} · 悬赏 ¥{amount}</div>
                </div>
                {a.status === 'open'
                  ? <StatusBadge text="待判定" tone="red" />
                  : <StatusBadge text="已终审" tone="green" />}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-xs text-gray-400">发起方（雇主）</div>
                  <div className="font-medium mt-0.5">{a.plaintiff_name}</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-xs text-gray-400">被诉方（接单者）</div>
                  <div className="font-medium mt-0.5">{a.defendant_name}</div>
                </div>
              </div>

              <div className="mt-3 text-sm">
                <div className="text-gray-500 text-xs mb-1">争议理由</div>
                <div className="text-ink">{a.reason}</div>
              </div>
              {a.evidence && (
                <div className="mt-2 text-sm">
                  <div className="text-gray-500 text-xs mb-1">证据</div>
                  <div className="text-ink">{a.evidence}</div>
                </div>
              )}

              {a.status === 'open' ? (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <textarea className="input h-20 resize-none" placeholder="填写终审说明（留空将使用默认裁定文案）" value={result} onChange={e => setResult(e.target.value)} />
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button className="btn-primary" onClick={() => decide(a.id, 'defendant')}><CheckCircle2 size={15} /> 判接单者胜（分账）</button>
                    <button className="btn-ghost" onClick={() => decide(a.id, 'plaintiff')}>判雇主胜（退款）</button>
                    <button className="btn-ghost" onClick={() => decide(a.id, 'split')}><Scale size={15} /> 平分</button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 bg-green-50 text-green-700 rounded-xl p-3 text-sm">
                  <div className="font-medium">终审结果</div>
                  <div className="mt-1">{a.result}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
