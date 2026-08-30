import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageSquare, ChevronLeft, Share2 } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import {
  SectionLabel,
  Tag,
  BtnPrimary,
  INK,
  MUTED,
  ACCENT,
  HAIR,
  FONT,
} from '../../components/Editorial'

export default function GoodsDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const good = useStore(s => s.goods.find(g => g.id === id))
  const sendMessage = useStore(s => s.sendMessage)
  const [imgIdx, setImgIdx] = useState(0)

  if (!good) return <div style={{ padding: '64px 16px', textAlign: 'center', color: MUTED, fontSize: 14, fontFamily: FONT }}>商品不存在或已下架</div>
  const isMine = good.seller_id === me.id

  const chat = () => {
    if (isMine) return
    sendMessage(good.seller_id, '你好，我想了解一下「' + good.title + '」')
    nav('/messages?peer=' + good.seller_id)
  }

  return (
    <div style={{ padding: '0 2px 88px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      {/* 顶部返回 / 分享 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px', marginBottom: 4 }}>
        <button onClick={() => nav(-1)} style={btnGhostMinimal()} aria-label="返回">
          <ChevronLeft size={20} color={INK} />
        </button>
        <button onClick={() => nav('/')} style={btnGhostMinimal()} aria-label="分享">
          <Share2 size={16} color={INK} />
        </button>
      </div>

      {/* 主图 + 缩略点 */}
      <div style={{ position: 'relative' }}>
        <img
          src={good.images[imgIdx] || ''}
          alt=""
          style={{ width: '100%', height: 260, objectFit: 'cover', border: `2px solid ${INK}`, borderRadius: 2, background: '#efefef', display: 'block' }}
        />
        {good.images.length > 1 && (
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
            {good.images.map((_, i) => (
              <span
                key={i}
                onClick={() => setImgIdx(i)}
                style={{ width: 8, height: 8, borderRadius: '50%', cursor: 'pointer', background: i === imgIdx ? ACCENT : '#ffffff', border: `1.5px solid ${INK}` }}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '18px 6px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 800, color: ACCENT, letterSpacing: '-0.02em' }}>¥{good.price}</div>
          {good.status === 'off' ? (
            <Tag tone="ink">已下架</Tag>
          ) : (
            <Tag tone="line">{good.category}</Tag>
          )}
        </div>
        <h1 style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color: INK, marginTop: 10, lineHeight: 1.2, margin: 0 }}>{good.title}</h1>
        <p style={{ fontFamily: FONT, fontSize: 14, color: MUTED, marginTop: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{good.description}</p>

        {/* 卖家 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, padding: 14, border: `1px solid ${HAIR}`, borderRadius: 3 }}>
          <img src={good.seller_id ? '' : ''} alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${INK}`, background: '#f4f2f2' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>{good.seller_name}</div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 2 }}>卖家</div>
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <SectionLabel label="交易须知" />
          <p style={{ fontFamily: FONT, fontSize: 13, color: MUTED, lineHeight: 1.7, margin: 0 }}>
            本平台仅提供信息撮合，请线下当面交易、自行确认成色与真伪，谨防诈骗。
          </p>
        </div>
      </div>

      {/* 底部操作栏：白底 + 粗黑上边线 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 1200,
          background: '#ffffff',
          borderTop: `2px solid ${INK}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          zIndex: 30,
        }}
      >
        <button onClick={chat} disabled={isMine} style={{ ...btnGhostMinimal(), flexDirection: 'column', gap: 2, opacity: isMine ? 0.4 : 1, cursor: isMine ? 'not-allowed' : 'pointer' }}>
          <MessageSquare size={20} color={INK} />
          <span style={{ fontFamily: FONT, fontSize: 11, color: MUTED }}>私聊</span>
        </button>
        <BtnPrimary onClick={chat} disabled={isMine} style={{ flex: 1, opacity: isMine ? 0.4 : 1, cursor: isMine ? 'not-allowed' : 'pointer' }}>
          {isMine ? '这是你自己发布的' : '我想要（私聊卖家）'}
        </BtnPrimary>
      </div>
    </div>
  )
}

function btnGhostMinimal(): any {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `2px solid ${INK}`,
    borderRadius: 2,
    background: '#ffffff',
    color: INK,
    fontFamily: FONT,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '8px 12px',
  }
}
