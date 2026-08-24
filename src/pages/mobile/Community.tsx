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
    <div className="px-4 pt-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-black text-ink">校园社区</h1>
        <button onClick={() => nav('/publish-post')} className="flex items-center gap-1 text-sm text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full">
          <Plus size={15} /> 发帖
        </button>
      </div>

      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5 mb-3">
        <Search size={18} className="text-gray-400" />
        <input className="bg-transparent outline-none text-sm flex-1" placeholder="搜索帖子" value={kw} onChange={e => setKw(e.target.value)} />
      </div>

      <div className="space-y-3">
        {list.length === 0 && <div className="text-center text-gray-400 text-sm py-16">暂无帖子</div>}
        {list.map(p => (
          <div key={p.id} className="card p-4">
            {p.images[0] && <img src={p.images[0]} className="w-full h-40 object-cover rounded-xl mb-3 bg-gray-100" alt="" />}
            <div className="font-black text-[15px] text-ink leading-snug" onClick={() => nav('/post/' + p.id)}>{p.title}</div>
            <div className="text-sm text-gray-500 mt-1 line-clamp-2" onClick={() => nav('/post/' + p.id)}>{p.content}</div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <img src={p.author_avatar} className="w-6 h-6 rounded-full" alt="" />{p.author_name}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <button onClick={() => likePost(p.id)} className={'flex items-center gap-1 ' + (p.liked ? 'text-red-500' : 'text-gray-400')}>
                  <Heart size={16} /> {p.likes}
                </button>
                <button onClick={() => collectPost(p.id)} className={'flex items-center gap-1 ' + (p.collected ? 'text-amber-500' : 'text-gray-400')}>
                  <Star size={16} /> {p.collects}
                </button>
                <span className="flex items-center gap-1 text-gray-400"><MessageCircle size={16} /> {p.comments}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
