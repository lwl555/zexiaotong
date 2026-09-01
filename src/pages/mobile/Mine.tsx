import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import {
  PageHeader,
  SectionLabel,
  HardCard,
  SoftCard,
  ListRow,
  BtnPrimary,
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
  const myPosted = tasks.filter(t => t.poster_id === me.id).length
  const myTaken = tasks.filter(t => t.accepted_id === me.id).length
  const unread = useStore(s => s.notifications.filter(n => n.user_id === me.id && !n.read).length)
  const logout = useStore(s => s.logout)
  const isGuest = !me.qq

  const myRows = [
    { label: '我的发布', val: myPosted, onClick: () => nav('/my-tasks?role=poster') },
    { label: '我的接单', val: myTaken, onClick: () => nav('/my-tasks?role=worker') },
    { label: 'AI 查询记录', val: 0, onClick: () => nav('/ai-history') },
    { label: '我的收藏', val: 0, onClick: () => nav('/community') },
    { label: '消息通知', val: unread, onClick: () => nav('/notifications') }
  ]

  return (
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
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
              border: `2px solid ${INK}`,
              background: '#f4f2ee',
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
        <HardCard style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <img
            src={me.avatar}
            alt=""
            style={{ width: 56, height: 56, borderRadius: '50%', border: `2px solid ${INK}`, background: '#f4f2ee', flexShrink: 0 }}
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

      <BtnPrimary onClick={() => nav('/wallet')} style={{ width: '100%', marginBottom: 24 }}>
        进入钱包中心
      </BtnPrimary>

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
