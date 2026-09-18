import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Shield, LogOut, Info, Bell, Camera, CheckCircle2, XCircle } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import {
  PageHeader,
  SectionLabel,
  HardCard,
  SoftCard,
  ListRow,
  BtnGhost,
  BtnPrimary,
  INK,
  MUTED,
  FAINT,
  ACCENT,
  FONT,
  MONO,
  LINE,
} from '../../components/Editorial'

// 头像压缩：等比缩到最长边 256px 的 JPEG data URL。
// 与站内其它图片一致直接存 profiles.avatar（data URL），无需额外配置 Storage。
function compressAvatar(file: File, max = 256, quality = 0.85): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onerror = () => rej(new Error('读取图片失败'))
    r.onload = () => {
      const img = new Image()
      img.onerror = () => rej(new Error('图片格式不支持'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) return rej(new Error('无法处理图片'))
        ctx.drawImage(img, 0, 0, w, h)
        res(c.toDataURL('image/jpeg', quality))
      }
      img.src = r.result as string
    }
    r.readAsDataURL(file)
  })
}

export default function Settings() {
  const nav = useNavigate()
  const me = useMe()
  const logout = useStore(s => s.logout)
  const switchRole = useStore(s => s.switchRole)
  const updateProfile = useStore(s => s.updateProfile)
  const isGuest = !me.qq
  const isAdmin = me.role === 'admin'

  const [avatarErr, setAvatarErr] = useState(false)
  const [nickname, setNickname] = useState(me.nickname)
  const [avatar, setAvatar] = useState(me.avatar)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 2500)
  }

  // 切换账号 / 外部刷新 me 后，把编辑框同步回最新值
  useEffect(() => {
    setNickname(me.nickname)
    setAvatar(me.avatar)
    setAvatarErr(false)
  }, [me.nickname, me.avatar])

  const onPickAvatar = async (e: any) => {
    const f: File | undefined = e.target.files?.[0]
    e.target.value = '' // 允许连续选同一张图
    if (!f) return
    if (!f.type.startsWith('image/')) { showToast('err', '请选择图片文件'); return }
    try {
      const url = await compressAvatar(f)
      setAvatar(url)
      setAvatarErr(false)
      showToast('ok', '头像已选好，记得点「保存修改」')
    } catch (err: any) {
      showToast('err', err?.message || '图片处理失败')
    }
  }

  const save = async () => {
    const nick = nickname.trim()
    if (!nick) { showToast('err', '昵称不能为空'); return }
    if (nick.length > 20) { showToast('err', `昵称最多 20 个字（当前 ${nick.length}）`); return }
    if (nick === me.nickname && avatar === me.avatar) { showToast('err', '没有改动需要保存'); return }
    setBusy(true)
    const r = await updateProfile({ nickname: nick, avatar })
    setBusy(false)
    showToast(r.ok ? 'ok' : 'err', r.ok ? '资料已更新' : r.msg)
  }

  const avatarBox = (size: number) =>
    avatar && !avatarErr ? (
      <img
        src={avatar}
        alt=""
        onError={() => setAvatarErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', border: `1px solid ${LINE}`, objectFit: 'cover', background: '#f2f2f2', flexShrink: 0 }}
      />
    ) : (
      <div
        style={{
          width: size, height: size, borderRadius: '50%', border: `1px solid ${LINE}`,
          background: '#f2f2f2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: FONT, fontWeight: 700, color: MUTED, fontSize: size / 3, flexShrink: 0,
        }}
      >
        {(nickname || me.nickname || '?').slice(0, 1)}
      </div>
    )

  return (
    <div style={{ padding: '8px 16px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      {toast && (
        <div
          style={{
            position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px',
            borderRadius: 6, fontFamily: FONT, fontSize: 13, fontWeight: 600,
            border: `1px solid ${toast.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
            background: toast.type === 'ok' ? '#f0fdf4' : '#fef2f2',
            color: toast.type === 'ok' ? '#15803d' : '#b91c1c',
          }}
        >
          {toast.type === 'ok' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      <PageHeader eyebrow="Settings" title="设置" desc="账号信息、通知与账号安全。" />

      {/* 账号卡 */}
      <HardCard style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div
          onClick={() => { if (!isGuest) fileRef.current?.click() }}
          style={{ position: 'relative', cursor: isGuest ? 'default' : 'pointer', flexShrink: 0 }}
          title={isGuest ? undefined : '点击更换头像'}
        >
          {avatarBox(56)}
          {!isGuest && (
            <span
              style={{
                position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: '50%',
                background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #fff',
              }}
            >
              <Camera size={11} color="#fff" />
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 800, color: INK }}>{me.nickname}</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginTop: 4, letterSpacing: 0.5 }}>
            {isGuest ? '未登录' : `QQ ${me.qq}`}
          </div>
        </div>
      </HardCard>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickAvatar} />

      {/* 个人资料（编辑） */}
      <SectionLabel label="个人资料" />
      {isGuest ? (
        <SoftCard style={{ padding: 16, marginBottom: 24 }}>
          <div style={{ fontFamily: FONT, fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
            当前是访客模式，资料无法保存。登录后即可修改昵称与头像。
          </div>
          <div style={{ marginTop: 12 }}>
            <BtnPrimary onClick={() => nav('/login')}>去登录</BtnPrimary>
          </div>
        </SoftCard>
      ) : (
        <SoftCard style={{ padding: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            {avatarBox(44)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT, fontSize: 13, color: INK, fontWeight: 600 }}>头像</div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: FAINT, marginTop: 3 }}>
                建议正方形图片，会自动压到 256px
              </div>
            </div>
            <BtnGhost onClick={() => fileRef.current?.click()} style={{ flexShrink: 0 }}>更换</BtnGhost>
          </div>

          <div style={{ fontFamily: FONT, fontSize: 13, color: INK, fontWeight: 600, marginBottom: 8 }}>昵称</div>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            maxLength={20}
            placeholder="输入昵称（最多 20 字）"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontFamily: FONT,
              fontSize: 15, color: INK, background: '#fff', border: `1px solid ${LINE}`,
              borderRadius: 4, outline: 'none',
            }}
          />
          <div style={{ fontFamily: MONO, fontSize: 11, color: FAINT, marginTop: 6, textAlign: 'right' }}>
            {nickname.length}/20
          </div>

          <div style={{ marginTop: 14 }}>
            <BtnPrimary onClick={save} disabled={busy} style={{ width: '100%' }}>
              {busy ? '保存中…' : '保存修改'}
            </BtnPrimary>
          </div>
        </SoftCard>
      )}

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
