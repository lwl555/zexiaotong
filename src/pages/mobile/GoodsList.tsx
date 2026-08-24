import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, MessageSquare, ArrowDownWideNarrow } from 'lucide-react'
import { useStore } from '../../store/store'

export default function GoodsList() {
  const nav = useNavigate()
  const goods = useStore(s => s.goods)
  const categories = useStore(s => s.categories)
  const cats = categories.filter(c => c.kind === 'goods')
  const [kw, setKw] = useState('')
  const [cat, setCat] = useState('全部')
  const [sort, setSort] = useState<'new' | 'priceAsc' | 'priceDesc'>('new')

  let list = goods.filter(g => g.status !== 'removed')
  if (cat !== '全部') list = list.filter(g => g.category === cat)
  if (kw) list = list.filter(g => g.title.includes(kw) || g.description.includes(kw))
  list = [...list].sort((a, b) => {
    if (sort === 'priceAsc') return a.price - b.price
    if (sort === 'priceDesc') return b.price - a.price
    return b.created_at.localeCompare(a.created_at)
  })

  return (
    <div className="px-4 pt-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-black text-ink">二手集市</h1>
        <button onClick={() => nav('/publish-goods')} className="flex items-center gap-1 text-sm text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full">
          <Plus size={15} /> 发布
        </button>
      </div>

      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5 mb-3">
        <Search size={18} className="text-gray-400" />
        <input className="bg-transparent outline-none text-sm flex-1" placeholder="搜索二手好物" value={kw} onChange={e => setKw(e.target.value)} />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-2">
        {['全部', ...cats.map(c => c.name)].map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={'px-3 py-1.5 rounded-full text-sm whitespace-nowrap ' + (cat === c ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600')}>
            {c}
          </button>
        ))}
        <button onClick={() => setSort(s => s === 'priceAsc' ? 'priceDesc' : s === 'priceDesc' ? 'new' : 'priceAsc')}
          className="ml-auto flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full whitespace-nowrap">
          <ArrowDownWideNarrow size={14} />
          {sort === 'new' ? '最新' : sort === 'priceAsc' ? '价格↑' : '价格↓'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        {list.length === 0 && <div className="col-span-2 text-center text-gray-400 text-sm py-16">暂无商品</div>}
        {list.map(g => (
          <div key={g.id} onClick={() => nav('/goods/' + g.id)} className="card overflow-hidden active:scale-[.98] transition">
            <img src={g.images[0] || ''} className="w-full h-36 object-cover bg-gray-100" alt="" />
            <div className="p-2.5">
              <div className="text-sm font-medium truncate">{g.title}</div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-brand-600 font-black">¥{g.price}</span>
                <span className="text-[11px] text-gray-400">{g.category}</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 truncate">{g.seller_name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
