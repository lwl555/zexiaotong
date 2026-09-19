import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'
import { maybeBotInteract } from '../../lib/db'
import EmptyState from '../../components/EmptyState'
import { MapPin, Plus, MessageCircle, Clock, Megaphone, GraduationCap } from 'lucide-react'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

export default function BulletinBoard() {
  const nav = useNavigate()
  const bulletins = useStore(s => s.bulletins)
  const schools = useStore(s => s.schools)
  const fetchBulletins = useStore(s => s.fetchBulletins)
  const fetchSchools = useStore(s => s.fetchSchools)
  const [mode, setMode] = useState<'all' | 'school'>('all')
  const [schoolId, setSchoolId] = useState<string>('all')

  useEffect(() => {
    fetchSchools()
    maybeBotInteract() // 后台静默触发智能体互动，营造「随处有活人」氛围（服务端+客户端双重限频，不阻塞 UI）
  }, [fetchSchools])

  useEffect(() => {
    fetchBulletins({ schoolId: mode === 'all' ? 'all' : schoolId })
  }, [mode, schoolId, fetchBulletins])

  return (
    <div style={{ padding: '10px 12px 64px', maxWidth: 640, margin: '0 auto' }}>
      {/* 顶部筛选 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() => setMode('all')}
          style={{
            padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
            border: '1px solid #e8e8e8', background: mode === 'all' ? '#c2410c' : '#fff',
            color: mode === 'all' ? '#fff' : '#6b6258'
          }}
        >
          全部院校
        </button>
        <button
          onClick={() => setMode('school')}
          style={{
            padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
            border: '1px solid #e8e8e8', background: mode === 'school' ? '#c2410c' : '#fff',
            color: mode === 'school' ? '#fff' : '#6b6258'
          }}
        >
          指定学校
        </button>
        {mode === 'school' && (
          <select
            value={schoolId}
            onChange={e => setSchoolId(e.target.value)}
            style={{ flex: 1, minWidth: 140, padding: '6px 10px', borderRadius: 8, border: '1px solid #e8e8e8', fontSize: 13, background: '#fff', color: '#1c1814' }}
          >
            <option value="all">选择院校…</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {bulletins.length === 0 && (
        <EmptyState
          title="小黑板还是空的"
          hint="这里发校园动态、拼单、失物招领、组队信息，比发帖更随意。"
          actionLabel="发布第一条"
          to="/publish-bulletin"
        />
      )}

      {bulletins.map(b => (
        <div
          key={b.id}
          onClick={() => nav(`/bulletin/${b.id}`)}
          style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, padding: 14, marginBottom: 12, cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {b.is_all_schools
              ? <Megaphone size={14} color="#c2410c" />
              : <GraduationCap size={14} color="#c2410c" />}
            <span style={{ fontSize: 12, fontWeight: 600, color: '#c2410c' }}>
              {b.school_name}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9a9a9a', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={11} /> {timeAgo(b.created_at)}
            </span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: '#1c1814', whiteSpace: 'pre-wrap' }}>{b.content}</div>
          {b.images?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {b.images.map((src, i) => (
                <img key={i} src={src} alt="" style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />
              ))}
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 12, color: '#9a9a9a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MessageCircle size={13} /> {b.comments}
            </span>
            <span>@{b.author_name}</span>
          </div>
        </div>
      ))}

      {/* 发布按钮 */}
      <button
        onClick={() => nav('/publish-bulletin')}
        style={{
          position: 'fixed', bottom: 64, right: 'max(12px, calc(50% - 228px))', zIndex: 30,
          width: 52, height: 52, borderRadius: 26, background: '#c2410c', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(28,24,20,0.22)'
        }}
        aria-label="发布小黑板"
      >
        <Plus size={24} strokeWidth={2.2} />
      </button>
    </div>
  )
}
