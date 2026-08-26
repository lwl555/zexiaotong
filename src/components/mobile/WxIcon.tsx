// 纯原生 UI 矢量图标：每个功能一个线性图标，置于纯白圆角方块内、深色线框（中性 #1f1f1f）。
// 不依赖分类色，去掉 AI 套路化的彩色方块；加一道极淡描边以在白行中区分。
// 仅在首页功能块使用（作用范围限定为首页，见决策记录）。
import type { ReactNode } from 'react'

const ICONS: Record<string, ReactNode> = {
  // AI 百事通：放大镜
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </>
  ),
  // 糖豆·学习搭子：聊天气泡
  chat: (
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
  ),
  // 学习导师：学位帽
  cap: (
    <>
      <path d="M3 9l9-4 9 4-9 4-9-4z" />
      <path d="M7 11v4c0 1.5 2.5 3 5 3s5-1.5 5-3v-4" />
      <line x1="21" y1="9" x2="21" y2="14" />
    </>
  ),
  // 文档工坊：文件
  doc: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </>
  ),
  // 避雷清单：闪电
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  // 实时资讯台：报纸
  news: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="7" y1="8" x2="13" y2="8" />
      <line x1="7" y1="12" x2="13" y2="12" />
      <line x1="7" y1="16" x2="11" y2="16" />
      <rect x="15" y="8" width="4" height="4" />
    </>
  ),
  // 择校社区：多人
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5a3 3 0 0 1 0 6" />
      <path d="M18 14c2 .8 3 2.5 3 6" />
    </>
  ),
  // 二手市场：购物袋
  bag: (
    <>
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      <line x1="6" y1="8" x2="18" y2="8" />
    </>
  ),
  // 任务大厅：带勾的剪贴板
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <line x1="9" y1="4" x2="9" y2="2" />
      <line x1="15" y1="4" x2="15" y2="2" />
      <path d="M8.5 13l2 2 4-4" />
    </>
  ),
  // 搞钱项目：人民币硬币
  yuan: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 8l4 4 4-4" />
      <line x1="12" y1="12" x2="12" y2="17" />
      <line x1="9.5" y1="14" x2="14.5" y2="14" />
    </>
  ),
  // 消息中心：信封
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  // 通知：铃铛
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 3H4z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  // AI 历史：时钟
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  // 我的钱包：钱包
  wallet: (
    <>
      <path d="M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 7l2-3h12" />
      <circle cx="17" cy="13" r="1.3" />
    </>
  ),
  // 个人中心：单人
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  // 关于择校通：信息
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="8" r="0.9" fill="#1f1f1f" stroke="none" />
    </>
  ),
}

interface Props {
  icon: string
  size?: number
}

export default function WxIcon({ icon, size = 44 }: Props) {
  const pad = Math.round(size * 0.27)
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 select-none"
      style={{
        width: size,
        height: size,
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: Math.round(size * 0.2),
      }}
    >
      <svg
        width={size - pad * 2}
        height={size - pad * 2}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#1f1f1f"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONS[icon] ?? ICONS.search}
      </svg>
    </div>
  )
}
