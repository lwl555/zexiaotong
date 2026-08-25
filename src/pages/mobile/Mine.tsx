import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'

const aiTools = [
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
  const switchRole = useStore(s => s.switchRole)
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
    <div className="px-4 pt-3 pb-10">
      {/* 头部 */}
      {isGuest ? (
        <button onClick={() => nav('/login')} className="w-full flex items-center gap-4 py-4 text-left active:bg-gray-50 rounded-xl">
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-base font-medium">登录</div>
          <div className="flex-1">
            <div className="font-black text-lg">未登录</div>
            <div className="text-xs text-brand-600 mt-0.5">点击登录 / 注册，解锁发任务、接单、钱包</div>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </button>
      ) : (
        <div className="flex items-center gap-4 py-4">
          <img src={me.avatar} className="w-16 h-16 rounded-full bg-gray-200" alt="" />
          <div className="flex-1">
            <div className="font-black text-lg">{me.nickname}</div>
            <div className="text-xs text-gray-400">{me.qq} · {me.status === 'banned' ? '已封禁' : '正常'}</div>
          </div>
          <button onClick={() => nav('/wallet')} className="flex items-center gap-1 text-brand-600 text-sm">钱包</button>
        </div>
      )}

      {/* 我的模块（纯文字列表） */}
      <div className="card divide-y divide-gray-50">
        {myRows.map(r => (
          <button key={r.label} onClick={r.onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
            <span className="flex-1 text-sm text-gray-800">{r.label}</span>
            {r.val > 0 && <span className="text-xs text-red-500">{r.val} 条</span>}
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ))}
      </div>

      <button onClick={() => nav('/wallet')} className="btn-primary w-full mt-4">进入钱包中心</button>

      {/* 择校通 AI 工具（纯文字直达，与首页一致） */}
      <div className="mt-4">
        <div className="text-xs text-gray-400 px-1 mb-2">择校通 · AI 工具</div>
        <div className="card divide-y divide-gray-50">
          {aiTools.map(t => (
            <button key={t.to} onClick={() => nav(t.to)} className="w-full flex items-center px-4 py-3.5 text-left">
              <span className="flex-1 text-sm text-gray-800">{t.label}</span>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          ))}
        </div>
      </div>

      {/* 设置 */}
      <div className="card mt-4 divide-y divide-gray-50">
        <button className="w-full flex items-center px-4 py-3.5 text-left"><span className="flex-1 text-sm text-gray-800">设置中心</span><ChevronRight size={16} className="text-gray-300" /></button>
        <button onClick={() => { switchRole(); nav('/admin') }} className="w-full flex items-center px-4 py-3.5 text-left"><span className="flex-1 text-sm text-gray-800">进入管理后台</span><ChevronRight size={16} className="text-gray-300" /></button>
      </div>

      {!isGuest && (
        <button onClick={() => { logout(); nav('/splash') }} className="w-full mt-4 py-3 text-gray-400 text-sm">退出登录</button>
      )}
      <p className="text-center text-xs text-gray-300 mt-6">择校通 · 校园综合服务</p>
    </div>
  )
}
