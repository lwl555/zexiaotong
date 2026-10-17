import { useEffect, useState } from 'react'
import { X, Megaphone } from 'lucide-react'
import { fetchAnnouncements, type Announcement } from '../lib/db'

const DISMISS_KEY = 'zex:ann:dismissed'

function loadDismissed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}
function saveDismissed(map: Record<string, boolean>) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

// 全站公告横幅：挂在前台外壳顶部。读取 active 公告，按 priority 取第一条未关闭的展示。
// - once_only=true（后台「每次不提醒」）：关闭后永久不再弹出（localStorage）。
// - once_only=false（常驻公告）：关闭仅隐藏本次会话，下次访问仍提示。
export default function AnnouncementBanner() {
  const [list, setList] = useState<Announcement[]>([])
  const [dismissedSession, setDismissedSession] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchAnnouncements()
      .then((d) => {
        if (alive) setList(d)
      })
      .catch(() => {
        /* 公告读取失败不应阻断主界面 */
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const dismissedOnce = loadDismissed()
  const current = list.find((a) => !dismissedOnce[a.id] && !dismissedSession.has(a.id))

  if (loading || !current) return null

  const close = () => {
    if (current.once_only) {
      const map = loadDismissed()
      map[current.id] = true
      saveDismissed(map)
      setList((l) => l.filter((a) => a.id !== current.id))
    } else {
      setDismissedSession((s) => new Set(s).add(current.id))
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        background: '#ffffff',
        borderBottom: '1px solid #e8e8e8',
        padding: '10px 40px 10px 14px'
      }}
    >
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#c2410c' }} />
      <Megaphone size={16} style={{ color: '#c2410c', marginTop: 2, flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        {current.title && (
          <div style={{ fontWeight: 700, color: '#1c1814', fontSize: 14, marginBottom: 2 }}>{current.title}</div>
        )}
        <div style={{ color: '#4a463f', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {current.content}
        </div>
      </div>
      <button
        onClick={close}
        aria-label="关闭公告"
        style={{
          position: 'absolute',
          right: 10,
          top: 8,
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          color: '#9a948a',
          cursor: 'pointer'
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
