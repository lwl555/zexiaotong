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
    <div className="px-4 pt-3 pb-10">
      {/* Toast 通知 */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <button onClick={() => nav(-1)} className="text-gray-400 mb-2">‹ 返回</button>
      <h1 className="text-xl font-black text-ink mb-4">发布二手商品</h1>

      <label className="block text-sm text-gray-500 mb-1">商品名称</label>
      <input className="input mb-3" value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：九成新 iPad Air" />

      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <label className="block text-sm text-gray-500 mb-1">价格（元）</label>
          <input className="input" value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" inputMode="decimal" />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-gray-500 mb-1">分类</label>
          <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
            {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <label className="block text-sm text-gray-500 mb-1">商品描述</label>
      <textarea className="input h-24 resize-none mb-3" value={description} onChange={e => setDescription(e.target.value)} placeholder="成色、购买渠道、转手原因…" />

      <label className="block text-sm text-gray-500 mb-1">商品图片（最多 6 张）</label>
      <div className="flex flex-wrap gap-2 mb-5">
        {images.map((src, i) => (
          <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
            <img src={src} className="w-full h-full object-cover" alt="" />
            <button onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center"><X size={12} /></button>
          </div>
        ))}
        {images.length < 6 && (
          <label className="w-20 h-20 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer">
            <ImagePlus size={20} /><span className="text-[11px] mt-1">添加</span>
            <input type="file" accept="image/*" className="hidden" onChange={onPick} multiple />
          </label>
        )}
      </div>

      <button className="btn-primary w-full" onClick={submit}>发布商品</button>
    </div>
  )
}
