import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Heart, Star, MessageCircle, Flag, ChevronLeft } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import { fetchComments, createComment } from '../../lib/db'
import type { Comment } from '../../lib/types'
import {
  PageHeader,
  SectionLabel,
  HardCard,
  ListRow,
  BtnPrimary,
  Tag,
  INK,
  MUTED,
  ACCENT,
  HAIR,
  FONT,
  MONO,
} from '../../components/Editorial'

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

  if (!post) {
    return (
      <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
        <HardCard>
          <div style={{ textAlign: 'center', color: MUTED, fontSize: 14 }}>帖子不存在或已删除</div>
        </HardCard>
      </div>
    )
  }

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
    <div style={{ padding: '8px 2px 96px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <button onClick={() => nav(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, color: MUTED, marginBottom: 12, padding: 0 }}>
        <ChevronLeft size={16} /> 返回
      </button>

      {post.images[0] && (
        <img src={post.images[0]} alt="" style={{ width: '100%', height: 220, objectFit: 'cover', border: `3px solid ${INK}`, borderRadius: 2, marginBottom: 16, background: '#efefef' }} />
      )}

      <PageHeader
        eyebrow="Post"
        title={post.title}
        right={<Tag tone="line">帖子</Tag>}
      />

      {/* 作者 + 正文：硬边主卡 */}
      <HardCard style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${HAIR}` }}>
          <img src={post.author_avatar} alt="" style={{ width: 30, height: 30, borderRadius: '50%', border: `1.5px solid ${INK}` }} />
          <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: INK }}>{post.author_name}</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: 1, marginLeft: 'auto' }}>
            {String(post.likes + post.collects).padStart(3, '0')} 互动
          </span>
        </div>
        <p style={{ fontFamily: FONT, fontSize: 15, color: INK, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>{post.content}</p>
      </HardCard>

      {/* 互动条：点赞 / 收藏 / 举报 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '12px 2px', borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}`, marginBottom: 20 }}>
        <button onClick={() => likePost(post.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: post.liked ? ACCENT : MUTED, padding: 0 }}>
          <Heart size={18} /> {post.likes}
        </button>
        <button onClick={() => collectPost(post.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: post.collected ? ACCENT : MUTED, padding: 0 }}>
          <Star size={18} /> {post.collects}
        </button>
        <button onClick={() => nav('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: MUTED, marginLeft: 'auto', padding: 0 }}>
          <Flag size={16} /> 举报
        </button>
      </div>

      <SectionLabel index="02" label="评论" />

      <div>
        {loading && <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '32px 0' }}>加载评论中…</div>}
        {!loading && comments.length === 0 && <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '32px 0' }}>暂无评论，来抢沙发</div>}
        {comments.map(c => (
          <ListRow key={c.id} style={{ alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${INK}`, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: INK, flexShrink: 0 }}>
                {c.author_name.slice(-1)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>
                  {c.author_name}
                  <span style={{ fontFamily: FONT, fontSize: 12, color: MUTED, fontWeight: 400, marginLeft: 8 }}>
                    {new Date(c.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <div style={{ fontFamily: FONT, fontSize: 14, color: MUTED, marginTop: 4, lineHeight: 1.6 }}>{c.content}</div>
              </div>
            </div>
          </ListRow>
        ))}
      </div>

      {/* 固定评论输入栏：白底 + 粗黑边 */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 1200, height: 64, background: '#ffffff', borderTop: `2px solid ${INK}`, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', zIndex: 30 }}>
        <input
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="友善评论…"
          onKeyDown={e => e.key === 'Enter' && send()}
          style={{ flex: 1, border: `2px solid ${INK}`, borderRadius: 2, padding: '10px 12px', fontFamily: FONT, fontSize: 15, outline: 'none', background: '#ffffff', color: INK }}
        />
        <BtnPrimary onClick={send}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MessageCircle size={16} /> 发送
          </span>
        </BtnPrimary>
      </div>
    </div>
  )
}
