import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageSquare, ChevronLeft, Share2, Flag } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import { sharePage } from '../../lib/share'
import { toast } from '../../lib/toast'
import ReportSheet from '../../components/ReportSheet'
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
  const users = useStore(s => s.users)
  const sendMessage = useStore(s => s.sendMessage)
  const [imgIdx, setImgIdx] = useState(0)
  const [showReport, setShowReport] = useState(false)

  if (!good) return <div style={{ padding: '64px 16px', textAlign: 'center', color: MUTED, fontSize: 14, fontFamily: FONT }}>商品不存在或已下架</div>
  const isMine = good.seller_id === me.id
  // 卖家头像：此前写死 `good.seller_id ? '' : ''`（恒为空串），头像永远空白；这里真正取用户头像，取不到则退回首字母圆标
  const seller = users.find((u) => u.id === good.seller_id)
  const sellerAvatar = (seller as any)?.avatar || (good as any).seller_avatar || ''

  const share = async () => {
    const r = await sharePage({ title: good.title, text: `「${good.title}」${good.price} 积分 · 择校通二手集市` })
    if (r === 'copied') toast('链接已复制，快去分享给同学吧')
    else if (r === 'failed') toast('分享失败，请手动复制浏览器地址')
  }

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
        <button onClick={share} style={btnGhostMinimal()} aria-label="分享">
          <Share2 size={16} color={INK} />
        </button>
      </div>

      {/* 主图 + 缩略点 */}
      <div style={{ position: 'relative' }}>
        <img
          src={good.images[imgIdx] || ''}
          alt=""
          style={{ width: '100%', height: 260, objectFit: 'cover', border: `1px solid #e8e8e8`, borderRadius: 2, background: '#efefef', display: 'block' }}
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
          <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 800, color: ACCENT, letterSpacing: '-0.02em' }}>{good.price} 积分</div>
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
          {sellerAvatar ? (
            <img src={sellerAvatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${INK}`, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${INK}`, background: '#f4f2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontSize: 15, fontWeight: 700, color: INK }}>
              {(good.seller_name || '?').slice(-1)}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>{good.seller_name}</div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 2 }}>卖家</div>
          </div>
          {!isMine && (
            <button
              onClick={() => { if (!me?.id) { nav('/login'); return } setShowReport(true) }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 12, color: MUTED, padding: 4 }}
            >
              <Flag size={13} /> 举报
            </button>
          )}
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
          borderTop: `1px solid #e8e8e8`,
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

      {/* 举报弹层：真实写入 reports 表 */}
      <ReportSheet
        open={showReport}
        onClose={() => setShowReport(false)}
        targetType="goods"
        targetId={good.id}
        targetTitle={good.title}
      />
    </div>
  )
}

function btnGhostMinimal(): any {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid #e8e8e8`,
    borderRadius: 2,
    background: '#ffffff',
    color: INK,
    fontFamily: FONT,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '8px 12px',
  }
}
