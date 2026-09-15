import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'
import { fetchBulletinComments } from '../../lib/db'
import { MessageCircle, Send, ArrowLeft } from 'lucide-react'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

export default function BulletinDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const me = useStore(s => s.me)
  const bulletins = useStore(s => s.bulletins)
  const addBulletinComment = useStore(s => s.addBulletinComment)
  const [comments, setComments] = useState<any[]>([])
  const [text, setText] = useState('')

  const b = bulletins.find(x => x.id === id)

  useEffect(() => {
    if (id) fetchBulletinComments(id).then(setComments).catch(() => setComments([]))
  }, [id])

  const send = async () => {
    if (!text.trim()) return
    await addBulletinComment(id!, text.trim())
    setText('')
    if (id) fetchBulletinComments(id).then(setComments).catch(() => {})
  }

  if (!b) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#9a9a9a' }}>
        <button onClick={() => nav(-1)} style={{ color: '#c2410c' }}>‹ 返回</button>
        <div style={{ marginTop: 12 }}>内容不存在或已删除</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '10px 12px 80px', maxWidth: 640, margin: '0 auto' }}>
      <button onClick={() => nav(-1)} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b6258', fontSize: 14, marginBottom: 10 }}>
        <ArrowLeft size={18} /> 返回
      </button>

      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#c2410c' }}>{b.school_name}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9a9a9a' }}>{timeAgo(b.created_at)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 15, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#c2410c', fontWeight: 700 }}>
            {b.author_name.slice(0, 1)}
          </div>
          <span style={{ fontSize: 13, color: '#1c1814', fontWeight: 600 }}>{b.author_name}</span>
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.7, color: '#1c1814', whiteSpace: 'pre-wrap' }}>{b.content}</div>
        {b.images?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {b.images.map((src, i) => (
              <img key={i} src={src} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: '#1c1814', display: 'flex', alignItems: 'center', gap: 6 }}>
        <MessageCircle size={15} color="#c2410c" /> 评论 {comments.length}
      </div>

      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {comments.map(c => (
          <div key={c.id} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, padding: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1c1814' }}>{c.author_name}</span>
              <span style={{ fontSize: 11, color: '#9a9a9a' }}>{timeAgo(c.created_at)}</span>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: '#333' }}>{c.content}</div>
          </div>
        ))}
        {comments.length === 0 && <div style={{ textAlign: 'center', color: '#9a9a9a', fontSize: 13, padding: '16px 0' }}>还没有评论，来抢沙发</div>}
      </div>

      {/* 评论输入 */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e8e8e8', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', maxWidth: 640, margin: '0 auto' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={me ? '说点什么…' : '请先登录后评论'}
          disabled={!me}
          onKeyDown={e => e.key === 'Enter' && send()}
          style={{ flex: 1, border: '1px solid #e8e8e8', borderRadius: 999, padding: '9px 14px', fontSize: 14, outline: 'none' }}
        />
        <button onClick={send} disabled={!me || !text.trim()} style={{ width: 38, height: 38, borderRadius: 19, background: '#c2410c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: me && text.trim() ? 1 : 0.5 }}>
          <Send size={17} />
        </button>
      </div>
    </div>
  )
}
