import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Wallet, Loader2 } from 'lucide-react'
import { useMe } from '../../store/useMe'
import { fetchRechargeReviews, reviewRecharge } from '../../lib/db'
import { PageHeader, StatusBadge, Empty, confirmDanger } from './ui'

export default function RechargeReview() {
  const me = useMe()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [target, setTarget] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    if (!me) return
    setLoading(true)
    fetchRechargeReviews(me.id)
      .then(d => setOrders(d))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [me])

  const pendingTotal = orders.filter(o => o.status === 'pending').reduce((s, o) => s + Number(o.points || 0), 0)

  const approve = async (id: string) => {
    if (!me || busy) return
    if (!confirmDanger('确认已核对截图与金额无误？审核通过将给用户打入积分。')) return
    setBusy(true)
    try {
      const r = await reviewRecharge(me.id, id, 'approve')
      if (r.ok) load()
      else alert(r.decision || '操作失败')
    } catch (e: any) { alert(e?.message || '操作失败') }
    finally { setBusy(false) }
  }

  const reject = async (id: string) => {
    if (!me || busy) return
    setBusy(true)
    try {
      const r = await reviewRecharge(me.id, id, 'reject', reason)
      if (r.ok) { setTarget(null); setReason(''); load() }
      else alert(r.decision || '操作失败')
    } catch (e: any) { alert(e?.message || '操作失败') }
    finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader title="充值审核" desc="核对用户支付宝转账截图与金额，审核通过才打入积分">
        <div className="text-sm text-gray-500">待审核合计 <b className="text-clay text-lg">{pendingTotal.toLocaleString()} 积分</b></div>
      </PageHeader>

      {loading && <div className="card p-10 flex items-center justify-center text-gray-400"><Loader2 size={24} className="animate-spin" /></div>}
      {!loading && orders.length === 0 && <Empty text="暂无充值申请" />}

      <div className="space-y-3">
        {orders.map(o => {
          const user = o.profiles || {}
          const userName = user.nickname || user.phone || '(未知用户)'
          return (
            <div key={o.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600"><Wallet size={18} /></div>
                  <div>
                    <div className="font-medium text-ink">{userName}</div>
                    <div className="text-xs text-gray-400">申请编号 {o.id} · {new Date(o.created_at).toLocaleString('zh-CN')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-clay">¥{Number(o.amount_yuan).toFixed(2)}</div>
                  <div className="text-xs text-gray-400">{Number(o.points).toLocaleString()} 积分</div>
                </div>
              </div>

              <div className="mt-2 text-sm text-gray-600">
                支付宝姓名：<strong className="text-ink">{o.alipay_name || '—'}</strong>
              </div>

              {/* 支付截图 */}
              {o.proof_url ? (
                <a href={o.proof_url} target="_blank" rel="noreferrer" className="mt-3 block">
                  <img src={o.proof_url} alt="支付截图" className="max-h-56 rounded border border-gray-200 object-contain" />
                </a>
              ) : (
                <div className="mt-3 text-xs text-red-500">未上传支付截图</div>
              )}

              {o.status === 'pending' ? (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  {target === o.id && (
                    <div className="mb-2">
                      <input className="input" placeholder="驳回原因（选填）" value={reason} onChange={e => setReason(e.target.value)} />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button className="btn-primary" disabled={busy} onClick={() => approve(o.id)}><CheckCircle2 size={15} /> 审核通过</button>
                    <button className="btn-ghost" disabled={busy} onClick={() => setTarget(target === o.id ? null : o.id)}><XCircle size={15} /> {target === o.id ? '取消驳回' : '驳回'}</button>
                    {target === o.id && (
                      <button className="btn-ghost text-red-500" disabled={busy} onClick={() => reject(o.id)}>确认驳回</button>
                    )}
                  </div>
                </div>
              ) : o.status === 'approved' ? (
                <div className="mt-2 text-sm text-green-600">已于 {o.reviewed_at ? new Date(o.reviewed_at).toLocaleString('zh-CN') : '-'} 审核通过，积分已到账</div>
              ) : o.status === 'rejected' ? (
                <div className="mt-2 text-sm text-red-500">已驳回{o.reject_reason ? `：${o.reject_reason}` : ''}</div>
              ) : (
                <div className="mt-2 text-sm text-gray-500">状态：{o.status}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
