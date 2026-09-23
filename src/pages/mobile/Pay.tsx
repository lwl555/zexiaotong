import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'
import { uploadRechargeFile } from '../../lib/db'
import { CheckCircle, ShieldCheck, Upload } from 'lucide-react'
import {
  PageHeader,
  BtnPrimary,
  BtnGhost,
  SectionLabel,
  ListRow,
  Tag,
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

const RC_STATUS: Record<string, { label: string; tone: 'line' | 'accent' | 'ink' }> = {
  pending: { label: '待审核', tone: 'line' },
  approved: { label: '已到账', tone: 'accent' },
  rejected: { label: '已驳回', tone: 'ink' },
  paid: { label: '已支付', tone: 'accent' },
  cancelled: { label: '已取消', tone: 'ink' },
  expired: { label: '已过期', tone: 'ink' },
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

export default function Pay() {
  const nav = useNavigate()
  const config = useStore(s => s.config)
  const rechargeOrders = useStore(s => s.rechargeOrders)
  const submitRecharge = useStore(s => s.submitRecharge)
  const fetchMyRechargeOrders = useStore(s => s.fetchMyRechargeOrders)

  const [amount, setAmount] = useState('')
  const [alipayName, setAlipayName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const ppu = config?.points_per_yuan || 100
  const qrUrl = config?.alipay_qr_url || ''

  useEffect(() => {
    fetchMyRechargeOrders()
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const submit = async () => {
    setErr('')
    const yuan = Number(amount)
    if (!Number.isFinite(yuan) || yuan <= 0) { setErr('请输入充值金额（元）'); return }
    if (!alipayName.trim()) { setErr('请填写支付宝姓名（便于核对）'); return }
    if (!file) { setErr('请上传支付截图'); return }
    setBusy(true)
    try {
      const url = await uploadRechargeFile(file, 'recharge-proofs')
      const r = await submitRecharge({ amountYuan: yuan, alipayName: alipayName.trim(), proofUrl: url })
      if (r.ok) {
        setDone(true)
        setAmount('')
        setAlipayName('')
        setFile(null)
        setPreview('')
      } else {
        setErr(r.msg)
      }
    } catch (e: any) {
      setErr(e?.message || '提交失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const backToWallet = () => nav('/wallet')

  return (
    <div style={{ padding: '8px 16px 48px', maxWidth: 640, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader eyebrow="Recharge" title="充值积分" desc="仅支持支付宝：扫码转账后上传截图，审核通过后积分到账。" />

      {!qrUrl && (
        <div style={{ ...hard(), background: ACCENT_SOFT, border: `1px solid ${LINE}`, padding: 16, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: INK, fontSize: 14, fontWeight: 600 }}>
            <ShieldCheck size={16} color={ACCENT} /> 暂未开放充值
          </div>
          <p style={{ fontFamily: FONT, fontSize: 13, color: MUTED, margin: '8px 0 0', lineHeight: 1.7 }}>
            管理员尚未配置支付宝收款码，暂时无法充值。请稍后再来，或联系平台管理员。
          </p>
        </div>
      )}

      {qrUrl && !done && (
        <>
          {/* 收款码 */}
          <SectionLabel index="01" label="扫码转账" />
          <div style={{ ...hard(), background: '#ffffff', padding: 18, marginBottom: 18, textAlign: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 2, color: MUTED, textAlign: 'left' }}>支付宝收款码</div>
            <img
              src={qrUrl}
              alt="支付宝收款码"
              style={{ width: 220, height: 220, objectFit: 'contain', margin: '12px auto', border: `1px solid ${HAIR}`, borderRadius: 2 }}
            />
            {config?.alipay_account && (
              <div style={{ fontFamily: FONT, fontSize: 13, color: INK, marginTop: 4 }}>
                收款账号：<strong>{config.alipay_account}</strong>
              </div>
            )}
            <p style={{ fontFamily: FONT, fontSize: 12, color: MUTED, margin: '10px 0 0', lineHeight: 1.7, textAlign: 'left' }}>
              请用支付宝<strong style={{ color: INK }}>扫描上方二维码</strong>，按你实际想充的金额转账；转账完成后<strong style={{ color: INK }}>截屏保存</strong>，在下方上传。
            </p>
          </div>

          {/* 提交申请 */}
          <SectionLabel index="02" label="提交充值申请" />
          <div style={{ ...hard(), background: '#ffffff', padding: 18, marginBottom: 18 }}>
            <label style={{ fontFamily: FONT, fontSize: 13, color: MUTED }}>充值金额（元）</label>
            <input
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="实际转账金额，如 30 或 6.6"
              inputMode="decimal"
              style={{ ...inputStyle, marginTop: 8 }}
            />
            <div style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 6 }}>
              预计到账 {amount ? Math.round(Number(amount) * ppu).toLocaleString() : 0} 积分（{ppu} 积分 = 1 元）
            </div>

            <label style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginTop: 14, display: 'block' }}>支付宝姓名</label>
            <input
              value={alipayName}
              onChange={e => setAlipayName(e.target.value)}
              placeholder="转账的支付宝实名（便于核对）"
              style={{ ...inputStyle, marginTop: 8 }}
            />

            <label style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginTop: 14, display: 'block' }}>支付截图</label>
            <div style={{ marginTop: 8 }}>
              <label
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  border: `1px dashed ${file ? ACCENT : LINE}`, borderRadius: 2, padding: '14px',
                  color: file ? ACCENT : MUTED, cursor: 'pointer', fontFamily: FONT, fontSize: 14, background: '#fff'
                }}
              >
                <Upload size={16} /> {file ? '重新选择截图' : '点击上传支付截图'}
                <input type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: 'none' }} />
              </label>
              {preview && (
                <img src={preview} alt="支付截图预览" style={{ width: '100%', marginTop: 10, borderRadius: 2, border: `1px solid ${HAIR}` }} />
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              <BtnPrimary onClick={submit} disabled={busy}>
                {busy ? '提交中…' : '提交申请'}
              </BtnPrimary>
              <BtnGhost onClick={backToWallet} disabled={busy}>返回钱包</BtnGhost>
            </div>

            {err && <div style={{ marginTop: 12, color: ACCENT, fontSize: 13, fontWeight: 600 }}>{err}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 16, padding: '12px 14px', background: ACCENT_SOFT, border: `1px solid ${LINE}`, borderRadius: 2 }}>
              <ShieldCheck size={16} color={ACCENT} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontFamily: FONT, fontSize: 12, color: INK, lineHeight: 1.7 }}>
                提交后进入<strong>人工审核</strong>：管理员核对截图与金额无误才会把积分打入你的账户，审核通过前不会到账。
              </span>
            </div>
          </div>
        </>
      )}

      {done && (
        <div style={{ ...hard(), background: '#ffffff', padding: 22, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: ACCENT }}>
            <CheckCircle size={18} />
            <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 2 }}>SUBMITTED</span>
          </div>
          <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: INK, marginTop: 10 }}>
            申请已提交，等待审核
          </div>
          <p style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 10, marginBottom: 0, lineHeight: 1.7 }}>
            管理员审核通过后，积分会自动计入你的余额。你可以在「我的钱包 → 我的充值申请」中查看进度。
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <BtnPrimary onClick={backToWallet}>返回钱包</BtnPrimary>
            <BtnGhost onClick={() => { setDone(false); fetchMyRechargeOrders() }}>再充一笔</BtnGhost>
          </div>
        </div>
      )}

      {/* 我的充值记录 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <SectionLabel index="03" label="我的充值记录" />
        <BtnGhost onClick={() => fetchMyRechargeOrders()} style={{ fontSize: 12, padding: '5px 10px' }}>刷新</BtnGhost>
      </div>
      <div style={{ marginBottom: 12 }}>
        {rechargeOrders.length === 0 && (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '24px 0' }}>暂无充值记录</div>
        )}
        {rechargeOrders.map(o => {
          const st = RC_STATUS[o.status] || { label: o.status, tone: 'line' as const }
          return (
            <ListRow key={o.id}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: INK }}>
                    充值 ¥{Number(o.amount_yuan).toFixed(2)}
                  </span>
                  <Tag tone={st.tone}>{st.label}</Tag>
                </div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 3 }}>
                  得 {o.points.toLocaleString()} 积分{o.alipay_name ? ` · 支付宝 ${o.alipay_name}` : ''}
                  {' · '}{new Date(o.created_at).toLocaleString('zh-CN')}
                </div>
                {o.status === 'rejected' && o.reject_reason && (
                  <div style={{ fontFamily: FONT, fontSize: 12, color: ACCENT, marginTop: 3 }}>驳回原因：{o.reject_reason}</div>
                )}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                #{o.id.slice(0, 6)}
              </div>
            </ListRow>
          )
        })}
      </div>
    </div>
  )
}
