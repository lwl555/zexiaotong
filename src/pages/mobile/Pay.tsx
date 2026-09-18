import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import { fetchRechargeOrder } from '../../lib/db'
import type { RechargeOrder } from '../../lib/types'
import { CheckCircle, XCircle, ShieldCheck } from 'lucide-react'
import {
  PageHeader,
  BtnPrimary,
  BtnGhost,
  SectionLabel,
  hard,
  INK,
  MUTED,
  ACCENT,
  ACCENT_SOFT,
  LINE,
  HAIR,
  FONT,
  MONO,
} from '../../components/Editorial'

// 收银台渠道（当前为演示环境的模拟支付，不接真实扣款）
const CHANNELS = [
  { key: 'wechat', label: '微信支付' },
  { key: 'alipay', label: '支付宝' },
]

export default function Pay() {
  const { orderId = '' } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const confirmRecharge = useStore(s => s.confirmRecharge)

  const [order, setOrder] = useState<RechargeOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState(CHANNELS[0].key)
  const [paying, setPaying] = useState(false)
  const [done, setDone] = useState<{ points: number } | null>(null)
  const [err, setErr] = useState('')

  // 刷新 / 直接打开链接时按 URL 里的订单号重新拉单（订单状态以服务端为准）
  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const o = await fetchRechargeOrder(orderId)
        if (!alive) return
        if (!o || o.user_id !== me.id) {
          setErr('订单不存在，或不属于当前账号')
          setOrder(null)
          return
        }
        setOrder(o)
        // 已经是已支付状态：直接进成功页（同一订单不会二次入账）
        if (o.status === 'paid') setDone({ points: o.points })
      } catch (e: any) {
        if (alive) setErr(e?.message || '订单加载失败，请返回钱包重试')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [orderId, me.id])

  const pay = async () => {
    if (paying || !order) return
    setPaying(true)
    setErr('')
    try {
      const r = await confirmRecharge(order.id)
      if (r.ok) setDone({ points: r.points })
      else setErr(r.msg)
    } catch (e: any) {
      setErr(e?.message || '支付失败，请重试')
    } finally {
      setPaying(false)
    }
  }

  const backToWallet = () => nav('/wallet')

  return (
    <div style={{ padding: '8px 16px 48px', maxWidth: 640, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader eyebrow="Checkout" title="收银台" desc="确认支付后积分到账；同一订单重复提交只会入账一次。" />

      {loading && (
        <div style={{ ...hard(), background: '#ffffff', padding: 24, textAlign: 'center', color: MUTED, fontSize: 14 }}>
          订单加载中…
        </div>
      )}

      {!loading && err && !done && (
        <div style={{ ...hard(), background: '#ffffff', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: INK, fontSize: 14, fontWeight: 600 }}>
            <XCircle size={16} color={ACCENT} /> {err}
          </div>
          <div style={{ marginTop: 14 }}>
            <BtnGhost onClick={backToWallet}>返回钱包</BtnGhost>
          </div>
        </div>
      )}

      {!loading && done && (
        <div style={{ ...hard(), background: '#ffffff', padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: ACCENT }}>
            <CheckCircle size={18} />
            <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 2 }}>PAYMENT CONFIRMED</span>
          </div>
          <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: INK, marginTop: 10 }}>
            支付已完成
          </div>
          <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, color: INK, marginTop: 6, letterSpacing: '-0.02em' }}>
            +{done.points.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 600, color: MUTED }}>积分</span>
          </div>
          <p style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 10, marginBottom: 0, lineHeight: 1.7 }}>
            积分已计入账户余额。若这是重复提交，系统只入账一次——这是设计如此，不是漏记。
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <BtnPrimary onClick={backToWallet}>返回钱包</BtnPrimary>
            <BtnGhost onClick={() => nav('/community')}>去社区逛逛</BtnGhost>
          </div>
        </div>
      )}

      {!loading && !done && order && (
        <>
          <div style={{ ...hard(), background: '#ffffff', padding: 20, marginBottom: 18 }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 2, color: MUTED }}>应付金额</div>
            <div style={{ fontFamily: FONT, fontSize: 40, fontWeight: 800, color: INK, marginTop: 4, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
              ¥{Number(order.amount_yuan).toFixed(2)}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginTop: 8 }}>
              到账 {order.points.toLocaleString()} 积分
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${HAIR}` }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: MUTED }}>订单号</div>
                <div style={{ fontFamily: MONO, fontSize: 12, color: INK, marginTop: 3 }}>{order.id.slice(0, 8)}</div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: MUTED }}>下单时间</div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: INK, marginTop: 3 }}>
                  {new Date(order.created_at).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>
          </div>

          <SectionLabel index="01" label="选择支付方式" />
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {CHANNELS.map(c => {
              const on = c.key === channel
              return (
                <button
                  key={c.key}
                  onClick={() => setChannel(c.key)}
                  style={{
                    flex: '1 1 0',
                    padding: '12px 8px',
                    border: `1px solid ${on ? ACCENT : LINE}`,
                    background: on ? ACCENT : '#ffffff',
                    color: on ? '#ffffff' : INK,
                    borderRadius: 2,
                    cursor: 'pointer',
                    fontFamily: FONT,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {c.label}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <BtnPrimary onClick={pay} disabled={paying}>
              {paying ? '支付处理中…' : `确认支付 ¥${Number(order.amount_yuan).toFixed(2)}`}
            </BtnPrimary>
            <BtnGhost onClick={backToWallet} disabled={paying}>取消</BtnGhost>
          </div>

          {err && (
            <div style={{ marginTop: 14, color: ACCENT, fontSize: 13, fontWeight: 600 }}>{err}</div>
          )}

          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 20,
              padding: '12px 14px',
              background: ACCENT_SOFT,
              border: `1px solid ${LINE}`,
              borderRadius: 2,
            }}
          >
            <ShieldCheck size={16} color={ACCENT} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontFamily: FONT, fontSize: 12, color: INK, lineHeight: 1.7 }}>
              当前为<strong>模拟收银台</strong>（演示环境，未接入真实支付渠道，不会产生实际扣款）。
              它的作用是让"充值"必须有一步明确的支付确认，订单号即入账凭据，重复提交不会重复到账。
            </span>
          </div>
        </>
      )}
    </div>
  )
}
