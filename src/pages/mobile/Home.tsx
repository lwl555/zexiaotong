import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Pin, Clock, ChevronRight, Heart, Star, MessageSquare, Sparkles, Bot, Radio, FileText, AlertTriangle } from 'lucide-react'
import { useStore } from '../../store/store'

const TABS = ['全部', '悬赏', '跑腿', '文档设计', '问卷', '二手', '论坛']

const AI_TOOLS = [
  { to: '/ai-search', label: '查院校', icon: Search, desc: 'AI + 联网检索', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  { to: '/ai-tangdou', label: '糖豆', icon: Bot, desc: '全能对话助手', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  { to: '/ai-tutor', label: '资讯台', icon: Radio, desc: '志愿填报推荐', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  { to: '/document-workshop', label: '文档工坊', icon: FileText, desc: '一键生成报告', cls: 'bg-green-50 text-green-700 border-green-200' },
  { to: '/warnings', label: '避雷清单', icon: AlertTriangle, desc: '真实优缺点', cls: 'bg-red-50 text-red-700 border-red-200' },
]

function remain(d?: string) {
  if (!d) return ''
  const ms = new Date(d).getTime() - Date.now()
  if (ms <= 0) return '已截止'
  const h = Math.floor(ms / 3600000), day = Math.floor(h / 24)
  return day > 0 ? `剩 ${day} 天` : `剩 ${h} 小时`
}

export default function Home() {
  const nav = useNavigate()
  const tasks = useStore(s => s.tasks)
  const goods = useStore(s => s.goods)
  const posts = useStore(s => s.posts)
  const me = useStore(s => s.me)
  const unread = useStore(s => me ? s.notifications.filter(n => n.user_id === me.id && !n.read).length : 0)
  const [tab, setTab] = useState('全部')
  const [kw, setKw] = useState('')

  let list: any[] = []
  if (tab === '全部') list = tasks
  else if (tab === '二手') list = goods
  else if (tab === '论坛') list = posts
  else list = tasks.filter(t => t.category === tab)
  if (kw) list = list.filter((x: any) => (x.title || '').includes(kw))
  list = [...list].sort((a: any, b: any) => (b.top_until ? 1 : 0) - (a.top_until ? 1 : 0))

  return (
    <div className="px-4 pt-3 pb-4">
      {/* 顶部搜索 + 通知 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
          <Search size={18} className="text-gray-400" />
          <input className="bg-transparent outline-none text-sm flex-1" placeholder="搜索任务 / 二手 / 帖子" value={kw} onChange={e => setKw(e.target.value)} />
        </div>
        <button onClick={() => nav('/notifications')} className="relative w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <Bell size={18} className="text-gray-600" />
          {unread > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{unread}</span>}
        </button>
      </div>

      {/* 分类 Tab */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={'px-3 py-1.5 rounded-full text-sm whitespace-nowrap ' + (tab === t ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600')}>
            {t}
          </button>
        ))}
      </div>

      {/* AI 工具入口（仅在"全部"tab 显示） */}
      {tab === '全部' && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2"><Sparkles size={14} className="text-brand-600" /><span className="text-xs font-medium text-gray-600">AI 工具</span></div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {AI_TOOLS.map(t => (
              <button key={t.to} onClick={() => nav(t.to)} className={'shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border active:scale-[.97] transition ' + t.cls}>
                <t.icon size={16} strokeWidth={1.9} />
                <div className="text-left">
                  <div className="text-xs font-medium leading-none">{t.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5 leading-none">{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 列表 */}
      <div className="space-y-3">
        {list.length === 0 && <div className="text-center text-gray-400 text-sm py-16">暂无内容</div>}
        {list.map((x: any) => {
          if (tab === '二手') {
            return (
              <div key={x.id} onClick={() => nav('/goods/' + x.id)} className="card p-3 flex gap-3 active:scale-[.99] transition">
                <img src={x.images[0] || ''} className="w-20 h-20 rounded-xl bg-gray-100 object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{x.title}</div>
                  <div className="text-brand-600 font-black mt-1">¥{x.price}</div>
                  <div className="text-xs text-gray-400 mt-2">{x.seller_name} · {x.category}</div>
                </div>
              </div>
            )
          }
          if (tab === '论坛') {
            return (
              <div key={x.id} onClick={() => nav('/post/' + x.id)} className="card p-3 active:scale-[.99] transition">
                <div className="font-medium">{x.title}</div>
                <div className="text-sm text-gray-500 mt-1 line-clamp-2">{x.content}</div>
                <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                  <span>{x.author_name}</span><span className="flex items-center gap-0.5"><Heart size={12} /> {x.likes}</span><span className="flex items-center gap-0.5"><Star size={12} /> {x.collects}</span><span className="flex items-center gap-0.5"><MessageSquare size={12} /> {x.comments}</span>
                </div>
              </div>
            )
          }
          // 任务卡
          const statusText: any = { open: '待接单', accepted: '已接单', doing: '进行中', review: '待验收', done: '已完成', arbitration: '仲裁中', closed: '已关闭' }
          return (
            <div key={x.id} onClick={() => nav('/task/' + x.id)} className="card p-3 active:scale-[.99] transition">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium leading-snug">{x.title}</div>
                {x.top_until && <span className="tag bg-clay/10 text-clay shrink-0"><Pin size={11} /> 置顶</span>}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="tag bg-brand-50 text-brand-700">{x.category}</span>
                <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} /> {remain(x.deadline)}</span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <img src={x.poster_avatar} className="w-5 h-5 rounded-full" alt="" />{x.poster_name}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-brand-600 font-black">¥{x.amount}</span>
                  <span className="tag bg-gray-100 text-gray-500">{statusText[x.status]}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
