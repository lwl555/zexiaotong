import { useState } from 'react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'

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
  const usable = me.balance - me.frozen

  const doIt = () => {
    const a = Number(amt)
    if (!a || a <= 0) { alert('请输入正确金额'); return }
    if (mode === 'in') recharge(a)
    else { const r = withdraw(a); alert(r.msg); if (!r.ok) return }
    setAmt('')
  }

  return (
    <div className="px-4 pt-3 pb-10">
      <h1 className="text-xl font-black text-ink mb-4">我的钱包</h1>

      <div className="card p-5 bg-gradient-to-br from-brand-500 to-brand-700 text-white">
        <div className="text-sm opacity-80">账户余额</div>
        <div className="text-3xl font-black mt-1">¥{me.balance.toFixed(2)}</div>
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
