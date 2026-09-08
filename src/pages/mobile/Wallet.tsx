import { useState } from 'react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import { CheckCircle, XCircle } from 'lucide-react'
import {
  PageHeader,
  ListRow,
  BtnPrimary,
  BtnGhost,
  SectionLabel,
  hard,
  INK,
  MUTED,
  ACCENT,
  HAIR,
  FONT,
  MONO,
  POS,
  NEG,
} from '../../components/Editorial'

const TXN_LABEL: any = {
  recharge: '充值',
  income: '任务收入',
  pay: '支付',
  withdraw: '提现',
  commission: '平台抽佣',
  refund: '退款',
  freeze: '冻结',
  unfreeze: '解冻',
}
const TXN_COLOR: any = {
  recharge: POS,
  income: POS,
  withdraw: NEG,
  pay: NEG,
  freeze: MUTED,
  unfreeze: MUTED,
  commission: NEG,
  refund: POS,
}

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
    <div style={{ padding: '8px 16px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT, position: 'relative' }}>
      {/* Toast：白底 + 硬边 */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 600,
            ...hard({ background: '#ffffff', color: toast.type === 'ok' ? ACCENT : INK }),
          }}
        >
          {toast.type === 'ok' ? <CheckCircle size={16} color={ACCENT} /> : <XCircle size={16} color={INK} />}
          {toast.msg}
        </div>
      )}

      <PageHeader eyebrow="Wallet" title="我的钱包" desc="余额、冻结与每一笔流水，清清楚楚。" />

      {/* 账户总览：单卡三行（替代原三块硬边卡竖堆，减重） */}
      <div style={{ ...hard(), background: '#ffffff', padding: 18, marginBottom: 18 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 2, color: MUTED }}>账户余额</div>
        <div style={{ fontFamily: FONT, fontSize: 34, fontWeight: 800, color: INK, marginTop: 6, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          ¥{me.balance.toFixed(2)}
        </div>
        <div style={{ display: 'flex', gap: 28, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${HAIR}` }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: MUTED }}>冻结</div>
            <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: INK, marginTop: 3 }}>¥{me.frozen.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: MUTED }}>可用</div>
            <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: ACCENT, marginTop: 3 }}>¥{usable.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* 操作区：粗黑边硬卡 */}
      <div style={{ ...hard(), background: '#ffffff', padding: 18, marginBottom: 24 }}>
        <SectionLabel label="操作" />
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <BtnPrimary onClick={() => setMode('in')} style={mode === 'in' ? {} : { background: '#ffffff', color: INK }}>
            充值
          </BtnPrimary>
          <BtnGhost
            onClick={() => setMode('out')}
            style={mode === 'out' ? { background: ACCENT, color: '#ffffff', borderColor: INK } : {}}
          >
            提现
          </BtnGhost>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={amt}
            onChange={e => setAmt(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder={mode === 'in' ? '充值金额' : '提现金额'}
            inputMode="decimal"
            style={{ flex: 1, border: `1px solid #e8e8e8`, borderRadius: 2, padding: '10px 12px', fontFamily: FONT, fontSize: 15, outline: 'none' }}
          />
          <BtnPrimary onClick={doIt}>{mode === 'in' ? '充值' : '申请'}</BtnPrimary>
        </div>
        {mode === 'out' && (
          <p style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 10, marginBottom: 0 }}>
            提现由管理员审核后手动打款，审核期间不影响余额展示。
          </p>
        )}
      </div>

      <SectionLabel label="资金流水" />
      <div>
        {txns.length === 0 && (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '40px 0' }}>暂无流水</div>
        )}
        {txns.map(t => (
          <ListRow key={t.id}>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>{TXN_LABEL[t.type] || t.type}</div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 2 }}>
                {t.remark} · {new Date(t.created_at).toLocaleString('zh-CN')}
              </div>
            </div>
            <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: TXN_COLOR[t.type] || INK }}>
              {t.amount > 0 ? '+' : ''}
              {t.amount.toFixed(2)}
            </div>
          </ListRow>
        ))}
      </div>
    </div>
  )
}
