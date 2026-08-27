import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImagePlus, X, CheckCircle, XCircle } from 'lucide-react'
import { useStore } from '../../store/store'
import { img } from '../../lib/img'

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
    <div className="px-4 pt-3 pb-10">
      {/* Toast 通知 */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <button onClick={() => nav(-1)} className="text-gray-400 mb-2">‹ 返回</button>
      <h1 className="text-[18px] font-bold text-ink mb-4">发布帖子</h1>

      <label className="block text-sm text-gray-500 mb-1">标题</label>
      <input className="input mb-3" value={title} onChange={e => setTitle(e.target.value)} placeholder="一句话说清你想聊的" />

      <label className="block text-sm text-gray-500 mb-1">正文</label>
      <textarea className="input h-40 resize-none mb-3" value={content} onChange={e => setContent(e.target.value)} placeholder="分享你的想法、求助、吐槽…" />

      <label className="block text-sm text-gray-500 mb-1">配图（最多 9 张）</label>
      <div className="flex flex-wrap gap-2 mb-5">
        {images.map((src, i) => (
          <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100">
            <img src={src} className="w-full h-full object-cover" alt="" />
            <button onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center"><X size={12} /></button>
          </div>
        ))}
        {images.length < 9 && (
          <label className="w-16 h-16 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer">
            <ImagePlus size={20} /><span className="text-[11px] mt-1">添加</span>
            <input type="file" accept="image/*" className="hidden" onChange={onPick} multiple />
          </label>
        )}
      </div>

      <button className="btn-primary w-full" onClick={submit}>发布帖子</button>
    </div>
  )
}
