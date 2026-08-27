import { useState } from 'react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import { CheckCircle, XCircle } from 'lucide-react'

const TXN_LABEL: any = { recharge: '充值', income: '任务收入', pay: '支付', withdraw: '提现', commission: '平台抽佣', refund: '退款', freeze: '冻结', unfreeze: '解冻' }
const TXN_COLOR: any = { recharge: 'text-green-600', income: 'text-green-600', withdraw: 'text-red-500', pay: 'text-red-500', freeze: 'text-gray-500', unfreeze: 'text-gray-500', commission: 'text-red-400', refund: 'text-green-600' }

export default function Wallet() {
  const me = useMe()
  const allTxns = useStore(s => s.txns)
  const txns = allTxns.filter(t => t.user_id === me.id)
  const recharge = useStore(s => s.recharge)
  const withdraw = useStore(s => s.withdraw)
  const [amt, setAmt] = useState('')
  const [mode, setMode] = useState<'in' | 'out'>('in')
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const usable = me.balance - me.frozen

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const doIt = async () => {
    const a = Number(amt)
    if (!a || a <= 0) { showToast('err', '请输入正确金额'); return }
    if (mode === 'in') {
      await recharge(a)
      showToast('ok', `充值 ¥${a.toFixed(2)} 成功`)
    } else {
      const r = await withdraw(a)
      if (r.ok) showToast('ok', '提现申请已提交，等待管理员审核')
      else showToast('err', r.msg)
    }
    setAmt('')
  }

  return (
    <div className="px-4 pt-3 pb-10">
      {/* Toast 通知 */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <h1 className="text-[18px] font-bold text-ink mb-4">我的钱包</h1>

      <div className="card p-5 bg-gradient-to-br from-brand-500 to-brand-700 text-white">
        <div className="text-sm opacity-80">账户余额</div>
        <div className="text-2xl font-black mt-1">¥{me.balance.toFixed(2)}</div>
        <div className="flex justify-between text-xs opacity-80 mt-4">
          <span>冻结 ¥{me.frozen.toFixed(2)}</span>
          <span>可用 ¥{usable.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button className={'flex-1 py-2.5 rounded-xl text-sm font-medium ' + (mode === 'in' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600')} onClick={() => setMode('in')}>充值</button>
        <button className={'flex-1 py-2.5 rounded-xl text-sm font-medium ' + (mode === 'out' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600')} onClick={() => setMode('out')}>提现</button>
      </div>
      <div className="flex gap-3 mt-3">
        <input className="input flex-1" value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.]/g, ''))} placeholder={mode === 'in' ? '充值金额' : '提现金额'} inputMode="decimal" />
        <button className="btn-primary w-24" onClick={doIt}>{mode === 'in' ? '充值' : '申请'}</button>
      </div>
      {mode === 'out' && <p className="text-xs text-gray-400 mt-2">提现由管理员审核后手动打款，审核期间不影响余额展示。</p>}

      <h2 className="font-bold text-ink mt-8 mb-2">资金流水</h2>
      <div className="space-y-2">
        {txns.length === 0 && <div className="text-center text-gray-400 text-sm py-8">暂无流水</div>}
        {txns.map(t => (
          <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50">
            <div>
              <div className="text-sm text-ink">{TXN_LABEL[t.type] || t.type}</div>
              <div className="text-xs text-gray-400">{t.remark} · {new Date(t.created_at).toLocaleString('zh-CN')}</div>
            </div>
            <div className={'font-bold ' + (TXN_COLOR[t.type] || 'text-ink')}>
              {t.amount > 0 ? '+' : ''}{t.amount.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
