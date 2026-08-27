import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Heart, Star, MessageCircle, Search } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'

export default function Community() {
  const nav = useNavigate()
  const me = useMe()
  const posts = useStore(s => s.posts)
  const likePost = useStore(s => s.likePost)
  const collectPost = useStore(s => s.collectPost)
  const [kw, setKw] = useState('')

  let list = posts.filter(p => p.status !== 'removed')
  if (kw) list = list.filter(p => p.title.includes(kw) || p.content.includes(kw))

  return (
    <div className="px-3.5 pt-3 pb-4">
      <div className="flex items-center justify-between mb-2.5">
        <h1 className="text-[17px] font-bold text-ink">校园社区</h1>
        <button onClick={() => nav('/publish-post')} className="flex items-center gap-1 text-[13px] text-brand-600 bg-brand-50 px-2.5 py-1.5 rounded-full active:bg-brand-100">
          <Plus size={15} /> 发帖
        </button>
      </div>

      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 mb-2.5">
        <Search size={17} className="text-gray-400" />
        <input className="bg-transparent outline-none text-[13px] flex-1" placeholder="搜索帖子" value={kw} onChange={e => setKw(e.target.value)} />
      </div>

      <div className="space-y-2.5">
        {list.length === 0 && <div className="text-center text-gray-400 text-[13px] py-16">暂无帖子</div>}
        {list.map(p => (
          <div key={p.id} className="card p-3.5">
            {p.images[0] && <img src={p.images[0]} className="w-full h-32 object-cover rounded-xl mb-2.5 bg-gray-100" alt="" />}
            <div className="font-semibold text-[15px] text-ink leading-snug" onClick={() => nav('/post/' + p.id)}>{p.title}</div>
            <div className="text-[13px] text-gray-500 mt-1 line-clamp-2" onClick={() => nav('/post/' + p.id)}>{p.content}</div>
            <div className="flex items-center justify-between mt-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <img src={p.author_avatar} className="w-5 h-5 rounded-full" alt="" />{p.author_name}
              </div>
              <div className="flex items-center gap-3.5 text-[13px]">
                <button onClick={() => likePost(p.id)} className={'flex items-center gap-1 ' + (p.liked ? 'text-red-500' : 'text-gray-400')}>
                  <Heart size={15} /> {p.likes}
                </button>
                <button onClick={() => collectPost(p.id)} className={'flex items-center gap-1 ' + (p.collected ? 'text-amber-500' : 'text-gray-400')}>
                  <Star size={15} /> {p.collects}
                </button>
                <span className="flex items-center gap-1 text-gray-400"><MessageCircle size={15} /> {p.comments}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
