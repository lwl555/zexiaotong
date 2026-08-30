import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react'
import { useMe } from '../../store/useMe'
import WxIcon from '../../components/mobile/WxIcon'
import {
  FEATURES, fetchFeatureChat, postFeatureChat, ensureSeed, FeatureChatMsg, FeatureRole, FeatureMeta,
} from '../../lib/featureChat'
import {
  PageHeader,
  btnGhost,
  hard,
  INK,
  MUTED,
  FAINT,
  ACCENT,
  HAIR,
  FONT,
  MONO,
} from '../../components/Editorial'

// 每条消息显示时分（微信聊天风格）
function timeLabel(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// 单条消息气泡：按角色区分（系统/用户/管理员）
function Bubble({ m, meId, meta }: { m: FeatureChatMsg; meId: string; meta: FeatureMeta }) {
  const time = timeLabel(m.created_at)
  if (m.author_role === 'system') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
        <div style={{ maxWidth: '88%', textAlign: 'center', fontFamily: FONT, fontSize: 12, lineHeight: 1.6, color: MUTED, background: 'rgba(17,17,17,0.04)', borderRadius: 3, padding: '8px 12px' }}>
          {m.content}
          {time && <div style={{ fontFamily: FONT, fontSize: 10, color: FAINT, marginTop: 4 }}>{time}</div>}
        </div>
      </div>
    )
  }
  const mine = m.author_role === 'user' && m.author_id === meId
  if (mine) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{ maxWidth: '72%', padding: '10px 14px', borderRadius: 3, borderBottomRightRadius: 0, fontFamily: FONT, fontSize: 15, lineHeight: 1.6, color: '#ffffff', background: ACCENT, border: `2px solid ${INK}` }}
        >
          {m.content}
          {time && <div style={{ fontFamily: FONT, fontSize: 10, color: 'rgba(255,255,255,0.75)', textAlign: 'right', marginTop: 4 }}>{time}</div>}
        </div>
      </div>
    )
  }
  // 管理员 / 其他（左白气泡，带头像 + 名称）
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <WxIcon icon={meta.icon} size={36} />
      <div style={{ maxWidth: '72%' }}>
        <div style={{ fontFamily: FONT, fontSize: 11, color: MUTED, marginBottom: 4 }}>{m.author_role === 'admin' ? '管理员' : m.author_name}</div>
        <div style={{ padding: '10px 14px', borderRadius: 3, borderBottomLeftRadius: 0, fontFamily: FONT, fontSize: 15, lineHeight: 1.6, color: INK, background: '#ffffff', border: `1.5px solid ${HAIR}` }}>
          {m.content}
          {time && <div style={{ fontFamily: FONT, fontSize: 10, color: MUTED, marginTop: 4 }}>{time}</div>}
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
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)

  // 拉取服务端消息，并保留本地临时消息（正在发送中、尚未被服务端确认）
  const pull = async () => {
    const list = await fetchFeatureChat(id)
    setMsgs(prev => {
      const tmp = prev.filter(m => m.id.startsWith('tmp-'))
      return tmp.length ? [...tmp, ...list] : list
    })
  }

  // 带 loading / refreshing UI 态的拉取（首屏 & 手动刷新用）
  const load = async (silent = false) => {
    if (sendingRef.current) return
    if (silent) setRefreshing(true); else setLoading(true)
    await pull()
    if (silent) setRefreshing(false); else setLoading(false)
  }

  useEffect(() => {
    if (!meta) { nav('/', { replace: true }); return }
    let alive = true
    ;(async () => {
      setLoading(true)
      await ensureSeed(id, meta.notifications, `择校通·${meta.name}`)
      const list = await fetchFeatureChat(id)
      if (alive) { setMsgs(list); setLoading(false) }
    })()
    // 轻量轮询：管理员后台下发后用户端能即时看到（每 12s，发送中不覆盖）
    const timer = setInterval(() => { if (alive && !sendingRef.current) pull() }, 12000)
    return () => { alive = false; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, loading])

  if (!meta || !me) return null

  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    setError('')
    setSending(true); sendingRef.current = true
    const row = {
      feature: id,
      author_role: 'user' as FeatureRole,
      author_id: me.id,
      author_name: me.nickname || '我',
      content: t,
    }
    const tmpId = 'tmp-' + Date.now()
    setText('')
    // 乐观更新
    setMsgs(m => [...m, { ...row, id: tmpId, created_at: new Date().toISOString() }])
    const ok = await postFeatureChat(row)
    if (!ok) {
      // 失败：回滚乐观消息 + 提示 + 恢复输入，让用户明确知道没发出去
      setMsgs(m => m.filter(x => x.id !== tmpId))
      setText(t)
      setError('发送失败，请检查网络后重试')
    } else {
      setError('')
      await pull()
    }
    setSending(false); sendingRef.current = false
  }

  return (
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader
        eyebrow="Feature"
        title={meta.name}
        desc="功能通知 · 可回复"
        right={<button onClick={() => nav(-1)} style={btnGhost({ padding: '8px 15px', fontSize: 14 })}>返回</button>}
      />

      {/* 聊天主卡：粗黑边 + 硬阴影 */}
      <div style={{ ...hard(), background: '#ffffff', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 240px)', minHeight: 420, overflow: 'hidden' }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 刷新 + 错误提示条 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: 1 }}>功能通知 · 可回复</span>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONT, fontSize: 11, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', opacity: refreshing ? 0.4 : 1 }}
            >
              <RefreshCw size={13} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} /> 刷新
            </button>
          </div>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT, fontSize: 12, color: ACCENT, background: '#fbeede', border: `1px solid ${ACCENT}`, borderRadius: 2, padding: '8px 12px' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {loading && <div style={{ textAlign: 'center', fontFamily: FONT, fontSize: 12, color: MUTED, padding: '16px 0' }}>加载中…</div>}
          {!loading && msgs.length === 0 && (
            <div style={{ textAlign: 'center', fontFamily: FONT, fontSize: 12, color: MUTED, padding: '16px 0' }}>暂无消息，来留个言吧</div>
          )}
          {msgs.map(m => (
            <Bubble key={m.id} m={m} meId={me.id} meta={meta} />
          ))}
        </div>

        {/* 打开完整功能（醒目入口） */}
        <button
          onClick={() => nav(meta.to)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 12px 12px', padding: '0 16px', height: 48, background: ACCENT, color: '#ffffff', border: `2px solid ${INK}`, borderRadius: 2, fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
        >
          <span>打开完整功能</span>
          <ChevronRight size={20} />
        </button>

        {/* 输入栏 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderTop: `2px solid ${INK}`, background: '#ffffff' }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="回复 / 留言给该功能的负责团队…"
            style={{ flex: 1, height: 40, padding: '0 12px', border: `2px solid ${INK}`, borderRadius: 2, background: '#ffffff', fontFamily: FONT, fontSize: 15, outline: 'none', color: INK }}
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ACCENT, color: '#ffffff', border: `2px solid ${INK}`, borderRadius: 2, cursor: 'pointer', opacity: (!text.trim() || sending) ? 0.4 : 1 }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
