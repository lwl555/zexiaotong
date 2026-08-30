import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Heart, Star, MessageCircle, Search } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import {
  PageHeader,
  IndexGrid,
  HardCard,
  BtnPrimary,
  INK,
  MUTED,
  FAINT,
  ACCENT,
  HAIR,
  FONT,
  MONO,
} from '../../components/Editorial'

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
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader
        eyebrow="Community"
        title="校园社区"
        desc="护考前辈的真实经验、避坑清单与资料共享。用大白话，不整虚的。"
        right={
          <BtnPrimary onClick={() => nav('/publish-post')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> 发帖
            </span>
          </BtnPrimary>
        }
      />

      {/* 搜索：粗黑下边线，等宽计数 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: `2px solid ${INK}`,
          paddingBottom: 10,
          marginBottom: 18,
        }}
      >
        <Search size={18} color={MUTED} />
        <input
          value={kw}
          onChange={e => setKw(e.target.value)}
          placeholder="搜索帖子 / 关键词"
          style={{ flex: 1, border: 'none', outline: 'none', fontFamily: FONT, fontSize: 15, color: INK, background: 'transparent' }}
        />
        <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: 2 }}>
          {String(list.length).padStart(2, '0')} POSTS
        </span>
      </div>

      {list.length === 0 && (
        <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '64px 0' }}>
          暂无帖子，来发第一篇。
        </div>
      )}

      <IndexGrid>
        {list.map((p, i) => (
          <HardCard key={p.id} onClick={() => nav('/post/' + p.id)} style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
            {p.images[0] ? (
              <img
                src={p.images[0]}
                alt=""
                style={{ width: '100%', height: 150, objectFit: 'cover', border: `2px solid ${INK}`, borderRadius: 2, marginBottom: 12, background: '#efefef' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: 150,
                  border: `2px solid ${INK}`,
                  borderRadius: 2,
                  marginBottom: 12,
                  background: '#f4f2ee',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: MONO,
                  fontSize: 11,
                  color: FAINT,
                  letterSpacing: 2,
                }}
              >
                NO COVER
              </div>
            )}
            <div style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, letterSpacing: 2, marginBottom: 6 }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 700, color: INK, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
              {p.title}
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 13,
                color: MUTED,
                marginTop: 6,
                lineHeight: 1.55,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {p.content}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${HAIR}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT, fontSize: 12, color: MUTED }}>
                <img src={p.author_avatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${INK}` }} />
                {p.author_name}
              </div>
              <div style={{ display: 'flex', gap: 12, fontFamily: FONT, fontSize: 12, color: MUTED }}>
                <button
                  onClick={e => { e.stopPropagation(); likePost(p.id) }}
                  style={{ display: 'inline-flex', gap: 4, alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: p.liked ? ACCENT : MUTED }}
                >
                  <Heart size={14} /> {p.likes}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); collectPost(p.id) }}
                  style={{ display: 'inline-flex', gap: 4, alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: p.collected ? ACCENT : MUTED }}
                >
                  <Star size={14} /> {p.collects}
                </button>
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <MessageCircle size={14} /> {p.comments}
                </span>
              </div>
            </div>
          </HardCard>
        ))}
      </IndexGrid>
    </div>
  )
}
