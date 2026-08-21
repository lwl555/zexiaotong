import { useState } from 'react'
import { Search, Heart, Star, MessageCircle, EyeOff } from 'lucide-react'
import { useStore } from '../../store/store'
import { PageHeader, StatusBadge, confirmDanger } from './ui'
import type { PostStatus } from '../../lib/types'

export default function PostAudit() {
  const posts = useStore(s => s.posts)
  const setPostStatus = useStore(s => s.setPostStatus)
  const removePost = useStore(s => s.removePost)
  const [kw, setKw] = useState('')

  let list = posts
  if (kw) list = posts.filter(p => p.title.includes(kw) || p.author_name.includes(kw))

  return (
    <div>
      <PageHeader title="社区帖子审核" desc="管理帖子可见性，违规帖强制移除">
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
          <Search size={16} className="text-gray-400" />
          <input className="bg-transparent outline-none text-sm w-40" placeholder="搜索帖子 / 作者" value={kw} onChange={e => setKw(e.target.value)} />
        </div>
      </PageHeader>

      <div className="space-y-3">
        {list.map(p => (
          <div key={p.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-ink">{p.title}</div>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.content}</p>
                <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                  <span>{p.author_name}</span>
                  <span className="flex items-center gap-1"><Heart size={13} /> {p.likes}</span>
                  <span className="flex items-center gap-1"><Star size={13} /> {p.collects}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={13} /> {p.comments}</span>
                </div>
              </div>
              {p.images[0] && <img src={p.images[0]} className="w-16 h-16 rounded-xl object-cover bg-gray-100 shrink-0" alt="" />}
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
              <select className="input !py-1 !px-2 text-xs w-28" value={p.status}
                onChange={e => setPostStatus(p.id, e.target.value as PostStatus)}>
                <option value="on">已发布</option>
                <option value="off">仅自己可见</option>
                <option value="removed">违规移除</option>
              </select>
              {p.status !== 'removed' ? (
                <button className="text-red-500 text-xs" onClick={() => { if (confirmDanger('确认违规移除该帖子？')) removePost(p.id) }}><EyeOff size={13} className="inline" /> 移除</button>
              ) : <StatusBadge text="已移除" tone="red" />}
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-center text-gray-400 text-sm py-10">暂无帖子</div>}
      </div>
    </div>
  )
}
