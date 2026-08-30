import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Send } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import {
  PageHeader,
  ListRow,
  BtnPrimary,
  INK,
  MUTED,
  ACCENT,
  HAIR,
  FONT,
  PAPER,
} from '../../components/Editorial'

export default function Messages() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const peerId = params.get('peer')
  const me = useMe()
  const users = useStore(s => s.users)
  const messages = useStore(s => s.messages)
  const sendMessage = useStore(s => s.sendMessage)
  const markRead = useStore(s => s.markRead)
  const [text, setText] = useState('')

  const peer = users.find(u => u.id === peerId)

  // 会话列表：按 conv_id 聚合
  const convMap = new Map<string, any>()
  messages.forEach(m => {
    const other = m.sender_id === me.id ? m.receiver_id : m.sender_id
    if (m.sender_id !== me.id && !m.read) markRead(m.id)
    if (!convMap.has(other) || m.created_at > convMap.get(other).created_at)
      convMap.set(other, { other, ...m })
  })
  const convs = Array.from(convMap.values())

  useEffect(() => {
    if (peerId) messages.filter(m => m.sender_id === peerId && m.receiver_id === me.id && !m.read).forEach(m => markRead(m.id))
  }, [peerId])

  const chatMsgs = peerId
    ? messages.filter(m => (m.sender_id === me.id && m.receiver_id === peerId) || (m.sender_id === peerId && m.receiver_id === me.id))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    : []

  const send = () => {
    if (!text.trim() || !peerId) return
    sendMessage(peerId, text.trim())
    setText('')
  }

  // 会话列表视图
  if (!peerId) {
    return (
      <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
        <PageHeader eyebrow="Messages" title="私信" desc="和接单伙伴、护考前辈一对一聊聊。" />
        {convs.length === 0 && (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '64px 0' }}>暂无会话</div>
        )}
        <div>
          {convs.map(c => {
            const u = users.find(x => x.id === c.other)
            const unreadDot = !c.read && c.sender_id !== me.id
            return (
              <ListRow key={c.other} style={{ cursor: 'pointer' }} onClick={() => nav('/messages?peer=' + c.other)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      border: `2px solid ${INK}`,
                      background: PAPER,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: FONT,
                      fontWeight: 700,
                      color: INK,
                      fontSize: 15,
                      flexShrink: 0,
                    }}
                  >
                    {u?.nickname?.slice(-1) || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>{u?.nickname}</div>
                    <div style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.content}
                    </div>
                  </div>
                </div>
                {unreadDot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, flexShrink: 0 }} />}
              </ListRow>
            )
          })}
        </div>
      </div>
    )
  }

  // 聊天视图
  return (
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button onClick={() => nav('/messages')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'inline-flex' }}>
          <ChevronLeft size={20} />
        </button>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: `2px solid ${INK}`,
            background: PAPER,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT,
            fontWeight: 700,
            color: INK,
            fontSize: 13,
          }}
        >
          {peer?.nickname?.slice(-1) || '?'}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: INK }}>{peer?.nickname}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: 'calc(100vh - 210px)', overflowY: 'auto', paddingBottom: 8 }}>
        {chatMsgs.map(m => {
          const mine = m.sender_id === me.id
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  maxWidth: '72%',
                  padding: '10px 14px',
                  borderRadius: mine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  fontFamily: FONT,
                  fontSize: 14,
                  lineHeight: 1.5,
                  ...(mine
                    ? { background: ACCENT, color: '#ffffff' }
                    : { background: PAPER, color: INK, border: `1.5px solid ${INK}` }),
                }}
              >
                {m.content}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, borderTop: `1px solid ${HAIR}`, paddingTop: 14 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="发消息…"
          onKeyDown={e => e.key === 'Enter' && send()}
          style={{ flex: 1, border: `2px solid ${INK}`, borderRadius: 2, padding: '10px 12px', fontFamily: FONT, fontSize: 14, outline: 'none', color: INK, background: PAPER }}
        />
        <BtnPrimary onClick={send} style={{ padding: '10px 14px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Send size={16} /> 发送
          </span>
        </BtnPrimary>
      </div>
    </div>
  )
}

