import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageSquare, ChevronLeft, Share2 } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'

export default function GoodsDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const good = useStore(s => s.goods.find(g => g.id === id))
  const sendMessage = useStore(s => s.sendMessage)
  const [imgIdx, setImgIdx] = useState(0)

  if (!good) return <div className="p-10 text-center text-gray-400">商品不存在或已下架</div>
  const isMine = good.seller_id === me.id

  const chat = () => {
    if (isMine) return
    sendMessage(good.seller_id, '你好，我想了解一下「' + good.title + '」')
    nav('/messages?peer=' + good.seller_id)
  }

  return (
    <div className="pb-24">
      <div className="relative">
        <img src={good.images[imgIdx] || ''} className="w-full h-64 object-cover bg-gray-100" alt="" />
        <button onClick={() => nav(-1)} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center"><ChevronLeft size={20} /></button>
        <button onClick={() => nav('/')} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center"><Share2 size={16} /></button>
        {good.images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {good.images.map((_, i) => <span key={i} className={'w-1.5 h-1.5 rounded-full ' + (i === imgIdx ? 'bg-white' : 'bg-white/50')} />)}
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        <div className="text-2xl font-black text-brand-600">¥{good.price}</div>
        <h1 className="text-lg font-black text-ink mt-2">{good.title}</h1>
        <div className="flex items-center gap-2 mt-2">
          <span className="tag bg-gray-100 text-gray-500">{good.category}</span>
        </div>
        <p className="text-sm text-gray-600 mt-4 leading-relaxed whitespace-pre-wrap">{good.description}</p>

        <div className="flex items-center gap-3 mt-5 p-3 rounded-2xl bg-gray-50">
          <img src={good.seller_id ? '' : ''} className="w-10 h-10 rounded-full bg-brand-100" alt="" />
          <div className="flex-1">
            <div className="font-medium text-sm">{good.seller_name}</div>
            <div className="text-xs text-gray-400">卖家</div>
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-16 bg-white border-t border-gray-100 flex items-center gap-3 px-4 z-30">
        <button onClick={chat} disabled={isMine} className="flex flex-col items-center text-gray-500 disabled:opacity-40">
          <MessageSquare size={20} /><span className="text-[11px] mt-0.5">私聊</span>
        </button>
        <button onClick={chat} disabled={isMine}
          className="btn-primary flex-1 disabled:opacity-40">
          {isMine ? '这是你自己发布的' : '我想要（私聊卖家）'}
        </button>
      </div>
    </div>
  )
}
