import { useState } from 'react'
import { CheckCircle2, XCircle, Banknote } from 'lucide-react'
import { useStore } from '../../store/store'
import { PageHeader, StatusBadge, Empty, confirmDanger } from './ui'

export default function Withdraw() {
  const withdrawals = useStore(s => s.withdrawals)
  const approveWithdrawal = useStore(s => s.approveWithdrawal)
  const rejectWithdrawal = useStore(s => s.rejectWithdrawal)
  const [reason, setReason] = useState('')
  const [target, setTarget] = useState<string | null>(null)

  const total = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0)

  return (
    <div>
      <PageHeader title="提现审核" desc="审核用户提现申请，确认打款或驳回">
        <div className="text-sm text-gray-500">待处理合计 <b className="text-clay text-lg">¥{total.toFixed(2)}</b></div>
      </PageHeader>

      {withdrawals.length === 0 && <Empty text="暂无提现申请" />}

      <div className="space-y-3">
        {withdrawals.map(w => (
          <div key={w.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600"><Banknote size={18} /></div>
                <div>
                  <div className="font-medium text-ink">{w.user_name}</div>
                  <div className="text-xs text-gray-400">申请编号 {w.id} · {new Date(w.created_at).toLocaleString('zh-CN')}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-clay">¥{w.amount.toFixed(2)}</div>
                {w.status === 'pending' ? <StatusBadge text="待审核" tone="amber" />
                  : w.status === 'approved' ? <StatusBadge text="已打款" tone="green" />
                  : <StatusBadge text="已驳回" tone="red" />}
              </div>
            </div>

            {w.status === 'pending' ? (
              <div className="mt-3 border-t border-gray-100 pt-3">
                {target === w.id && (
                  <div className="mb-2">
                    <input className="input" placeholder="驳回原因（选填）" value={reason} onChange={e => setReason(e.target.value)} />
                  </div>
                )}
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => { if (confirmDanger('确认已打款？将从用户余额扣除并标记为已打款。')) approveWithdrawal(w.id) }}><CheckCircle2 size={15} /> 确认打款</button>
                  <button className="btn-ghost" onClick={() => setTarget(target === w.id ? null : w.id)}><XCircle size={15} /> {target === w.id ? '取消驳回' : '驳回'}</button>
                  {target === w.id && (
                    <button className="btn-ghost text-red-500" onClick={() => { rejectWithdrawal(w.id, reason); setTarget(null); setReason('') }}>确认驳回</button>
                  )}
                </div>
              </div>
            ) : w.status === 'rejected' ? (
              <div className="mt-2 text-sm text-red-500">驳回原因：{w.reason || '（未填写）'}</div>
            ) : (
              <div className="mt-2 text-sm text-green-600">已于 {w.handled_at ? new Date(w.handled_at).toLocaleString('zh-CN') : '-'} 打款</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
