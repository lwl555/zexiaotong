import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Search, Plus, User } from 'lucide-react'
import { useStore } from '../../store/store'
import WxIcon from '../../components/mobile/WxIcon'
import { avatarOf } from '../../lib/avatarMeta'

// 块 id → 纯 UI 矢量图标（与 WxIcon 注册表对应；首页作用范围限定）
const HOME_ICON: Record<string, string> = {
  baishitong: 'search',
  tangdou: 'chat',
  tutor: 'cap',
  docs: 'doc',
  warnings: 'bolt',
  news: 'news',
  community: 'users',
  goods: 'bag',
  tasks: 'clipboard',
  money: 'yuan',
  messages: 'mail',
  notifications: 'bell',
  'ai-history': 'clock',
  wallet: 'wallet',
  mine: 'user',
  about: 'info',
}

// ===== 配色（得物式：黑白灰主调 + 活力橙唯一强调色）=====
// 微信绿仅保留在底栏 4 Tab（微信骨架约定），本页强调色统一为活力橙。
const INK = '#1a1a1a'
const MUTED = '#6b7280'
const ACCENT = '#e8622c' // 活力橙（烧橙）：登录链接 / 活跃态 / 新内容标记
const LINE = 'rgba(0,0,0,0.06)'
const ACTIVE = 'rgba(232,98,44,0.05)' // 行按压极淡橙
const UNREAD = '#fa5151' // 微信原生未读红，保留不改为 AI 套路

// ===== 功能分组：每行一个"聊天对象"= 一个平台功能（纯文字，无图标） =====
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
  { title: '智能助手', subtitle: 'Assistants', items: ASSISTANTS },
  { title: '社区与交易', subtitle: 'Community', items: COMMUNITY },
  { title: '账户与工具', subtitle: 'Account',   items: ACCOUNT },
]

// 噪点纹理（3% 透明度 overlay，打破 AI 式完美平面感；参考 925studios / dev.to）
const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export default function WeChatHome() {
  const nav = useNavigate()
  const me = useStore(s => s.me)
  const isGuest = !me?.qq

  return (
    <div style={{ background: '#f4f4f5', minHeight: '100%', color: INK }}>
      {/* 噪点 overlay：覆盖全屏、不可点击、极淡 */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.035,
          zIndex: 9999,
          backgroundImage: NOISE_BG,
          backgroundSize: '120px 120px',
        }}
      />

      {/* ===== 顶部导航 ===== */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between px-2 h-12 border-b"
        style={{ background: '#f4f4f5', borderColor: LINE }}
      >
        {isGuest ? (
          <button
            aria-label="折叠"
            className="w-9 h-9 flex items-center justify-center active:bg-black/5 rounded-full"
            style={{ color: MUTED }}
            onClick={() => nav('/splash')}>
            <span className="text-lg leading-none">«</span>
          </button>
        ) : (
          <button
            aria-label="我的"
            className="w-9 h-9 flex items-center justify-center active:bg-black/5 rounded-full"
            style={{ color: MUTED }}
            onClick={() => nav('/mine')}>
            <User size={20} />
          </button>
        )}
        {/* 标题放大紧排（得物式大字号），保留微信居中约定 */}
        <div
          className="absolute left-1/2 -translate-x-1/2 font-bold"
          style={{ fontSize: 19, letterSpacing: '-0.02em', color: INK }}
        >
          择校通
        </div>
        <div className="flex items-center gap-0.5">
          {isGuest && (
            <button
              onClick={() => nav('/login')}
              className="px-2 h-7 text-[13px] font-semibold active:opacity-60"
              style={{ color: ACCENT }}
            >
              登录
            </button>
          )}
          <button aria-label="搜索" className="w-9 h-9 flex items-center justify-center active:bg-black/5 rounded-full"
            style={{ color: MUTED }}
            onClick={() => nav('/ai-search')}>
            <Search size={20} />
          </button>
          <button aria-label="添加" className="w-9 h-9 flex items-center justify-center active:bg-black/5 rounded-full"
            style={{ color: MUTED }}
            onClick={() => nav('/community')}>
            <Plus size={22} />
          </button>
        </div>
      </div>

      {/* ===== 聊天会话列表（纯文字，无图标；行高 64px，组内 0.5px 极淡分隔） ===== */}
      <div style={{ background: '#ffffff' }}>
        {GROUPS.map((g, gi) => (
          <div key={g.title}>
            {/* 组标题：手写感衬线斜体英文 eyebrow + 放大加粗中文（增温度） */}
            <div className="flex items-baseline gap-2 px-4 pt-3 pb-1">
              <span
                className="text-[11px] italic tracking-[0.12em]"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: ACCENT }}
              >
                {g.subtitle}
              </span>
              <span className="text-[13px] font-bold" style={{ color: INK, letterSpacing: '-0.01em' }}>
                {g.title}
              </span>
            </div>

            {g.items.map(c => (
              <button
                key={c.id}
                onClick={() => nav('/m/notify/' + c.id)}
                /* 行高 64px（py-3）+ 极淡分隔 + 标题 17px 紧排粗体；按压极淡橙底 */
                className="w-full flex items-center gap-3 px-4 py-3 border-b text-left active:scale-[0.99] transition-transform"
                style={{ borderColor: LINE, background: 'transparent' }}
                onMouseDown={(e) => (e.currentTarget.style.background = ACTIVE)}
                onMouseUp={(e) => (e.currentTarget.style.background = 'transparent')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* 纯 UI 矢量图标：分类色圆角方块 + 白色线性图标（零外链、无生成不确定性） */}
                <WxIcon icon={HOME_ICON[c.id] ?? 'search'} color={avatarOf(c.to).color} size={46} />
                <div className="flex-1 min-w-0 pr-2 pl-1">
                  <div
                    className="text-[17px] font-semibold truncate"
                    style={{ color: INK, letterSpacing: '-0.015em' }}
                  >
                    {c.name}
                  </div>
                  <div className="text-[13px] truncate mt-1" style={{ color: MUTED }}>
                    {c.lastMsg}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="text-[10px]" style={{ color: '#9ca3af' }}>{c.time}</span>
                  {c.unread > 0 && (
                    <span
                      className="min-w-[20px] h-5 px-1.5 rounded-full text-white text-[11px] flex items-center justify-center font-medium leading-none"
                      style={{ background: UNREAD }}
                    >
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>
                  )}
                </div>
              </button>
            ))}

            {/* 段尾呼吸白条，最后一段去掉 */}
            {gi < GROUPS.length - 1 && <div className="h-3" style={{ background: '#f4f4f5' }} />}
          </div>
        ))}
      </div>

      {/* 列表底部留白，避免被 4 Tab 导航(h-12=48px)遮住 */}
      <div className="h-20" style={{ background: '#f4f4f5' }} />
    </div>
  )
}
