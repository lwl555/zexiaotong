import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BtnPrimary, INK, MUTED, HAIR, FONT } from './Editorial'

/**
 * 统一空状态组件。
 *
 * 背景：此前各页空状态基本只有一句「暂无 xx」——用户点进来看到一片空白，
 * 既不知道「这里是干嘛的」，也不知道「下一步该做什么」，只能退出去。
 * 参考正例（搞钱项目页）：一句说明 + 明确指引，用户就知道往哪走。
 *
 * 用法：
 *   <EmptyState
 *     title="还没有发布任务"
 *     hint="发布一个悬赏，等同学来接单"
 *     actionLabel="去发布任务"
 *     to="/publish"
 *   />
 */
export default function EmptyState({
  title,
  hint,
  actionLabel,
  to,
  onClick,
  extra,
}: {
  title: string
  hint?: string
  /** 主按钮文案；不传则只显示文案不显示按钮 */
  actionLabel?: string
  /** 主按钮跳转路由 */
  to?: string
  /** 自定义点击行为（优先于 to） */
  onClick?: () => void
  /** 按钮下方的补充内容（如次要入口） */
  extra?: ReactNode
}) {
  const nav = useNavigate()
  const act = onClick || (to ? () => nav(to) : undefined)

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '52px 20px',
        border: `1px dashed ${HAIR}`,
        borderRadius: 4,
        background: '#ffffff',
      }}
    >
      <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: INK }}>{title}</div>
      {hint && (
        <div
          style={{
            fontFamily: FONT,
            fontSize: 13,
            color: MUTED,
            lineHeight: 1.65,
            marginTop: 8,
            maxWidth: 320,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {hint}
        </div>
      )}
      {actionLabel && act && (
        <div style={{ marginTop: 18 }}>
          <BtnPrimary onClick={act}>{actionLabel}</BtnPrimary>
        </div>
      )}
      {extra && <div style={{ marginTop: 14 }}>{extra}</div>}
    </div>
  )
}
