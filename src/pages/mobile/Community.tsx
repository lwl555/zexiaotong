import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Heart, Star, MessageCircle, Search, Flame, Clock } from 'lucide-react'
import { useStore } from '../../store/store'
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

// 相对时间：社区氛围更像真实社区（「2 小时前」而不是一串时间戳）
function relTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (!t || Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

// 热度：点赞 1 分、收藏 2 分、评论 3 分（评论最贵，代表真互动）
const heat = (p: { likes: number; collects: number; comments: number }) =>
  p.likes + p.collects * 2 + p.comments * 3

export default function Community() {
  const nav = useNavigate()
  const posts = useStore(s => s.posts)
  const likePost = useStore(s => s.likePost)
  const collectPost = useStore(s => s.collectPost)
  const inviteCommunityBots = useStore(s => s.inviteCommunityBots)
  const [kw, setKw] = useState('')
  const [sort, setSort] = useState<'new' | 'hot'>('new')
  const [botBusy, setBotBusy] = useState(false)

  // 进页面时静默让社区「智能体」补一条内容（服务端限频 30 分钟 2 条，不会刷屏）；
  // 前端再兜一层 5 分钟节流，避免同一会话反复请求。
  useEffect(() => {
    const KEY = 'zex:bot-invite-at'
    try {
      const last = Number(sessionStorage.getItem(KEY) || 0)
      if (last && Date.now() - last < 5 * 60 * 1000) return
      sessionStorage.setItem(KEY, String(Date.now()))
    } catch { /* 隐私模式下也要能跑，只是不做节流 */ }

    let alive = true
    setBotBusy(true)
    inviteCommunityBots(1)
      .catch(() => 0)
      .finally(() => { if (alive) setBotBusy(false) })
    return () => { alive = false }
  }, [inviteCommunityBots])

  let list = posts.filter(p => p.status !== 'removed')
  if (kw) list = list.filter(p => p.title.includes(kw) || p.content.includes(kw))
  if (sort === 'hot') list = [...list].sort((a, b) => heat(b) - heat(a))

  return (
    <div style={{ padding: '8px 16px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
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

      {/* 搜索 + 排序：粗黑下边线，等宽计数 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: `1px solid #e8e8e8`,
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
        <button
          onClick={() => setSort('new')}
          title="按最新"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, background: 'none', cursor: 'pointer',
            border: 'none', padding: '2px 4px',
            fontFamily: MONO, fontSize: 11, letterSpacing: 1,
            color: sort === 'new' ? ACCENT : FAINT,
          }}
        >
          <Clock size={13} /> 最新
        </button>
        <button
          onClick={() => setSort('hot')}
          title="按热度"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, background: 'none', cursor: 'pointer',
            border: 'none', padding: '2px 4px',
            fontFamily: MONO, fontSize: 11, letterSpacing: 1,
            color: sort === 'hot' ? ACCENT : FAINT,
          }}
        >
          <Flame size={13} /> 最热
        </button>
        <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: 2, minWidth: 62, textAlign: 'right' }}>
          {String(list.length).padStart(2, '0')} POSTS
        </span>
      </div>

      {botBusy && (
        <div style={{ fontFamily: MONO, fontSize: 11, color: FAINT, letterSpacing: 1, marginBottom: 12 }}>
          社区同学正在更新…
        </div>
      )}

      {list.length === 0 && !botBusy && (
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
                loading="lazy"
                style={{ width: '100%', height: 150, objectFit: 'cover', border: `1px solid #e8e8e8`, borderRadius: 2, marginBottom: 12, background: '#efefef' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: 150,
                  border: `1px solid #e8e8e8`,
                  borderRadius: 2,
                  marginBottom: 12,
                  background: '#f2f2f2',
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, letterSpacing: 2 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: FAINT, letterSpacing: 1 }}>
                {relTime(p.created_at)}
              </span>
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
                {p.author_avatar ? (
                  <img src={p.author_avatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${INK}` }} />
                ) : (
                  <span style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${INK}`, display: 'inline-block', background: '#efefef' }} />
                )}
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
