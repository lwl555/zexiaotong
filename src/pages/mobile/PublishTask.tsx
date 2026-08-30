import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImagePlus, X } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import { img } from '../../lib/img'
import {
  PageHeader,
  BtnPrimary,
  INK,
  MUTED,
  ACCENT,
  HAIR,
  FONT,
  MONO,
  PAPER,
  ACCENT_SOFT,
  btnGhost,
} from '../../components/Editorial'

const CATS = ['悬赏', '跑腿', '文档设计', '问卷']

export default function PublishTask() {
  const nav = useNavigate()
  const publish = useStore(s => s.publishTask)
  const me = useMe()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('悬赏')
  const [amount, setAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [desc, setDesc] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [err, setErr] = useState('')

  const usable = me.balance - me.frozen

  const addImg = () => setImages([...images, img('图片' + (images.length + 1), 400, 300)])
  const rmImg = (i: number) => setImages(images.filter((_, k) => k !== i))

  const submit = async () => {
    const amt = Number(amount)
    if (!title.trim()) { setErr('请填写任务标题'); return }
    if (!amt || amt <= 0) { setErr('请填写正确的悬赏金额'); return }
    if (!deadline) { setErr('请选择截止时间'); return }
    if (amt > usable) { setErr(`可用余额不足：需 ¥${amt}，当前可用 ¥${usable.toFixed(2)}`); return }
    const r = await publish({ title, category, amount: amt, deadline: new Date(deadline).toISOString(), description: desc, images })
    if (!r.ok) { setErr(r.msg); return }
    nav('/')
  }

  return (
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, color: MUTED, marginBottom: 8 }}>‹ 返回</button>

      <PageHeader
        eyebrow="Publish"
        title="发布悬赏任务"
        desc={(() => { const c = useStore.getState().config; return c ? `发布即冻结金额，任务完成自动解冻并分账（平台抽佣 ${Math.round(c.commission_rate * 100)}%）` : '发布即冻结金额，任务完成自动解冻并分账' })()}
      />

      {/* 任务标题 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase', marginBottom: 6 }}>任务标题</div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="例如：代取快递到宿舍楼下"
          style={{ width: '100%', boxSizing: 'border-box', border: `2px solid ${INK}`, borderRadius: 2, padding: '10px 12px', fontFamily: FONT, fontSize: 15, color: INK, outline: 'none' }}
        />
      </div>

      {/* 任务分类 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase', marginBottom: 6 }}>任务分类</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CATS.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{ ...btnGhost({ padding: '7px 14px', fontSize: 13 }), background: category === c ? ACCENT : PAPER, color: category === c ? PAPER : INK, borderColor: category === c ? INK : HAIR }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 金额 + 截止时间 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase', marginBottom: 6 }}>悬赏金额（元）</div>
          <input
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0.00"
            inputMode="decimal"
            style={{ width: '100%', boxSizing: 'border-box', border: `2px solid ${INK}`, borderRadius: 2, padding: '10px 12px', fontFamily: FONT, fontSize: 15, color: INK, outline: 'none' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase', marginBottom: 6 }}>截止时间</div>
          <input
            type="datetime-local"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', border: `2px solid ${INK}`, borderRadius: 2, padding: '10px 12px', fontFamily: FONT, fontSize: 15, color: INK, outline: 'none' }}
          />
        </div>
      </div>
      <div style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: -8, marginBottom: 16 }}>
        可用余额 ¥{usable.toFixed(2)}（冻结 ¥{me.frozen.toFixed(2)}）
      </div>

      {/* 需求描述 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase', marginBottom: 6 }}>需求描述</div>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="详细说明任务要求、交付标准…"
          style={{ width: '100%', boxSizing: 'border-box', height: 112, resize: 'none', border: `2px solid ${INK}`, borderRadius: 2, padding: '10px 12px', fontFamily: FONT, fontSize: 14, color: INK, outline: 'none' }}
        />
      </div>

      {/* 图片 / 附件 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase', marginBottom: 6 }}>图片 / 附件（{images.length}）</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {images.map((s, i) => (
            <div key={i} style={{ position: 'relative', width: 64, height: 64 }}>
              <img src={s} alt="" style={{ width: 64, height: 64, objectFit: 'cover', border: `2px solid ${INK}`, borderRadius: 2 }} />
              <button
                onClick={() => rmImg(i)}
                style={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, borderRadius: '50%', background: INK, color: PAPER, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            onClick={addImg}
            style={{ width: 64, height: 64, border: `2px dashed ${HAIR}`, borderRadius: 2, background: 'transparent', color: MUTED, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <ImagePlus size={20} /> <span style={{ fontFamily: FONT, fontSize: 11 }}>添加</span>
          </button>
        </div>
      </div>

      {err && (
        <div style={{ fontFamily: FONT, fontSize: 13, color: ACCENT, marginTop: 4, marginBottom: 16, padding: '10px 12px', border: `1.5px solid ${ACCENT}`, borderRadius: 2, background: ACCENT_SOFT }}>
          {err}
        </div>
      )}

      <BtnPrimary onClick={submit} style={{ width: '100%', marginTop: 8 }}>发布并冻结金额</BtnPrimary>
    </div>
  )
}
