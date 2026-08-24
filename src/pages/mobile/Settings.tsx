import { useNavigate } from 'react-router-dom'
import { ChevronLeft, User, Shield, LogOut, Info, Bell, Camera } from 'lucide-react'
import { useStore, compressImageToDataUrl } from '../../store/store'
import { useMe } from '../../store/useMe'

export default function Settings() {
  const nav = useNavigate()
  const me = useMe()
  const logout = useStore(s => s.logout)
  const switchRole = useStore(s => s.switchRole)
  const updateProfile = useStore(s => s.updateProfile)
  const isGuest = !me.qq
  const isAdmin = me.role === 'admin'

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const dataUrl = await compressImageToDataUrl(file, 256, 0.82)
    if (dataUrl) await updateProfile({ avatar: dataUrl })
  }

  return (
    <div className="wx-chat">
      <header className="wx-chat-header">
        <button className="wx-chat-back" onClick={() => nav(-1)} aria-label="返回"><ChevronLeft size={22} /></button>
        <div className="wx-chat-title"><div className="wx-chat-name">设置</div></div>
        <span />
      </header>

      <div className="wx-chat-body" style={{ background: '#f5f5f5' }}>
        {/* 账号 */}
        <div className="card mt-3 divide-y divide-gray-50">
          <div className="flex items-center gap-3 px-4 py-3.5">
            {me.avatar ? (
              <img src={me.avatar} className="w-12 h-12 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-xl text-brand-600">
                {me.nickname.slice(0, 1)}
              </div>
            )}
            <div className="flex-1">
              <div className="text-sm font-medium">{me.nickname}</div>
              <div className="text-xs text-gray-400">{isGuest ? '未登录' : `QQ ${me.qq}`}</div>
            </div>
            {!isGuest && (
              <label className="text-brand-600 text-sm flex items-center gap-1">
                <Camera size={16} /> 换头像
                <input type="file" accept="image/*" hidden onChange={onAvatar} />
              </label>
            )}
          </div>
        </div>

        {/* 功能 */}
        <div className="card mt-3 divide-y divide-gray-50">
          <button onClick={() => nav('/notifications')} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
            <Bell size={20} className="text-gray-500" /><span className="flex-1 text-sm">消息通知</span>
          </button>
          <button onClick={() => nav('/about')} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
            <Info size={20} className="text-gray-500" /><span className="flex-1 text-sm">关于择校通</span>
          </button>
          {isAdmin && (
            <button onClick={() => nav('/admin')} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
              <Shield size={20} className="text-gray-500" /><span className="flex-1 text-sm">管理后台</span>
            </button>
          )}
          {!isGuest && !isAdmin && (
            <button onClick={() => { switchRole(); nav('/admin') }} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
              <Shield size={20} className="text-gray-500" /><span className="flex-1 text-sm">切换为管理员（演示）</span>
            </button>
          )}
        </div>

        {!isGuest && (
          <button
            onClick={() => { logout(); nav('/splash') }}
            className="w-full mt-3 py-3 text-red-500 text-sm flex items-center justify-center gap-1 rounded-lg bg-white">
            <LogOut size={16} /> 退出登录
          </button>
        )}

        <p className="text-center text-xs text-gray-300 mt-6">择校通 · 校园综合服务</p>
      </div>
    </div>
  )
}
