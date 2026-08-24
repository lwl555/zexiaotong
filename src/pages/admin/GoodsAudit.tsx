import { useState } from 'react'
import { Search, EyeOff } from 'lucide-react'
import { useStore } from '../../store/store'
import { PageHeader, StatusBadge, confirmDanger } from './ui'
import type { GoodsStatus } from '../../lib/types'

export default function GoodsAudit() {
  const goods = useStore(s => s.goods)
  const setGoodsStatus = useStore(s => s.setGoodsStatus)
  const removeGoods = useStore(s => s.removeGoods)
  const [kw, setKw] = useState('')

  let list = goods
  if (kw) list = goods.filter(g => g.title.includes(kw) || g.seller_name.includes(kw))

  const toggle = (g: any) => setGoodsStatus(g.id, g.status === 'on' ? 'off' : 'on')

  return (
    <div>
      <PageHeader title="二手商品审核" desc="管理商品上架 / 下架，违规商品强制下架">
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
          <Search size={16} className="text-gray-400" />
          <input className="bg-transparent outline-none text-sm w-40" placeholder="搜索商品 / 卖家" value={kw} onChange={e => setKw(e.target.value)} />
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map(g => (
          <div key={g.id} className="card p-4 flex gap-3">
            <img src={g.images[0] || ''} className="w-20 h-20 rounded-xl bg-gray-100 object-cover shrink-0" alt="" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-ink truncate">{g.title}</div>
              <div className="text-brand-600 font-black mt-0.5">¥{g.price}</div>
              <div className="text-xs text-gray-400 mt-1">{g.category} · {g.seller_name}</div>
              <div className="flex items-center gap-3 mt-3">
                <select className="input !py-1 !px-2 text-xs w-24" value={g.status}
                  onChange={e => setGoodsStatus(g.id, e.target.value as GoodsStatus)}>
                  <option value="on">在售</option>
                  <option value="off">已下架</option>
                  <option value="removed">违规移除</option>
                </select>
                <button className="text-gray-500 text-xs" onClick={toggle}>{g.status === 'on' ? '下架' : '上架'}</button>
                {g.status !== 'removed' && (
                  <button className="text-red-500 text-xs" onClick={() => { if (confirmDanger('确认违规下架该商品？')) removeGoods(g.id) }}><EyeOff size={13} className="inline" /> 移除</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="col-span-full text-center text-gray-400 text-sm py-10">暂无商品</div>}
      </div>
    </div>
  )
}
