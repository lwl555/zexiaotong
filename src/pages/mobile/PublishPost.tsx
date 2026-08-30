import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImagePlus, X, CheckCircle, XCircle } from 'lucide-react'
import { useStore } from '../../store/store'
import { img } from '../../lib/img'
import {
  PageHeader,
  BtnPrimary,
  BtnGhost,
  SectionLabel,
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

export default function PublishPost() {
  const nav = useNavigate()
  const publishPost = useStore(s => s.publishPost)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
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
      if (count >= 9) break
      const url = await fileToDataUrl(f)
      count++
      setImages(prev => [...prev, url])
    }
  }

  const submit = () => {
    if (!title.trim()) { showToast('err', '请填写标题'); return }
    if (!content.trim()) { showToast('err', '请填写内容'); return }
    publishPost({ title: title.trim(), content: content.trim(), images: images.length ? images : [img('图文帖', 400, 240, '#a855f7')] })
    showToast('ok', '发布成功')
    setTimeout(() => nav('/community'), 800)
  }

  return (
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT, position: 'relative' }}>
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

      <PageHeader
        eyebrow="Publish"
        title="发布帖子"
        desc="分享你的想法、求助、吐槽，让更多护考前辈看到。"
        right={<BtnGhost onClick={() => nav(-1)}>‹ 返回</BtnGhost>}
      />

      <SectionLabel label="标题" />
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="一句话说清你想聊的"
        style={{ width: '100%', border: `2px solid ${INK}`, borderRadius: 2, padding: '11px 12px', fontFamily: FONT, fontSize: 15, outline: 'none', marginBottom: 18, boxSizing: 'border-box' }}
      />

      <SectionLabel label="正文" />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="分享你的想法、求助、吐槽…"
        style={{ width: '100%', height: 160, resize: 'none', border: `2px solid ${INK}`, borderRadius: 2, padding: '11px 12px', fontFamily: FONT, fontSize: 15, outline: 'none', marginBottom: 18, boxSizing: 'border-box' }}
      />

      <SectionLabel label="配图（最多 9 张）" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
        {images.map((src, i) => (
          <div key={i} style={{ position: 'relative', width: 84, height: 84, border: `2px solid ${INK}`, borderRadius: 2, overflow: 'hidden', background: '#efefef' }}>
            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              onClick={() => setImages(images.filter((_, j) => j !== i))}
              style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: INK, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {images.length < 9 && (
          <label
            style={{ width: 84, height: 84, border: `2px dashed ${INK}`, borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: MUTED, cursor: 'pointer' }}
          >
            <ImagePlus size={20} />
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, marginTop: 4 }}>添加</span>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onPick} multiple />
          </label>
        )}
      </div>

      <BtnPrimary onClick={submit} style={{ width: '100%', padding: '12px 16px' }}>
        发布帖子
      </BtnPrimary>
    </div>
  )
}
