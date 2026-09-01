import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Shield, LogOut, Info, Bell } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
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

export default function Settings() {
  const nav = useNavigate()
  const me = useMe()
  const logout = useStore(s => s.logout)
  const switchRole = useStore(s => s.switchRole)
  const isGuest = !me.qq
  const isAdmin = me.role === 'admin'
  const [avatarErr, setAvatarErr] = useState(false)

  return (
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader eyebrow="Settings" title="设置" desc="账号信息、通知与账号安全。" />

      {/* 账号卡 */}
      <HardCard style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        {me.avatar && !avatarErr ? (
          <img
            src={me.avatar}
            alt=""
            onError={() => setAvatarErr(true)}
            style={{ width: 56, height: 56, borderRadius: '50%', border: `2px solid ${INK}`, objectFit: 'cover', background: '#f4f2ee', flexShrink: 0 }}
          />
        ) : (
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
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {me.nickname.slice(0, 1)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 800, color: INK }}>{me.nickname}</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginTop: 4, letterSpacing: 0.5 }}>
            {isGuest ? '未登录' : `QQ ${me.qq}`}
          </div>
        </div>
      </HardCard>

      {/* 功能 */}
      <SectionLabel label="功能" />
      <SoftCard style={{ padding: 0, marginBottom: 24 }}>
        <ListRow style={{ padding: '14px 16px' }} onClick={() => nav('/notifications')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flex: 1, fontFamily: FONT, fontSize: 14, color: INK }}>
            <Bell size={16} color={MUTED} /> 消息通知
          </span>
          <ChevronRight size={16} color={FAINT} />
        </ListRow>
        <ListRow style={{ padding: '14px 16px' }} onClick={() => nav('/about')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flex: 1, fontFamily: FONT, fontSize: 14, color: INK }}>
            <Info size={16} color={MUTED} /> 关于择校通
          </span>
          <ChevronRight size={16} color={FAINT} />
        </ListRow>
        {isAdmin && (
          <ListRow style={{ padding: '14px 16px' }} onClick={() => nav('/admin')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flex: 1, fontFamily: FONT, fontSize: 14, color: ACCENT }}>
              <Shield size={16} color={ACCENT} /> 管理后台
            </span>
            <ChevronRight size={16} color={FAINT} />
          </ListRow>
        )}
        {!isGuest && !isAdmin && (
          <ListRow style={{ padding: '14px 16px' }} onClick={() => { switchRole(); nav('/admin') }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flex: 1, fontFamily: FONT, fontSize: 14, color: INK }}>
              <Shield size={16} color={MUTED} /> 切换为管理员（演示）
            </span>
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
