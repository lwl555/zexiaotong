import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import { fetchWalletRules, type WalletRules } from '../../lib/db'
import { CheckCircle, XCircle } from 'lucide-react'
import {
  PageHeader,
  ListRow,
  BtnPrimary,
  BtnGhost,
  SectionLabel,
  Tag,
  hard,
  INK,
  MUTED,
  ACCENT,
  HAIR,
  LINE,
  FONT,
  MONO,
  POS,
  NEG,
} from '../../components/Editorial'

// 兜底规则：后端 wallet_rules 拉不到时才用（真实规则以服务端为准，前端不再自己定档位）
const DEFAULT_RULES: WalletRules = {
  rechargeTiers: [1, 6, 30, 98, 298],
  rechargeMaxYuan: 10000,
  withdrawMin: 1000,
  withdrawStep: 100,
  withdrawMaxPerTxn: 50000,
  withdrawMaxPerDay: 100000,
}

const CHANNELS = [
  { key: 'wechat', label: '微信' },
  { key: 'alipay', label: '支付宝' },
  { key: 'qq', label: 'QQ' },
]

/** 按中国时区取日期（单日提现额度按东八区自然日计算） */
const chinaDate = (iso?: string) => {
  const t = iso ? new Date(iso).getTime() : Date.now()
  return new Date(t + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

const WD_STATUS: Record<string, { label: string; tone: 'line' | 'accent' | 'ink' }> = {
  pending: { label: '待审核', tone: 'line' },
  approved: { label: '已打款', tone: 'accent' },
  rejected: { label: '已驳回', tone: 'ink' },
}

const TXN_LABEL: any = {
  recharge: '充值',
  income: '任务收入',
  pay: '支付',
  withdraw: '提现',
  commission: '平台抽佣',
  refund: '退款',
  freeze: '冻结',
  unfreeze: '解冻',
  adjust: '积分调整',
  checkin: '签到',
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
  adjust: ACCENT,
  checkin: ACCENT,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${LINE}`,
  borderRadius: 2,
  padding: '10px 12px',
  fontFamily: FONT,
  fontSize: 15,
  outline: 'none',
  background: '#ffffff',
  color: INK,
}

export default function Wallet() {
  const nav = useNavigate()
  const me = useMe()
  const allTxns = useStore(s => s.txns)
  const allWithdrawals = useStore(s => s.withdrawals)
  const createRechargeOrder = useStore(s => s.createRechargeOrder)
  const withdraw = useStore(s => s.withdraw)
  const refreshWithdrawals = useStore(s => s.refreshWithdrawals)
  const config = useStore(s => s.config)

  const [tier, setTier] = useState(DEFAULT_RULES.rechargeTiers[2])
  const [rules, setRules] = useState<WalletRules>(DEFAULT_RULES)
  const [wdAmt, setWdAmt] = useState('')
  const [channel, setChannel] = useState(CHANNELS[0].key)
  const [account, setAccount] = useState('')
  const [accountName, setAccountName] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  // 规则以后端为准（档位 / 门槛 / 单笔与单日上限）
  useEffect(() => {
    let alive = true
    fetchWalletRules()
      .then(r => {
        if (!alive) return
        setRules(r)
        setTier(prev => (r.rechargeTiers.includes(prev) ? prev : r.rechargeTiers[Math.min(2, r.rechargeTiers.length - 1)]))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const txns = allTxns.filter(t => t.user_id === me.id)
  const myWd = allWithdrawals.filter(w => w.user_id === me.id)
  const ppu = config?.points_per_yuan || 100
  const usable = Number(me.balance) - Number(me.frozen || 0)
  // 今日已占用的提现额度（待审 + 已打款；被驳回的不占额度）
  const todayUsed = myWd
    .filter(w => w.status !== 'rejected' && chinaDate(w.created_at) === chinaDate())
    .reduce((s, w) => s + Number(w.amount || 0), 0)
  const todayLeft = Math.max(0, rules.withdrawMaxPerDay - todayUsed)

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3200)
  }

  // 充值：先在下单接口拿到订单号，再跳到收银台页面确认支付。
  // 未确认支付不会到账；同一订单重复支付也只会入账一次（后端幂等）。
  const goPay = async () => {
    if (busy) return
    setBusy(true)
    try {
      const order = await createRechargeOrder(tier)
      nav(`/pay/${order.id}`)
    } catch (e: any) {
      showToast('err', e?.message || '创建订单失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const submitWd = async () => {
    if (busy) return
    const amount = Number(wdAmt)
    if (!amount || amount <= 0) { showToast('err', '请输入提现积分'); return }
    if (amount < rules.withdrawMin) { showToast('err', `最低提现 ${rules.withdrawMin} 积分`); return }
    if (amount % rules.withdrawStep !== 0) { showToast('err', `提现需为 ${rules.withdrawStep} 的整数倍`); return }
    if (amount > rules.withdrawMaxPerTxn) {
      showToast('err', `单笔提现不超过 ${rules.withdrawMaxPerTxn} 积分（= ¥${rules.withdrawMaxPerTxn / ppu}）`)
      return
    }
    if (todayUsed + amount > rules.withdrawMaxPerDay) {
      showToast('err', `今日已申请 ${todayUsed} 积分，单日上限 ${rules.withdrawMaxPerDay} 积分`)
      return
    }
    if (!account.trim()) { showToast('err', '请填写收款账号'); return }
    setBusy(true)
    try {
      const r = await withdraw({ amount, channel, account: account.trim(), accountName: accountName.trim() })
      if (r.ok) {
        showToast('ok', r.msg)
        setWdAmt('')
        setAccount('')
        setAccountName('')
      } else {
        showToast('err', r.msg)
      }
    } catch (e: any) {
      showToast('err', e?.message || '提交失败，请重试')
    } finally {
      setBusy(false)
    }
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

      {/* 账户总览 */}
      <div style={{ ...hard(), background: '#ffffff', padding: 18, marginBottom: 18 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 2, color: MUTED }}>账户积分</div>
        <div style={{ fontFamily: FONT, fontSize: 34, fontWeight: 800, color: INK, marginTop: 6, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {me.balance.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 600, color: MUTED }}>积分</span>
        </div>
        <div style={{ display: 'flex', gap: 28, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${HAIR}` }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: MUTED }}>冻结</div>
            <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: INK, marginTop: 3 }}>{Number(me.frozen || 0).toLocaleString()} 积分</div>
          </div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: MUTED }}>可用</div>
            <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: ACCENT, marginTop: 3 }}>{usable.toLocaleString()} 积分</div>
          </div>
        </div>
      </div>

      {/* 01 充值：选档位 → 去收银台 */}
      <SectionLabel index="01" label="充值积分" />
      <div style={{ ...hard(), background: '#ffffff', padding: 18, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {rules.rechargeTiers.map(t => {
            const on = t === tier
            return (
              <button
                key={t}
                onClick={() => setTier(t)}
                style={{
                  flex: '1 1 82px',
                  minWidth: 82,
                  padding: '11px 6px',
                  border: `1px solid ${on ? ACCENT : LINE}`,
                  background: on ? ACCENT : '#ffffff',
                  color: on ? '#ffffff' : INK,
                  borderRadius: 2,
                  cursor: 'pointer',
                  fontFamily: FONT,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>¥{t}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, marginTop: 3, color: on ? 'rgba(255,255,255,0.85)' : MUTED }}>
                  {t * ppu} 积分
                </div>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <BtnPrimary onClick={goPay} disabled={busy}>
            {busy ? '正在创建订单…' : `去支付 ¥${tier}`}
          </BtnPrimary>
          <span style={{ fontFamily: FONT, fontSize: 12, color: MUTED }}>
            下一步进入收银台确认支付；未支付的订单不会到账，重复支付也只会到账一次。
          </span>
        </div>
      </div>

      {/* 02 提现 */}
      <SectionLabel index="02" label="申请提现" />
      <div style={{ ...hard(), background: '#ffffff', padding: 18, marginBottom: 24 }}>
        <input
          value={wdAmt}
          onChange={e => setWdAmt(e.target.value.replace(/[^\d]/g, ''))}
          placeholder={`提现积分（最低 ${rules.withdrawMin}，须为 ${rules.withdrawStep} 的整数倍）`}
          inputMode="numeric"
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {CHANNELS.map(c => {
            const on = c.key === channel
            return (
              <button
                key={c.key}
                onClick={() => setChannel(c.key)}
                style={{
                  flex: '1 1 0',
                  padding: '9px 6px',
                  border: `1px solid ${on ? ACCENT : LINE}`,
                  background: on ? ACCENT : '#ffffff',
                  color: on ? '#ffffff' : INK,
                  borderRadius: 2,
                  cursor: 'pointer',
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <input
            value={account}
            onChange={e => setAccount(e.target.value)}
            placeholder="收款账号（微信号 / 支付宝账号 / QQ 号）"
            style={inputStyle}
          />
          <input
            value={accountName}
            onChange={e => setAccountName(e.target.value)}
            placeholder="收款人姓名（选填，便于核对）"
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <BtnPrimary onClick={submitWd} disabled={busy || !wdAmt}>
            {busy ? '提交中…' : '提交提现申请'}
          </BtnPrimary>
          <span style={{ fontFamily: FONT, fontSize: 12, color: MUTED }}>
            {ppu} 积分 = 1 元，本次可提 ≈ ¥{(Number(wdAmt || 0) / ppu).toFixed(2)}
          </span>
        </div>
        <p style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 12, marginBottom: 0, lineHeight: 1.7 }}>
          提交后对应积分会被<strong style={{ color: INK }}>冻结</strong>，管理员审核通过后打款并扣除；若被驳回，冻结的积分会自动退回可用。
          <br />
          限额：单笔 ≤ {rules.withdrawMaxPerTxn.toLocaleString()} 积分（= ¥{rules.withdrawMaxPerTxn / ppu}），
          单日 ≤ {rules.withdrawMaxPerDay.toLocaleString()} 积分（= ¥{rules.withdrawMaxPerDay / ppu}），
          今日剩余额度 {todayLeft.toLocaleString()} 积分。
        </p>
      </div>

      {/* 03 我的提现申请 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <SectionLabel index="03" label="我的提现申请" />
        <BtnGhost onClick={() => refreshWithdrawals()} style={{ fontSize: 12, padding: '5px 10px' }}>刷新</BtnGhost>
      </div>
      <div style={{ marginBottom: 24 }}>
        {myWd.length === 0 && (
          <div style={{ color: MUTED, fontSize: 13, padding: '18px 2px' }}>还没有提现申请</div>
        )}
        {myWd.map(w => {
          const st = WD_STATUS[w.status] || { label: w.status, tone: 'line' as const }
          return (
            <ListRow key={w.id}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: INK }}>
                    {w.amount.toLocaleString()} 积分
                  </span>
                  <Tag tone={st.tone}>{st.label}</Tag>
                </div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 3 }}>
                  ≈ ¥{(w.amount / ppu).toFixed(2)}
                  {w.channel ? ` · ${w.channel === 'wechat' ? '微信' : w.channel === 'alipay' ? '支付宝' : w.channel === 'qq' ? 'QQ' : w.channel} ${w.account || ''}` : ''}
                  {' · '}{new Date(w.created_at).toLocaleString('zh-CN')}
                </div>
                {w.status === 'rejected' && w.reason && (
                  <div style={{ fontFamily: FONT, fontSize: 12, color: ACCENT, marginTop: 3 }}>驳回原因：{w.reason}</div>
                )}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                #{w.id.slice(0, 6)}
              </div>
            </ListRow>
          )
        })}
      </div>

      {/* 04 资金流水 */}
      <SectionLabel index="04" label="资金流水" />
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
              {t.amount.toLocaleString()}
            </div>
          </ListRow>
        ))}
      </div>
    </div>
  )
}
