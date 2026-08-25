import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Search, Plus, User } from 'lucide-react'
import { useStore } from '../../store/store'

// ===== 功能分组：每行一个"聊天对象"= 一个平台功能（纯文字，无图标） =====
// 副标题一律"静态事实描述"，不写"?"、不写"聊"、不写命令句、避免 LLM 营销味
type Channel = {
  id: string
  name: string
  lastMsg: string
  time: string
  unread: number
  to: string
}

const ASSISTANTS: Channel[] = [
  { id: 'baishitong', name: 'AI 百事通',     lastMsg: '查询院校库 · 解读招生政策',     time: '14:48', unread: 0, to: '/ai-search' },
  { id: 'tangdou',    name: '糖豆·学习搭子', lastMsg: '今日复习任务已推送',           time: '13:00', unread: 2, to: '/ai-tangdou' },
  { id: 'tutor',      name: '学习导师',       lastMsg: 'AI 1v1 学习路径规划',           time: '昨天',  unread: 0, to: '/ai-tutor' },
  { id: 'docs',       name: '文档工坊',       lastMsg: '志愿报告 PDF 已生成',           time: '昨天',  unread: 0, to: '/document-workshop' },
  { id: 'warnings',   name: '避雷清单',       lastMsg: '新增 1 所高风险院校',           time: '周五',  unread: 0, to: '/warnings' },
  { id: 'news',       name: '实时资讯台',     lastMsg: '今日 3 条招生快讯',             time: '12:39', unread: 1, to: '/community' },
]

const COMMUNITY: Channel[] = [
  { id: 'community',  name: '择校社区',       lastMsg: '26 护考大纲 PDF 已上传',         time: '16:26', unread: 86, to: '/community' },
  { id: 'goods',      name: '二手市场',       lastMsg: '二手教材 142 件在售',            time: '11:20', unread: 0,  to: '/goods' },
  { id: 'tasks',      name: '任务大厅',       lastMsg: '新任务 5 条待认领，最高 ¥200',   time: '10:05', unread: 0,  to: '/publish' },
]

const ACCOUNT: Channel[] = [
  { id: 'money',      name: '搞钱项目',       lastMsg: '今日佣金已到账 3 单',            time: '周一',  unread: 0, to: '/money' },
  { id: 'messages',   name: '消息中心',       lastMsg: '新私信 3 条未读',               time: '09:30', unread: 3, to: '/messages' },
  { id: 'notifications', name: '通知',       lastMsg: '志愿填报通道已开放',             time: '08:12', unread: 0, to: '/notifications' },
  { id: 'ai-history', name: 'AI 历史',        lastMsg: '历史对话 · 查询记录',           time: '昨天',  unread: 0, to: '/ai-history' },
  { id: 'wallet',     name: '我的钱包',       lastMsg: '账户余额 ¥328.50',              time: '周一',  unread: 0, to: '/wallet' },
  { id: 'mine',       name: '个人中心',       lastMsg: '账号管理 · 设置',               time: '—',    unread: 0, to: '/mine' },
  { id: 'about',      name: '关于择校通',     lastMsg: '版本 2026.08 · 真实直接不客气', time: '—',    unread: 0, to: '/about' },
]

// ===== 列表分组（顺序固定）=====
const GROUPS: { title: string; subtitle: string; items: Channel[] }[] = [
  { title: '智能助手', subtitle: 'ASSISTANTS', items: ASSISTANTS },
  { title: '社区与交易', subtitle: 'COMMUNITY', items: COMMUNITY },
  { title: '账户与工具', subtitle: 'ACCOUNT',   items: ACCOUNT },
]

export default function WeChatHome() {
  const nav = useNavigate()
  const me = useStore(s => s.me)
  const isGuest = !me?.qq

  return (
    <div style={{ background: '#ededed', minHeight: '100%' }}>
      {/* ===== 顶部导航 ===== */}
      {/* 顶栏右侧「登录」改为微信原生的小绿文字链接（替代之前的大绿块），视觉重心让位给「择校通」 */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between px-2 h-12 border-b border-gray-200"
        style={{ background: '#ededed' }}
      >
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
        <div className="text-base font-semibold text-gray-900 absolute left-1/2 -translate-x-1/2">择校通</div>
        <div className="flex items-center gap-0.5">
          {isGuest && (
            <button
              onClick={() => nav('/login')}
              className="px-2 h-7 text-[13px] font-medium active:opacity-60"
              style={{ color: '#07c160' }}>
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

      {/* ===== 聊天会话列表（纯文字，无图标；行高 64px，组内 0.5px 极淡分隔） ===== */}
      <div className="bg-white">
        {GROUPS.map((g, gi) => (
          <div key={g.title}>
            {/* 组标题：等宽 eyebrow + 中文 */}
            <div className="flex items-baseline gap-2 px-4 pt-3 pb-1">
              <span className="text-[10px] tracking-[0.18em] text-gray-400 font-mono">
                {g.subtitle}
              </span>
              <span className="text-[12px] text-gray-700 font-medium">
                {g.title}
              </span>
            </div>

            {g.items.map(c => (
              <button
                key={c.id}
                onClick={() => nav(c.to)}
                /* 行高 64px（py-3）+ 极淡分隔 border-gray-50（接近 0.5px 视觉），时间上 10px / 红点下错位 */
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 active:bg-gray-50 text-left"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-[16px] text-gray-900 font-medium truncate">{c.name}</div>
                  <div className="text-[13px] text-gray-500 truncate mt-1">{c.lastMsg}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-gray-400">{c.time}</span>
                  {c.unread > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] flex items-center justify-center font-medium leading-none">
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>
                  )}
                </div>
              </button>
            ))}

            {/* 段尾呼吸白条，最后一段去掉 */}
            {gi < GROUPS.length - 1 && <div className="h-3 bg-[#ededed]" />}
          </div>
        ))}
      </div>

      {/* 列表底部留白，避免被 4 Tab 导航(h-12=48px)遮住：给到 80px = Tab 高 + 32px 呼吸 */}
      <div className="h-20 bg-[#ededed]" />
    </div>
  )
}