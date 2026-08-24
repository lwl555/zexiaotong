import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet as WalletIcon, ListOrdered, Package, Heart, Settings, Shield, LogOut, ChevronRight, Megaphone, Compass, Radio, FileText, AlertTriangle, Coins, Info, Clock, Bot, Camera } from 'lucide-react'
import { useStore, compressImageToDataUrl } from '../../store/store'
import { useMe } from '../../store/useMe'

const aiTools = [
  { to: '/ai-search', label: 'AI百事通', icon: Compass },
  { to: '/ai-tangdou', label: '糖豆', icon: Bot },
  { to: '/ai-tutor', label: '实时资讯台', icon: Radio },
  { to: '/document-workshop', label: '文档工坊', icon: FileText },
  { to: '/warnings', label: '避雷清单', icon: AlertTriangle },
  { to: '/money', label: '搞钱项目', icon: Coins },
  { to: '/about', label: '关于我们', icon: Info }
]

export default function Mine() {
  const nav = useNavigate()
  const me = useMe()
  const tasks = useStore(s => s.tasks)
  const updateProfile = useStore(s => s.updateProfile)
  const myPosted = tasks.filter(t => t.poster_id === me.id).length
  const myTaken = tasks.filter(t => t.accepted_id === me.id).length
  const unread = useStore(s => s.notifications.filter(n => n.user_id === me.id && !n.read).length)
  const switchRole = useStore(s => s.switchRole)
  const logout = useStore(s => s.logout)
  const isGuest = !me.qq
  const [avatarBusy, setAvatarBusy] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // 手机版头像更换：选图 → 压缩 → 更新 store（写库在 store 内完成）
  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAvatarBusy(true)
    try {
      const dataUrl = await compressImageToDataUrl(file, 256, 0.82)
      if (dataUrl) await updateProfile({ avatar: dataUrl })
      else {
        const reader = new FileReader()
        reader.onload = () => { if (typeof reader.result === 'string') updateProfile({ avatar: reader.result }) }
        reader.readAsDataURL(file)
      }
    } finally {
      setAvatarBusy(false)
    }
  }

  const rows = [
    { icon: ListOrdered, label: '我的发布', val: myPosted, onClick: () => nav('/my-tasks?role=poster') },
    { icon: Package, label: '我的接单', val: myTaken, onClick: () => nav('/my-tasks?role=worker') },
    { icon: Clock, label: 'AI 查询记录', val: 0, onClick: () => nav('/ai-history') },
    { icon: Heart, label: '我的收藏', val: 0, onClick: () => nav('/community') },
    { icon: Megaphone, label: '消息通知', val: unread, onClick: () => nav('/notifications') }
  ]

  return (
    <div className="px-4 pt-3 pb-10">
      {/* 头部 */}
      {isGuest ? (
        <button onClick={() => nav('/login')} className="w-full flex items-center gap-4 py-4 text-left active:bg-gray-50 rounded-xl">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl">👤</div>
          <div className="flex-1">
            <div className="font-black text-lg">未登录</div>
            <div className="text-xs text-brand-600 mt-0.5">点击登录 / 注册，解锁发任务、接单、钱包</div>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </button>
      ) : (
        <div className="flex items-center gap-4 py-4">
          <div className="relative">
            {me.avatar ? (
              <img src={me.avatar} className="w-16 h-16 rounded-full bg-gray-100 object-cover" alt="头像" onClick={() => avatarInputRef.current?.click()} />
            ) : (
              <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-2xl text-brand-600" onClick={() => avatarInputRef.current?.click()}>
                {me.nickname.slice(0, 1)}
              </div>
            )}
            <button
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center shadow"
              onClick={() => avatarInputRef.current?.click()}
              title="更换头像"
            >
              <Camera size={13} />
            </button>
          </div>
          <div className="flex-1">
            <div className="font-black text-lg">{me.nickname}</div>
            <div className="text-xs text-gray-400">QQ {me.qq} · {me.status === 'banned' ? '已封禁' : '正常'}</div>
          </div>
          <button onClick={() => nav('/wallet')} className="flex items-center gap-1 text-brand-600 text-sm"><WalletIcon size={16} /> 钱包</button>
        </div>
      )}

      {/* 头像上传：压缩在 store.compressImageToDataUrl 完成 */}
      <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={onAvatarFile} />
      {avatarBusy && <div className="text-xs text-brand-600 px-1 pb-1">头像上传中…</div>}

      {/* 我的模块 */}
      <div className="card divide-y divide-gray-50">
        {rows.map(r => (
          <button key={r.label} onClick={r.onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
            <r.icon size={20} className="text-gray-500" />
            <span className="flex-1 text-sm">{r.label}</span>
            {r.val > 0 && <span className="text-xs text-red-500">{r.val} 条</span>}
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ))}
      </div>

      <button onClick={() => nav('/wallet')} className="btn-primary w-full mt-4">进入钱包中心</button>

      {/* 择校通 AI 工具（与原桌面站同一套功能，手机端在此直达） */}
      <div className="mt-4">
        <div className="text-xs text-gray-400 px-1 mb-2">择校通 · AI 工具</div>
        <div className="grid grid-cols-3 gap-2">
          {aiTools.map(t => (
            <button key={t.to} onClick={() => nav(t.to)} className="card flex flex-col items-center gap-1.5 py-3.5 active:scale-[.98] transition">
              <t.icon size={22} className="text-brand-600" />
              <span className="text-xs">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 设置 */}
      <div className="card mt-4 divide-y divide-gray-50">
        <button onClick={() => nav('/wallet')} className="w-full flex items-center gap-3 px-4 py-3.5 text-left"><Settings size={20} className="text-gray-500" /><span className="flex-1 text-sm">设置中心</span><ChevronRight size={16} className="text-gray-300" /></button>
        <button onClick={() => { switchRole(); nav('/admin') }} className="w-full flex items-center gap-3 px-4 py-3.5 text-left"><Shield size={20} className="text-gray-500" /><span className="flex-1 text-sm">进入管理后台</span><ChevronRight size={16} className="text-gray-300" /></button>
      </div>

      {!isGuest && (
        <button onClick={() => { logout(); nav('/splash') }} className="w-full mt-4 py-3 text-gray-400 text-sm flex items-center justify-center gap-1"><LogOut size={16} /> 退出登录</button>
      )}
      <p className="text-center text-xs text-gray-300 mt-6">择校通 · 校园综合服务</p>
    </div>
  )
}
