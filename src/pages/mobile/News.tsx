import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'
import {
  PageHeader,
  IndexGrid,
  HardCard,
  BtnGhost,
  INK,
  MUTED,
  ACCENT,
  HAIR,
  FONT,
  MONO,
} from '../../components/Editorial'

// 实时资讯台：聚合社区最新动态作为招生快讯流（复用 store 已加载的 posts）
export default function News() {
  const nav = useNavigate()
  const posts = useStore(s => s.posts)
  const list = posts
    .filter(p => p.status !== 'removed')
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader
        eyebrow="News"
        title="实时资讯台"
        desc="招生快讯、政策变动与社区动态，每日精选。"
        right={<BtnGhost onClick={() => nav('/community')}>去社区 ›</BtnGhost>}
      />

      {list.length === 0 && (
        <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '64px 0' }}>暂无资讯</div>
      )}

      <IndexGrid min={300}>
        {list.map((p, i) => (
          <HardCard key={p.id} onClick={() => nav('/post/' + p.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, letterSpacing: 2, marginBottom: 6 }}>
              {String(i + 1).padStart(2, '0')} · {new Date(p.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
            {p.images?.[0] && (
              <img src={p.images[0]} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', border: `2px solid ${INK}`, borderRadius: 2, marginBottom: 12, background: '#efefef' }} />
            )}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${HAIR}` }}>
              <img src={p.author_avatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${INK}`, background: '#efefef' }} onError={(e: any) => { e.currentTarget.style.visibility = 'hidden' }} />
              <span style={{ fontFamily: FONT, fontSize: 12, color: MUTED }}>{p.author_name}</span>
            </div>
          </HardCard>
        ))}
      </IndexGrid>
    </div>
  )
}
