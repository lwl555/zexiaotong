import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Send } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'

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
      <div className="px-4 pt-3 pb-10">
        <h1 className="text-xl font-black text-ink mb-4">私信</h1>
        <div className="space-y-1">
          {convs.length === 0 && <div className="text-center text-gray-400 text-sm py-16">暂无会话</div>}
          {convs.map(c => {
            const u = users.find(x => x.id === c.other)
            return (
              <button key={c.other} onClick={() => nav('/messages?peer=' + c.other)} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 text-left">
                <div className="w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-medium shrink-0">{u?.nickname.slice(-1)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{u?.nickname}</div>
                  <div className="text-xs text-gray-400 truncate">{c.content}</div>
                </div>
                {!c.read && c.sender_id !== me.id && <span className="w-2 h-2 rounded-full bg-red-500" />}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // 聊天视图
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex items-center gap-2 px-3 h-12 bg-white border-b shrink-0">
        <button onClick={() => nav('/messages')} className="text-gray-400"><ChevronLeft size={20} /></button>
        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-sm">{peer?.nickname.slice(-1)}</div>
        <div className="font-medium text-sm">{peer?.nickname}</div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-3">
        {chatMsgs.map(m => {
          const mine = m.sender_id === me.id
          return (
            <div key={m.id} className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
              <div className={'max-w-[72%] px-3.5 py-2 rounded-2xl text-sm ' + (mine ? 'bg-brand-500 text-white rounded-br-sm' : 'bg-white text-ink rounded-bl-sm shadow-sm')}>
                {m.content}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 p-3 bg-white border-t">
        <input className="input flex-1" value={text} onChange={e => setText(e.target.value)} placeholder="发消息…" onKeyDown={e => e.key === 'Enter' && send()} />
        <button className="btn-primary w-12 h-11 flex items-center justify-center" onClick={send}><Send size={18} /></button>
      </div>
    </div>
  )
}
