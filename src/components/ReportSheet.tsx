import { useState } from 'react'
import { X, Flag } from 'lucide-react'
import { useStore } from '../store/store'
import { useMe } from '../store/useMe'
import { toast } from '../lib/toast'
import type { ReportTarget } from '../lib/types'
import { INK, MUTED, FAINT, ACCENT, ACCENT_SOFT, HAIR, FONT, MONO, BtnPrimary, hard } from './Editorial'

const REASONS = ['内容不实 / 造谣', '广告营销', '辱骂攻击', '涉及诈骗', '色情低俗', '侵权盗用', '其他']

/**
 * 举报弹层（底部抽屉）。
 *
 * 背景：此前「举报」是假按钮（onClick 只是 nav('/')），点了等于没点。
 * 现在走真实链路：写入 reports 表（db-write insert + owner 校验），管理员在后台可见并处理。
 */
export default function ReportSheet({
  open,
  onClose,
  targetType,
  targetId,
  targetTitle,
}: {
  open: boolean
  onClose: () => void
  targetType: ReportTarget
  targetId: string
  targetTitle?: string
}) {
  const me = useMe()
  const report = useStore((s) => s.report)
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (!open) return null

  const submit = async () => {
    if (!reason || busy) return
    setBusy(true)
    try {
      await report({ targetType, targetId, targetTitle, reason, detail })
      setDone(true)
      setTimeout(() => {
        setDone(false)
        setReason('')
        setDetail('')
        onClose()
      }, 1400)
    } catch (e: any) {
      toast(e?.message || '举报提交失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.42)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#ffffff', borderTop: `1px solid ${HAIR}`, borderRadius: '8px 8px 0 0', padding: '18px 18px 26px', width: '100%', maxWidth: 640, boxSizing: 'border-box', fontFamily: FONT }}
      >
        {done ? (
          <div style={{ padding: '28px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>已收到你的举报</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
              我们会尽快核实处理，感谢你帮忙维护社区环境。
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Flag size={16} color={ACCENT} />
                <span style={{ fontSize: 16, fontWeight: 800, color: INK }}>举报</span>
              </div>
              <button onClick={onClose} aria-label="关闭" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: MUTED, display: 'inline-flex' }}>
                <X size={18} />
              </button>
            </div>

            {targetTitle && (
              <div style={{ fontFamily: FONT, fontSize: 12, color: FAINT, marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                举报对象：{targetTitle}
              </div>
            )}

            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase', marginBottom: 8 }}>
              请选择原因
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {REASONS.map((r) => {
                const on = r === reason
                return (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    style={{
                      ...hard({ borderColor: on ? ACCENT : HAIR, background: on ? ACCENT_SOFT : '#ffffff', color: on ? ACCENT : INK, padding: '7px 12px', fontSize: 13, fontWeight: on ? 700 : 500 }),
                      cursor: 'pointer',
                      fontFamily: FONT,
                    }}
                  >
                    {r}
                  </button>
                )
              })}
            </div>

            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="补充说明（选填）"
              rows={3}
              maxLength={300}
              style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${HAIR}`, borderRadius: 3, padding: '10px 12px', fontFamily: FONT, fontSize: 14, color: INK, outline: 'none', resize: 'none', marginBottom: 14 }}
            />

            <BtnPrimary
              onClick={submit}
              disabled={!reason || busy || !me?.id}
              style={{ width: '100%', ...( !reason || busy || !me?.id ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
            >
              {busy ? '提交中…' : '提交举报'}
            </BtnPrimary>
            <div style={{ fontSize: 11, color: FAINT, marginTop: 10, textAlign: 'center', lineHeight: 1.6 }}>
              恶意举报可能会影响你的账号信用，请如实填写。
            </div>
          </>
        )}
      </div>
    </div>
  )
}
