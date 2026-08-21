import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImagePlus, X } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import { img } from '../../lib/img'

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

  const submit = () => {
    const amt = Number(amount)
    if (!title.trim()) { setErr('请填写任务标题'); return }
    if (!amt || amt <= 0) { setErr('请填写正确的悬赏金额'); return }
    if (!deadline) { setErr('请选择截止时间'); return }
    if (amt > usable) { setErr(`可用余额不足：需 ¥${amt}，当前可用 ¥${usable.toFixed(2)}`); return }
    const r = publish({ title, category, amount: amt, deadline: new Date(deadline).toISOString(), description: desc, images })
    if (!r.ok) { setErr(r.msg); return }
    nav('/')
  }

  return (
    <div className="px-4 pt-3 pb-10">
      <button onClick={() => nav(-1)} className="text-gray-400 mb-2">‹ 返回</button>
      <h1 className="text-xl font-black text-ink mb-1">发布悬赏任务</h1>
      <p className="text-xs text-gray-500 mb-4">发布即冻结金额，任务完成自动解冻并分账（平台抽佣 {Math.round(useStore.getState().config.commission_rate * 100)}%）</p>

      <label className="text-sm text-gray-600">任务标题</label>
      <input className="input mt-2" value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：代取快递到宿舍楼下" />

      <label className="text-sm text-gray-600 mt-4 block">任务分类</label>
      <div className="flex gap-2 mt-2 flex-wrap">
        {CATS.map(c => (
          <button key={c} onClick={() => setCategory(c)} className={'px-3 py-1.5 rounded-full text-sm ' + (category === c ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600')}>{c}</button>
        ))}
      </div>

      <div className="flex gap-3 mt-4">
        <div className="flex-1">
          <label className="text-sm text-gray-600">悬赏金额（元）</label>
          <input className="input mt-2" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" inputMode="decimal" />
        </div>
        <div className="flex-1">
          <label className="text-sm text-gray-600">截止时间</label>
          <input type="datetime-local" className="input mt-2" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>
      </div>
      <div className="text-xs text-gray-400 mt-2">可用余额 ¥{usable.toFixed(2)}（冻结 ¥{me.frozen.toFixed(2)}）</div>

      <label className="text-sm text-gray-600 mt-4 block">需求描述</label>
      <textarea className="input mt-2 h-28 resize-none" value={desc} onChange={e => setDesc(e.target.value)} placeholder="详细说明任务要求、交付标准…" />

      <label className="text-sm text-gray-600 mt-4 block">图片 / 附件（{images.length}）</label>
      <div className="flex gap-2 mt-2 flex-wrap">
        {images.map((s, i) => (
          <div key={i} className="relative w-20 h-20">
            <img src={s} className="w-20 h-20 rounded-xl object-cover" alt="" />
            <button onClick={() => rmImg(i)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"><X size={12} /></button>
          </div>
        ))}
        <button onClick={addImg} className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 flex flex-col items-center justify-center gap-1">
          <ImagePlus size={20} /><span className="text-xs">添加</span>
        </button>
      </div>

      {err && <div className="text-red-500 text-sm mt-4 bg-red-50 rounded-xl px-3 py-2">{err}</div>}

      <button className="btn-primary w-full mt-6" onClick={submit}>发布并冻结金额</button>
    </div>
  )
}
