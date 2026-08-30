import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, MessageSquare, ArrowDownWideNarrow } from 'lucide-react'
import { useStore } from '../../store/store'
import {
  PageHeader,
  SectionLabel,
  IndexGrid,
  HardCard,
  BtnPrimary,
  Tag,
  btnGhost,
  INK,
  MUTED,
  FAINT,
  ACCENT,
  FONT,
  MONO,
} from '../../components/Editorial'

export default function GoodsList() {
  const nav = useNavigate()
  const goods = useStore(s => s.goods)
  const categories = useStore(s => s.categories)
  const cats = categories.filter(c => c.kind === 'goods')
  const [kw, setKw] = useState('')
  const [cat, setCat] = useState('全部')
  const [sort, setSort] = useState<'new' | 'priceAsc' | 'priceDesc'>('new')

  let list = goods.filter(g => g.status !== 'removed')
  if (cat !== '全部') list = list.filter(g => g.category === cat)
  if (kw) list = list.filter(g => g.title.includes(kw) || g.description.includes(kw))
  list = [...list].sort((a, b) => {
    if (sort === 'priceAsc') return a.price - b.price
    if (sort === 'priceDesc') return b.price - a.price
    return b.created_at.localeCompare(a.created_at)
  })

  return (
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader
        eyebrow="Marketplace"
        title="二手集市"
        desc="校园闲置流转，好物不浪费。"
        right={
          <BtnPrimary onClick={() => nav('/publish-goods')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> 发布
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
          placeholder="搜索二手好物"
          style={{ flex: 1, border: 'none', outline: 'none', fontFamily: FONT, fontSize: 15, color: INK, background: 'transparent' }}
        />
        <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: 2 }}>
          {String(list.length).padStart(2, '0')} ITEMS
        </span>
      </div>

      {/* 分类筛选 + 排序 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', marginBottom: 20 }}>
        {['全部', ...cats.map(c => c.name)].map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            style={
              cat === c
                ? { ...btnGhost({ padding: '7px 14px', fontSize: 13, background: ACCENT, color: '#ffffff', borderColor: INK }), whiteSpace: 'nowrap' }
                : { ...btnGhost({ padding: '7px 14px', fontSize: 13 }), whiteSpace: 'nowrap' }
            }
          >
            {c}
          </button>
        ))}
        <button
          onClick={() => setSort(s => (s === 'priceAsc' ? 'priceDesc' : s === 'priceDesc' ? 'new' : 'priceAsc'))}
          style={{ ...btnGhost({ padding: '7px 14px', fontSize: 12, marginLeft: 'auto', whiteSpace: 'nowrap' }), display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowDownWideNarrow size={14} />
          {sort === 'new' ? '最新' : sort === 'priceAsc' ? '价格↑' : '价格↓'}
        </button>
      </div>

      <SectionLabel label="商品" />
      <IndexGrid min={220}>
        {list.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: MUTED, fontSize: 14, padding: '64px 0' }}>
            暂无商品
          </div>
        )}
        {list.map((g, i) => (
          <HardCard key={g.id} onClick={() => nav('/goods/' + g.id)} style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
            {g.images[0] ? (
              <img
                src={g.images[0]}
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
                  background: '#f4f2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: MONO,
                  fontSize: 11,
                  color: FAINT,
                  letterSpacing: 2,
                }}
              >
                NO IMAGE
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, letterSpacing: 2 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {g.status === 'off' && <Tag tone="ink">已下架</Tag>}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: INK, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
              {g.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <span style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: ACCENT }}>¥{g.price}</span>
              <Tag tone="line">{g.category}</Tag>
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 8 }}>{g.seller_name}</div>
          </HardCard>
        ))}
      </IndexGrid>
    </div>
  )
}
