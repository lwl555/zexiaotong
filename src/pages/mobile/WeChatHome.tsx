import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Search, Plus, User } from 'lucide-react'
import { useStore } from '../../store/store'

// ===== 聊天列表：把平台「所有功能」以聊天行样式排在这里 =====
// 头像统一黑白纯 UI（近黑底 + 白字），不再用彩色块。
// 真实 AI 会话接入时，可把 localStorage['zxt_conv_v1'] 按 channel 聚合到对应行的最新消息。
const channels: Array<{
  id: string
  name: string
  ch: string
  lastMsg: string
  time: string
  unread: number
  to: string
}> = [
  // —— 智能助手（可对话的 AI）——
  { id: 'baishitong', name: 'AI 百事通',    ch: '百', lastMsg: '查院校 · 问政策，随时开聊',        time: '14:48', unread: 0, to: '/ai-search' },
  { id: 'tangdou',    name: '糖豆·学习搭子', ch: '豆', lastMsg: '复习卡已就绪，今天继续？',          time: '13:00', unread: 2, to: '/ai-tangdou' },
  { id: 'tutor',      name: '学习导师',      ch: '导', lastMsg: '定制你的 1v1 学习路径',           time: '昨天',  unread: 0, to: '/ai-tutor' },
  { id: 'docs',       name: '文档工坊',      ch: '档', lastMsg: '志愿报告已生成，可下载',            time: '昨天',  unread: 0, to: '/document-workshop' },
  { id: 'warnings',   name: '避雷清单',      ch: '雷', lastMsg: '新增 1 所预警院校',                time: '周五',  unread: 0, to: '/warnings' },
  { id: 'news',       name: '实时资讯台',    ch: '讯', lastMsg: '今日 3 条快讯 · 志愿新动态',        time: '12:39', unread: 1, to: '/community' },
  // —— 社区与交易 ——
  { id: 'community',  name: '择校社区',      ch: '校', lastMsg: '护考姐妹：26护考大纲已上传>>',       time: '16:26', unread: 86, to: '/community' },
  { id: 'goods',      name: '二手市场',      ch: '旧', lastMsg: '最新闲置教材在售',                time: '11:20', unread: 0, to: '/goods' },
  { id: 'tasks',      name: '任务大厅',      ch: '务', lastMsg: '新任务待认领，最高 ¥200',           time: '10:05', unread: 0, to: '/publish' },
  // —— 账户与工具 ——
  { id: 'money',      name: '搞钱项目',      ch: '钱', lastMsg: '今日第 3 单佣金已到账',             time: '周一',  unread: 0, to: '/money' },
  { id: 'messages',   name: '消息中心',      ch: '信', lastMsg: '你有 3 条新私信',                  time: '09:30', unread: 3, to: '/messages' },
  { id: 'notifications', name: '通知',       ch: '铃', lastMsg: '系统：志愿填报通道已开放',           time: '08:12', unread: 0, to: '/notifications' },
  { id: 'ai-history', name: 'AI 历史',       ch: '历', lastMsg: '查看历史对话与查询记录',            time: '昨天',  unread: 0, to: '/ai-history' },
  { id: 'wallet',     name: '我的钱包',      ch: '包', lastMsg: '余额 ¥328.50',                    time: '周一',  unread: 0, to: '/wallet' },
  { id: 'mine',       name: '个人中心',      ch: '我', lastMsg: '管理账号 · 设置 · 登录',            time: '—',    unread: 0, to: '/mine' },
  { id: 'about',      name: '关于择校通',    ch: '?', lastMsg: '真实 · 直接 · 不客气',               time: '—',    unread: 0, to: '/about' },
]

// 黑白纯 UI 头像底色（统一，无彩色）
const AVATAR_BG = '#1a1a1a'

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

      {/* 聊天会话列表（白底卡，全部功能按此样式排列） */}
      <div className="bg-white mt-1">
        {channels.map(c => (
          <button key={c.id} onClick={() => nav(c.to)}
            className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 active:bg-gray-50 text-left">
            <div className="relative w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
              style={{ background: AVATAR_BG }}>
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
