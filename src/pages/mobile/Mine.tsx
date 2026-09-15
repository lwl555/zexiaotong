import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ChevronRight, CalendarCheck, Flame, Gift } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import { getQueries } from '../../lib/history'
import { fetchCheckinStatus } from '../../lib/db'
import {
  PageHeader,
  SectionLabel,
  HardCard,
  SoftCard,
  ListRow,
  BtnGhost,
  INK,
  MUTED,
  FAINT,
  ACCENT,
  FONT,
  MONO,
} from '../../components/Editorial'

const aiTools = [
  { to: '/chat', label: 'AI 聊天' },
  { to: '/ai-search', label: 'AI 百事通' },
  { to: '/ai-tangdou', label: '糖豆·学习搭子' },
  { to: '/ai-tutor', label: '学习导师' },
  { to: '/document-workshop', label: '文档工坊' },
  { to: '/warnings', label: '避雷清单' },
  { to: '/money', label: '搞钱项目' },
  { to: '/about', label: '关于我们' }
]

export default function Mine() {
  const nav = useNavigate()
  const me = useMe()
  const tasks = useStore(s => s.tasks)
  const posts = useStore(s => s.posts)
  const myPosted = tasks.filter(t => t.poster_id === me.id).length
  const myTaken = tasks.filter(t => t.accepted_id === me.id).length
  const myCollected = posts.filter(p => p.collected).length
  const queryCount = getQueries().length
  const unread = useStore(s => s.notifications.filter(n => n.user_id === me.id && !n.read).length)
  const logout = useStore(s => s.logout)
  const isGuest = !me.qq
  const checkin = useStore(s => s.checkin)
  const doCheckIn = useStore(s => s.checkIn)
  const [ciBusy, setCiBusy] = useState(false)
  const [ciDone, setCiDone] = useState<{ points: number; streak: number; weekBonus: number } | null>(null)

  // 进入页面拉取签到状态（登录后）
  useEffect(() => {
    if (isGuest || !me?.id) return
    fetchCheckinStatus(me.id)
      .then(status => useStore.setState({ checkin: status }))
      .catch(() => {})
  }, [isGuest, me?.id])

  const onCheckIn = async () => {
    if (ciBusy) return
    setCiBusy(true)
    try {
      const r = await doCheckIn()
      if (r) setCiDone(r)
    } catch {
      /* 失败静默，UI 不报错 */
    } finally {
      setCiBusy(false)
      setTimeout(() => setCiDone(null), 3500)
    }
  }

  const myRows = [
    { label: '我的发布', val: myPosted, onClick: () => nav('/my-tasks?role=poster') },
    { label: '我的接单', val: myTaken, onClick: () => nav('/my-tasks?role=worker') },
    { label: 'AI 查询记录', val: queryCount, onClick: () => nav('/ai-history') },
    { label: '我的收藏', val: myCollected, onClick: () => nav('/community') },
    { label: '消息通知', val: unread, onClick: () => nav('/notifications') }
  ]

  return (
    <div style={{ padding: '8px 16px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader eyebrow="Mine" title="我的" desc="账号、任务与择校通 AI 工具，一站式入口。" />

      {/* 头部：用户卡片 */}
      {isGuest ? (
        <HardCard
          onClick={() => nav('/login')}
          style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', marginBottom: 24 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: `1px solid #e8e8e8`,
              background: '#f2f2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONT,
              fontWeight: 700,
              color: MUTED,
              fontSize: 15,
              flexShrink: 0,
            }}
          >
            登录
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: INK }}>未登录</div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: ACCENT, marginTop: 4 }}>
              点击登录 / 注册，解锁发任务、接单、钱包
            </div>
          </div>
          <ChevronRight size={18} color={FAINT} />
        </HardCard>
      ) : (
        <HardCard style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src={me.avatar}
              alt=""
              style={{ width: 56, height: 56, borderRadius: '50%', border: `1px solid #e8e8e8`, background: '#f2f2f2', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: INK }}>{me.nickname}</div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 4 }}>
                {me.qq} · {me.status === 'banned' ? '已封禁' : '正常'}
              </div>
            </div>
            <BtnGhost onClick={() => nav('/wallet')} style={{ padding: '7px 12px', color: ACCENT, borderColor: ACCENT }}>
              钱包
            </BtnGhost>
          </div>
          {/* 三格统计：发布 / 接单 / 可用余额 */}
          <div style={{ display: 'flex', marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(28,24,20,0.08)' }}>
            {[
              { v: String(myPosted), l: '发布', to: '/my-tasks?role=poster' },
              { v: String(myTaken), l: '接单', to: '/my-tasks?role=worker' },
              { v: (me.balance ?? 0).toLocaleString() + ' 积分', l: '可用', to: '/wallet' },
            ].map((s, i) => (
              <div
                key={s.l}
                onClick={() => nav(s.to)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderLeft: i > 0 ? '1px solid rgba(28,24,20,0.08)' : 'none',
                }}
              >
                <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: i === 2 ? ACCENT : INK }}>{s.v}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: 2, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </HardCard>
      )}

      {/* 签到卡片 */}
      {!isGuest && (
        <HardCard style={{ marginBottom: 24, borderColor: ciDone ? ACCENT : '#e8e8e8' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CalendarCheck size={22} color={ACCENT} />
              <div>
                <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 800, color: INK }}>每日签到</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: 1, marginTop: 2 }}>
                  连续 {checkin.streak} 天 · 满 7 天额外 +50
                </div>
              </div>
            </div>
            {checkin.checkedToday ? (
              <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>今日已签 ✓</div>
            ) : (
              <BtnGhost
                onClick={onCheckIn}
                disabled={ciBusy}
                style={{
                  padding: '9px 16px',
                  color: '#fff',
                  background: ACCENT,
                  borderColor: ACCENT,
                  opacity: ciBusy ? 0.6 : 1,
                }}
              >
                {ciBusy ? '签到中…' : `签到 +${checkin.nextPoints}`}
              </BtnGhost>
            )}
          </div>

          {ciDone && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid rgba(28,24,20,0.08)',
                fontFamily: FONT,
                fontSize: 13,
                color: ACCENT,
                fontWeight: 700,
              }}
            >
              签到成功 +{ciDone.points} 积分（连续 {ciDone.streak} 天）
              {ciDone.weekBonus ? ` · 周奖励 +${ciDone.weekBonus}` : ''}
            </div>
          )}

          {/* 近 7 天连签小条 */}
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            {[6, 5, 4, 3, 2, 1, 0].map((off) => {
              const d = new Date()
              d.setDate(d.getDate() - off)
              const key = d.toISOString().slice(0, 10)
              const hit = checkin.recent.some((r) => r.checkin_date === key)
              return (
                <div
                  key={key}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '6px 0',
                    borderRadius: 4,
                    border: '1px solid #e8e8e8',
                    background: hit ? 'rgba(194,65,12,0.08)' : '#fff',
                    color: hit ? ACCENT : FAINT,
                    fontFamily: MONO,
                    fontSize: 10,
                  }}
                >
                  {['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}
                </div>
              )
            })}
          </div>
        </HardCard>
      )}

      {/* 我的模块 */}
      <SectionLabel label="我的模块" />
      <SoftCard style={{ padding: 0, marginBottom: 24 }}>
        {myRows.map(r => (
          <ListRow key={r.label} style={{ cursor: 'pointer', padding: '14px 16px' }} onClick={r.onClick}>
            <span style={{ flex: 1, fontFamily: FONT, fontSize: 14, color: INK }}>{r.label}</span>
            {r.val > 0 && <span style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, letterSpacing: 1, marginRight: 8 }}>{r.val} 条</span>}
            <ChevronRight size={16} color={FAINT} />
          </ListRow>
        ))}
      </SoftCard>

      {/* 择校通 AI 工具 */}
      <SectionLabel label="择校通 · AI 工具" />
      <SoftCard style={{ padding: 0, marginBottom: 24 }}>
        {aiTools.map(t => (
          <ListRow key={t.to} style={{ cursor: 'pointer', padding: '14px 16px' }} onClick={() => nav(t.to)}>
            <span style={{ flex: 1, fontFamily: FONT, fontSize: 14, color: INK }}>{t.label}</span>
            <ChevronRight size={16} color={FAINT} />
          </ListRow>
        ))}
      </SoftCard>

      {/* 设置 */}
      <SectionLabel label="设置" />
      <SoftCard style={{ padding: 0, marginBottom: 24 }}>
        <ListRow style={{ cursor: 'pointer', padding: '14px 16px' }} onClick={() => nav('/settings')}>
          <span style={{ flex: 1, fontFamily: FONT, fontSize: 14, color: INK }}>设置中心</span>
          <ChevronRight size={16} color={FAINT} />
        </ListRow>
        {me.role === 'admin' && (
          <ListRow style={{ cursor: 'pointer', padding: '14px 16px' }} onClick={() => nav('/admin')}>
            <span style={{ flex: 1, fontFamily: FONT, fontSize: 14, color: ACCENT }}>进入管理后台</span>
            <ChevronRight size={16} color={FAINT} />
          </ListRow>
        )}
      </SoftCard>

      {!isGuest && (
        <BtnGhost onClick={() => { logout(); nav('/splash') }} style={{ width: '100%', color: MUTED }}>
          退出登录
        </BtnGhost>
      )}
      <p style={{ textAlign: 'center', fontFamily: MONO, fontSize: 11, color: FAINT, marginTop: 24, letterSpacing: 1 }}>
        择校通 · 校园综合服务
      </p>
    </div>
  )
}
