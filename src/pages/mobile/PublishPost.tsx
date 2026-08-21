import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImagePlus, X } from 'lucide-react'
import { useStore } from '../../store/store'
import { img } from '../../lib/mockData'

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
    if (!title.trim()) { alert('请填写标题'); return }
    if (!content.trim()) { alert('请填写内容'); return }
    publishPost({ title: title.trim(), content: content.trim(), images: images.length ? images : [img('图文帖', 400, 240, '#a855f7')] })
    alert('发布成功')
    nav('/community')
  }

  return (
    <div className="px-4 pt-3 pb-10">
      <button onClick={() => nav(-1)} className="text-gray-400 mb-2">‹ 返回</button>
      <h1 className="text-xl font-black text-ink mb-4">发布帖子</h1>

      <label className="block text-sm text-gray-500 mb-1">标题</label>
      <input className="input mb-3" value={title} onChange={e => setTitle(e.target.value)} placeholder="一句话说清你想聊的" />

      <label className="block text-sm text-gray-500 mb-1">正文</label>
      <textarea className="input h-40 resize-none mb-3" value={content} onChange={e => setContent(e.target.value)} placeholder="分享你的想法、求助、吐槽…" />

      <label className="block text-sm text-gray-500 mb-1">配图（最多 9 张）</label>
      <div className="flex flex-wrap gap-2 mb-5">
        {images.map((src, i) => (
          <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
            <img src={src} className="w-full h-full object-cover" alt="" />
            <button onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center"><X size={12} /></button>
          </div>
        ))}
        {images.length < 9 && (
          <label className="w-20 h-20 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer">
            <ImagePlus size={20} /><span className="text-[11px] mt-1">添加</span>
            <input type="file" accept="image/*" className="hidden" onChange={onPick} multiple />
          </label>
        )}
      </div>

      <button className="btn-primary w-full" onClick={submit}>发布帖子</button>
    </div>
  )
}
