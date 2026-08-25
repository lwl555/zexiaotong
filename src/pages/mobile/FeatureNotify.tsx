import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, ChevronRight } from 'lucide-react'
import { useMe } from '../../store/useMe'
import WxIcon from '../../components/mobile/WxIcon'
import {
  FEATURES, fetchFeatureChat, postFeatureChat, ensureSeed, FeatureChatMsg, FeatureRole, FeatureMeta,
} from '../../lib/featureChat'

// 单条消息气泡：按角色区分（系统/用户/管理员）
function Bubble({ m, meId, meta }: { m: FeatureChatMsg; meId: string; meta: FeatureMeta }) {
  if (m.author_role === 'system') {
    return (
      <div className="flex justify-center my-2">
        <div className="max-w-[88%] text-center text-[12px] leading-relaxed text-gray-500 bg-black/[0.04] rounded-lg px-3 py-2">
          {m.content}
        </div>
      </div>
    )
  }
  const mine = m.author_role === 'user' && m.author_id === meId
  if (mine) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[72%] px-3.5 py-2.5 rounded-2xl rounded-br-sm text-[15px] leading-relaxed text-white"
          style={{ background: '#07c160' }}>
          {m.content}
        </div>
      </div>
    )
  }
  // 管理员 / 其他（左白气泡，带头像 + 名称）
  return (
    <div className="flex items-start gap-2">
      <WxIcon icon={meta.icon} color={meta.color} size={36} />
      <div className="max-w-[72%]">
        <div className="text-[11px] text-gray-400 mb-0.5">{m.author_role === 'admin' ? '管理员' : m.author_name}</div>
        <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-[15px] leading-relaxed text-gray-900 bg-white border border-black/5">
          {m.content}
        </div>
      </div>
    </div>
  )
}

export default function FeatureNotify() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const meta = FEATURES[id]
  const [msgs, setMsgs] = useState<FeatureChatMsg[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!meta) { nav('/', { replace: true }); return }
    let alive = true
    ;(async () => {
      setLoading(true)
      await ensureSeed(id, meta.notifications, `择校通·${meta.name}`)
      const list = await fetchFeatureChat(id)
      if (alive) { setMsgs(list); setLoading(false) }
    })()
    return () => { alive = false }
  }, [id])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, loading])

  if (!meta || !me) return null

  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    const row = {
      feature: id,
      author_role: 'user' as FeatureRole,
      author_id: me.id,
      author_name: me.nickname || '我',
      content: t,
    }
    setText('')
    // 乐观更新
    setMsgs(m => [...m, { ...row, id: 'tmp-' + Date.now(), created_at: new Date().toISOString() }])
    await postFeatureChat(row)
    const list = await fetchFeatureChat(id)
    setMsgs(list)
    setSending(false)
  }

  return (
    <div className="flex flex-col bg-[#ededed]" style={{ height: 'calc(100vh - 96px)' }}>
      {/* 聊天区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-3">
        {loading && <div className="text-center text-xs text-gray-400 py-4">加载中…</div>}
        {!loading && msgs.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-4">暂无消息</div>
        )}
        {msgs.map(m => (
          <Bubble key={m.id} m={m} meId={me.id} meta={meta} />
        ))}
      </div>

      {/* 打开完整功能（醒目入口） */}
      <button
        onClick={() => nav(meta.to)}
        className="mx-3 mb-2 flex items-center justify-between px-4 h-12 rounded-xl text-white active:opacity-90"
        style={{ background: meta.color }}
      >
        <span className="font-semibold text-[15px]">打开完整功能</span>
        <ChevronRight size={20} />
      </button>

      {/* 输入栏 */}
      <div className="flex items-center gap-2 p-2.5 bg-white border-t border-black/5">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="回复 / 留言给该功能的负责团队…"
          className="flex-1 h-10 px-3 rounded-full bg-[#f3f3f3] text-[15px] outline-none"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="w-10 h-10 flex items-center justify-center rounded-full text-white disabled:opacity-40"
          style={{ background: '#07c160' }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
