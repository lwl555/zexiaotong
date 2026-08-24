import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Heart, Star, MessageCircle, Flag, ChevronLeft } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import { fetchComments, createComment } from '../../lib/db'
import type { Comment } from '../../lib/types'

export default function PostDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const post = useStore(s => s.posts.find(p => p.id === id))
  const likePost = useStore(s => s.likePost)
  const collectPost = useStore(s => s.collectPost)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  // 拉取真实评论
  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchComments('post', id)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }, [id])

  if (!post) return <div className="p-10 text-center text-gray-400">帖子不存在或已删除</div>

  const send = async () => {
    if (!comment.trim()) return
    try {
      const c = await createComment({
        target_type: 'post',
        target_id: post.id,
        author_id: me.id,
        author_name: me.nickname,
        author_avatar: me.avatar,
        content: comment.trim()
      })
      setComments(prev => [...prev, c])
      setComment('')
    } catch {
      // 兜底：本地追加
      setComments(prev => [...prev, {
        id: 'c' + Date.now(),
        target_type: 'post',
        target_id: post.id,
        author_id: me.id,
        author_name: me.nickname,
        author_avatar: me.avatar,
        content: comment.trim(),
        created_at: new Date().toISOString()
      }])
      setComment('')
    }
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

      <h2 className="font-bold text-ink mt-5 mb-2">评论 {comments.length}</h2>
      <div className="space-y-3">
        {loading && <div className="text-sm text-gray-400">加载评论中…</div>}
        {!loading && comments.length === 0 && <div className="text-sm text-gray-400">暂无评论，来抢沙发</div>}
        {comments.map(c => (
          <div key={c.id} className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-sm shrink-0">{c.author_name.slice(-1)}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{c.author_name} <span className="text-xs text-gray-400 font-normal ml-2">{new Date(c.created_at).toLocaleString('zh-CN')}</span></div>
              <div className="text-sm text-gray-600 mt-0.5">{c.content}</div>
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
