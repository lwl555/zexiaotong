import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImagePlus, X, CheckCircle, XCircle } from 'lucide-react'
import { useStore } from '../../store/store'
import { img } from '../../lib/img'
import {
  PageHeader,
  SectionLabel,
  BtnPrimary,
  BtnGhost,
  hard,
  INK,
  MUTED,
  ACCENT,
  FONT,
  MONO,
} from '../../components/Editorial'

function fileToDataUrl(file: File): Promise<string> {
  return new Promise(res => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.readAsDataURL(file)
  })
}

export default function PublishGoods() {
  const nav = useNavigate()
  const categories = useStore(s => s.categories)
  const cats = categories.filter(c => c.kind === 'goods')
  const publishGoods = useStore(s => s.publishGoods)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState(cats[0]?.name || '数码')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 2500)
  }

  const onPick = async (e: any) => {
    const files: File[] = Array.from(e.target.files || [])
    let count = images.length
    for (const f of files) {
      if (count >= 6) break
      const url = await fileToDataUrl(f)
      count++
      setImages(prev => [...prev, url])
    }
  }

  const submit = () => {
    if (!title.trim()) { showToast('err', '请填写商品名称'); return }
    if (!Number(price) || Number(price) <= 0) { showToast('err', '请填写有效价格'); return }
    publishGoods({ title: title.trim(), price: Number(price), category, description: description.trim(), images: images.length ? images : [img('二手商品', 400, 300)] })
    showToast('ok', '发布成功，等待审核上架')
    setTimeout(() => nav('/goods'), 800)
  }

  return (
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT, position: 'relative' }}>
      {/* Toast：白底 + 硬边 + ACCENT 文字 */}
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

      <PageHeader
        eyebrow="Publish"
        title="发布二手商品"
        desc="如实描述成色与转手原因，上架更快。"
        right={
          <BtnGhost onClick={() => nav(-1)}>‹ 返回</BtnGhost>
        }
      />

      <div style={{ ...hard(), background: '#ffffff', padding: 18 }}>
        {/* 商品名称 */}
        <SectionLabel label="商品名称" />
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="例如：九成新 iPad Air"
          style={{ width: '100%', border: `2px solid ${INK}`, borderRadius: 2, padding: '10px 12px', fontFamily: FONT, fontSize: 15, outline: 'none', marginBottom: 18 }}
        />

        {/* 价格 + 分类 */}
        <SectionLabel label="价格 / 分类" />
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <input
              value={price}
              onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="0"
              inputMode="decimal"
              style={{ width: '100%', border: `2px solid ${INK}`, borderRadius: 2, padding: '10px 12px', fontFamily: FONT, fontSize: 15, outline: 'none' }}
            />
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: MUTED, marginTop: 5, textTransform: 'uppercase' }}>元</div>
          </div>
          <div style={{ flex: 1 }}>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ width: '100%', border: `2px solid ${INK}`, borderRadius: 2, padding: '10px 12px', fontFamily: FONT, fontSize: 15, outline: 'none', background: '#ffffff', color: INK }}
            >
              {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: MUTED, marginTop: 5, textTransform: 'uppercase' }}>分类</div>
          </div>
        </div>

        {/* 商品描述 */}
        <SectionLabel label="商品描述" />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="成色、购买渠道、转手原因…"
          style={{ width: '100%', height: 96, border: `2px solid ${INK}`, borderRadius: 2, padding: '10px 12px', fontFamily: FONT, fontSize: 15, outline: 'none', resize: 'none', marginBottom: 18 }}
        />

        {/* 商品图片 */}
        <SectionLabel label="商品图片 (最多 6 张)" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {images.map((src, i) => (
            <div key={i} style={{ position: 'relative', width: 64, height: 64, border: `2px solid ${INK}`, borderRadius: 2, overflow: 'hidden', background: '#efefef' }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={() => setImages(images.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: INK, color: '#ffffff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {images.length < 6 && (
            <label style={{ width: 64, height: 64, border: `2px dashed ${INK}`, borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: MUTED, cursor: 'pointer' }}>
              <ImagePlus size={20} />
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, marginTop: 2 }}>添加</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onPick} multiple />
            </label>
          )}
        </div>

        <BtnPrimary onClick={submit} style={{ width: '100%', justifyContent: 'center' }}>
          发布商品
        </BtnPrimary>
      </div>
    </div>
  )
}
