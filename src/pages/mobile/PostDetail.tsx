import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Heart, Star, MessageCircle, Flag, ChevronLeft } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'

const MOCK_COMMENTS = [
  { id: 'c1', name: '学委小李', text: '蹲一个搭子！', avatar: '', time: '10 分钟前' },
  { id: 'c2', name: '跑腿王哥', text: '我也是，一起呗', avatar: '', time: '5 分钟前' }
]

export default function PostDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const post = useStore(s => s.posts.find(p => p.id === id))
  const likePost = useStore(s => s.likePost)
  const collectPost = useStore(s => s.collectPost)
  const [comment, setComment] = useState('')
  const [local, setLocal] = useState(MOCK_COMMENTS)

  if (!post) return <div className="p-10 text-center text-gray-400">帖子不存在或已删除</div>

  const send = () => {
    if (!comment.trim()) return
    setLocal([...local, { id: 'c' + Date.now(), name: me.nickname, text: comment.trim(), avatar: me.avatar, time: '刚刚' }])
    setComment('')
  }

  return (
    <div className="px-4 pt-3 pb-10">
      <button onClick={() => nav(-1)} className="text-gray-400 mb-2 flex items-center"><ChevronLeft size={16} /> 返回</button>

      {post.images[0] && <img src={post.images[0]} className="w-full h-48 object-cover rounded-2xl mb-3 bg-gray-100" alt="" />}
      <h1 className="text-xl font-black text-ink leading-snug">{post.title}</h1>
      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
        <img src={post.author_avatar} className="w-6 h-6 rounded-full" alt="" />{post.author_name}
      </div>
      <p className="text-sm text-gray-700 mt-3 leading-relaxed whitespace-pre-wrap">{post.content}</p>

      <div className="flex items-center gap-6 mt-5 py-3 border-y border-gray-100">
        <button onClick={() => likePost(post.id)} className={'flex items-center gap-1.5 ' + (post.liked ? 'text-red-500' : 'text-gray-500')}>
          <Heart size={18} /> {post.likes}
        </button>
        <button onClick={() => collectPost(post.id)} className={'flex items-center gap-1.5 ' + (post.collected ? 'text-amber-500' : 'text-gray-500')}>
          <Star size={18} /> {post.collects}
        </button>
        <button onClick={() => nav('/')} className="flex items-center gap-1.5 text-gray-500 ml-auto"><Flag size={16} /> 举报</button>
      </div>

      <h2 className="font-bold text-ink mt-5 mb-2">评论 {local.length}</h2>
      <div className="space-y-3">
        {local.map(c => (
          <div key={c.id} className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-sm shrink-0">{c.name.slice(-1)}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{c.name} <span className="text-xs text-gray-400 font-normal ml-2">{c.time}</span></div>
              <div className="text-sm text-gray-600 mt-0.5">{c.text}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-16 bg-white border-t border-gray-100 flex items-center gap-2 px-4 z-30">
        <input className="input flex-1" value={comment} onChange={e => setComment(e.target.value)} placeholder="友善评论…" onKeyDown={e => e.key === 'Enter' && send()} />
        <button className="btn-primary px-5" onClick={send}><MessageCircle size={16} /></button>
      </div>
    </div>
  )
}
