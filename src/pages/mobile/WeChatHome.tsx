import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Search, Plus, User } from 'lucide-react'
import { useStore } from '../../store/store'

// ===== 聊天列表（应用消息先用静态 mock，UI 骨架先到位） =====
// 真实 AI 会话可以从 localStorage['zxt_conv_v1'] 读，按 channel 聚合到对应行；
// 真实应用消息（资讯台/文档工坊/避雷/搞钱项目/择校社区）后端可补一个"频道订阅"表。
const channels: Array<{
  id: string
  name: string
  ch: string
  bg: string
  lastMsg: string
  time: string
  unread: number
  to: string
}> = [
  { id: 'community',  name: '择校社区',   ch: '校', bg: '#c43a2a', lastMsg: '护考姐妹：26护考大纲已上传，点开看>>', time: '16:26', unread: 86, to: '/community' },
  { id: 'baishitong', name: 'AI 百事通',  ch: '百', bg: '#3a8a3e', lastMsg: '百事通：查到上海交大2026招生章程，要发…',     time: '14:48', unread: 0,  to: '/ai-search' },
  { id: 'tangdou',    name: '糖豆·学习搭子', ch: '豆', bg: '#6a4a8a', lastMsg: '糖豆：再来一组今天的复习卡？',                 time: '13:00', unread: 2,  to: '/ai-tangdou' },
  { id: 'news',       name: '实时资讯台', ch: '讯', bg: '#c43a2a', lastMsg: '[应用消息] 今日3条快讯 · 志愿填报新动态',   time: '12:39', unread: 1,  to: '/community' },
  { id: 'docs',       name: '文档工坊',   ch: '档', bg: '#1a5fa8', lastMsg: '[应用消息] 上次的志愿报告已生成',             time: '昨天', unread: 0,  to: '/document-workshop' },
  { id: 'warnings',   name: '避雷清单',   ch: '!', bg: '#e89a3a', lastMsg: '[应用消息] 新增1所预警院校',                  time: '周五', unread: 0,  to: '/warnings' },
  { id: 'money',      name: '搞钱项目',   ch: '钱', bg: '#c43a2a', lastMsg: '[应用消息] 今日第3单佣金已到账',              time: '周一', unread: 0,  to: '/money' },
]

export default function WeChatHome() {
  const nav = useNavigate()
  const me = useStore(s => s.me)
  const isGuest = !me?.qq

  return (
    <div style={{ background: '#ededed', minHeight: '100%' }}>
      {/* 顶部导航 */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-3 h-12 border-b border-gray-200" style={{ background: '#ededed' }}>
        {/* 左：游客→返回引导页(可登录)；已登录→我的 */}
        {isGuest ? (
          <button
            aria-label="折叠"
            className="w-9 h-9 flex items-center justify-center text-gray-500 active:bg-gray-200 rounded-full"
            onClick={() => nav('/splash')}>
            <span className="text-lg leading-none">«</span>
          </button>
        ) : (
          <button
            aria-label="我的"
            className="w-9 h-9 flex items-center justify-center text-gray-500 active:bg-gray-200 rounded-full"
            onClick={() => nav('/mine')}>
            <User size={20} />
          </button>
        )}
        <div className="text-base font-semibold text-gray-900">择校通</div>
        <div className="flex items-center gap-1">
          {/* 游客态显示登录入口（微信绿），与之前信息流首页一致 */}
          {isGuest && (
            <button
              onClick={() => nav('/login')}
              className="px-3 h-8 rounded-full text-[13px] font-medium text-white active:scale-95 transition"
              style={{ background: '#07c160' }}>
              登录
            </button>
          )}
          <button aria-label="搜索" className="w-9 h-9 flex items-center justify-center text-gray-500 active:bg-gray-200 rounded-full"
            onClick={() => nav('/ai-search')}>
            <Search size={20} />
          </button>
          <button aria-label="添加" className="w-9 h-9 flex items-center justify-center text-gray-500 active:bg-gray-200 rounded-full"
            onClick={() => nav('/community')}>
            <Plus size={22} />
          </button>
        </div>
      </div>

      {/* 聊天会话列表（白底卡） */}
      <div className="bg-white mt-1">
        {channels.map(c => (
          <button key={c.id} onClick={() => nav(c.to)}
            className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 active:bg-gray-50 text-left">
            <div className="relative w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
              style={{ background: c.bg }}>
              {c.ch}
              {c.unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
                  {c.unread > 99 ? '99+' : c.unread}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="text-[15px] text-gray-900 font-medium truncate">{c.name}</div>
                <div className="text-[11px] text-gray-400 ml-2 flex-shrink-0">{c.time}</div>
              </div>
              <div className="text-[12px] text-gray-500 truncate mt-0.5">{c.lastMsg}</div>
            </div>
          </button>
        ))}
      </div>

      {/* 列表底部留白，避免被 4 Tab 导航遮住 */}
      <div className="h-4 bg-white" />
    </div>
  )
}
