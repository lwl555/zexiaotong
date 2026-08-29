import { useNavigate } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { Search, Plus, User, ChevronRight } from 'lucide-react'
import { useStore } from '../../store/store'
import WxIcon from '../../components/mobile/WxIcon'

const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Heiti SC", "微软雅黑", sans-serif'

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

// ===== 配色（白底结合版：白底 + 陶土红唯一强调 + 粗黑边硬阴影）=====
const INK = '#111111'
const MUTED = '#6b7280'
const ACCENT = '#D8451F' // 陶土红：登录链接 / 活跃态 / CTA / 编号
const LINE = 'rgba(0,0,0,0.08)'
const ACTIVE = 'rgba(216,69,31,0.06)' // 行按压极淡陶土红
const UNREAD = '#fa5151' // 微信原生未读红，保留

// 硬边卡片：粗黑边 + 无模糊实色硬阴影（neo-brutalism 版式语言）
function hard(extra: CSSProperties = {}): CSSProperties {
  return { border: '3px solid #111111', borderRadius: 2, boxShadow: '5px 5px 0 #111111', ...extra }
}

// ===== 功能分组：每行一个"聊天对象"= 一个平台功能 =====
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
  { id: 'news',       name: '实时资讯台',     lastMsg: '今日 3 条招生快讯',             time: '12:39', unread: 1, to: '/news' },
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

const GROUPS: { title: string; subtitle: string; items: Channel[] }[] = [
  { title: '智能助手', subtitle: 'Assistants', items: ASSISTANTS },
  { title: '社区与交易', subtitle: 'Community', items: COMMUNITY },
  { title: '账户与工具', subtitle: 'Account',   items: ACCOUNT },
]

// 三功能入口（图2 风格：杂志编号 + chevron）
const ENTRIES: { n: string; name: string; sub: string; to: string }[] = [
  { n: '01', name: '院校库',   sub: '3200+ 所', to: '/ai-search' },
  { n: '02', name: '志愿填报', sub: '智能方案', to: '/publish' },
  { n: '03', name: '录取追踪', sub: '实时状态', to: '/my-tasks' },
]

// 噪点纹理（3% 透明度 overlay，打破 AI 式完美平面感）
const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export default function WeChatHome() {
  const nav = useNavigate()
  const me = useStore(s => s.me)
  const isGuest = !me?.qq

  return (
    <div style={{ background: '#ffffff', minHeight: '100%', color: INK, fontFamily: FONT }}>
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
        className="sticky top-0 z-20 flex items-center justify-between px-2 h-12 border-b-2 bg-white"
        style={{ borderColor: '#111111' }}
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

      {/* eyebrow 等宽小标签 */}
      <div style={{ padding: '6px 16px 0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10, letterSpacing: 3, color: ACCENT }}>
        ZEXIAO · 2026 择校季
      </div>

      {/* Hero：左文 + 右图占位 */}
      <div style={{ margin: '8px 12px 0' }}>
        <div style={{ ...hard(), padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: INK, lineHeight: 1.25 }}>选对学校<br />比努力<br />更关键</div>
            <div style={{ marginTop: 6, fontSize: 11, color: MUTED, lineHeight: 1.5 }}>用数据，不熬鸡汤。</div>
            <div onClick={() => nav('/ai-search')} style={{ marginTop: 10, display: 'inline-block', background: ACCENT, color: '#ffffff', fontSize: 12, padding: '7px 14px', borderRadius: 2, fontWeight: 600 }}>开始测评 →</div>
          </div>
          <div style={{ width: 96, height: 120, background: '#efefef', border: '3px solid #111111', borderRadius: 2, display: 'flex', alignItems: 'flex-end', padding: 7, fontSize: 9, color: MUTED }}>校园实景照片</div>
        </div>
      </div>

      {/* 一键查分 · 大白卡 */}
      <div style={{ margin: '14px 12px 0' }}>
        <div style={{ ...hard(), padding: '14px 14px 12px', background: '#ffffff' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: INK, letterSpacing: 1 }}>一键查分</div>
          <div style={{ marginTop: 4, fontSize: 11, color: MUTED }}>输入分数，智能匹配院校</div>
          <div onClick={() => nav('/ai-search')} style={{ marginTop: 10, display: 'inline-block', background: ACCENT, color: '#ffffff', fontSize: 12, padding: '7px 16px', borderRadius: 2, fontWeight: 600 }}>开始匹配</div>
        </div>
      </div>

      {/* 三功能入口 */}
      <div style={{ margin: '10px 12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ENTRIES.map(e => (
          <button key={e.n} onClick={() => nav(e.to)} style={{ ...hard(), display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#ffffff', width: '100%' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, color: ACCENT, fontWeight: 700 }}>{e.n}</span>
              <span style={{ fontSize: 13, color: INK, fontWeight: 500 }}>{e.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: MUTED }}>{e.sub}</span>
              <ChevronRight size={16} color={INK} strokeWidth={2} />
            </div>
          </button>
        ))}
      </div>

      {/* ===== 功能列表（换皮：等宽 eyebrow + 陶土红强调 + 白底） ===== */}
      <div style={{ background: '#ffffff', marginTop: 16 }}>
        {GROUPS.map((g, gi) => (
          <div key={g.title}>
            <div className="flex items-baseline gap-2 px-4 pt-3 pb-1">
              <span
                className="tracking-[0.12em]"
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10, color: ACCENT }}
              >
                {g.subtitle.toUpperCase()}
              </span>
              <span className="text-[13px] font-bold" style={{ color: INK, letterSpacing: '-0.01em' }}>
                {g.title}
              </span>
            </div>

            {g.items.map(c => (
              <button
                key={c.id}
                onClick={() => nav('/m/notify/' + c.id)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b text-left active:scale-[0.99] transition-transform"
                style={{ borderColor: LINE, background: 'transparent' }}
                onMouseDown={(e) => (e.currentTarget.style.background = ACTIVE)}
                onMouseUp={(e) => (e.currentTarget.style.background = 'transparent')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <WxIcon icon={HOME_ICON[c.id] ?? 'search'} size={46} />
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

            {gi < GROUPS.length - 1 && <div className="h-3" style={{ background: '#f7f6f3' }} />}
          </div>
        ))}
      </div>

      {/* 列表底部留白，避免被底部导航遮住 */}
      <div className="h-20" style={{ background: '#ffffff' }} />
    </div>
  )
}
