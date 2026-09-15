import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'
import { Megaphone, GraduationCap, Check } from 'lucide-react'

export default function PublishBulletin() {
  const nav = useNavigate()
  const me = useStore(s => s.me)
  const schools = useStore(s => s.schools)
  const fetchSchools = useStore(s => s.fetchSchools)
  const publishBulletin = useStore(s => s.publishBulletin)

  const [content, setContent] = useState('')
  const [isAll, setIsAll] = useState(true)
  const [schoolId, setSchoolId] = useState('')

  useEffect(() => { fetchSchools() }, [fetchSchools])
  useEffect(() => {
    if (!me) nav('/login')
  }, [me, nav])

  const schoolName = schools.find(s => s.id === schoolId)?.name || ''

  const submit = async () => {
    if (!content.trim()) return
    if (!isAll && !schoolId) { alert('请选择指定学校'); return }
    const r = await publishBulletin({
      content,
      isAll,
      schoolId: isAll ? null : schoolId,
      schoolName: isAll ? '全部院校' : schoolName
    })
    if (r.ok) nav('/bulletins')
    else alert(r.msg)
  }

  return (
    <div style={{ padding: '12px 14px 40px', maxWidth: 640, margin: '0 auto' }} onClick={() => {}}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1c1814', marginBottom: 4 }}>发布到小黑板</div>
      <div style={{ fontSize: 12, color: '#9a9a9a', marginBottom: 14 }}>发布到「全部院校」所有人可见；或指定某一所学校，仅该校同学可见。</div>

      {/* 发布范围 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <RangeCard active={isAll} onClick={() => setIsAll(true)} icon={<Megaphone size={18} color={isAll ? '#fff' : '#c2410c'} />} title="全部院校" desc="所有人可见" />
        <RangeCard active={!isAll} onClick={() => setIsAll(false)} icon={<GraduationCap size={18} color={!isAll ? '#fff' : '#c2410c'} />} title="指定学校" desc="仅该校可见" />
      </div>

      {!isAll && (
        <select
          value={schoolId}
          onChange={e => setSchoolId(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e8e8e8', fontSize: 14, background: '#fff', color: '#1c1814', marginBottom: 14 }}
        >
          <option value="">选择院校…</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="写下你想说的：失物招领、拼单、二手转手、考研搭子、表白墙…"
        rows={8}
        style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: 10, padding: '12px 14px', fontSize: 15, lineHeight: 1.6, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
      />

      <button
        onClick={submit}
        disabled={!content.trim()}
        style={{
          marginTop: 16, width: '100%', padding: '12px', borderRadius: 10, fontSize: 15, fontWeight: 700,
          background: content.trim() ? '#c2410c' : '#ccc', color: '#fff', border: 0, cursor: content.trim() ? 'pointer' : 'not-allowed'
        }}
      >
        发布
      </button>
    </div>
  )
}

function RangeCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, border: `1px solid ${active ? '#c2410c' : '#e8e8e8'}`, background: active ? '#c2410c' : '#fff', color: active ? '#fff' : '#1c1814' }}>
      {icon}
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 11, opacity: 0.8 }}>{desc}</div>
      </div>
      {active && <Check size={16} color="#fff" style={{ marginLeft: 'auto' }} />}
    </button>
  )
}
