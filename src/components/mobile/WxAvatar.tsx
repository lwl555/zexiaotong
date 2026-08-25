// 微信风首字头像：圆角方块 + 白色首字。统一克制色，避免 emoji / 彩色 AI 模板感。
interface Props {
  ch: string
  color: string
  size?: number
}

export default function WxAvatar({ ch, color, size = 44 }: Props) {
  return (
    <div
      className="flex items-center justify-center text-white font-semibold flex-shrink-0 select-none"
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: Math.round(size * 0.18),
        fontSize: Math.round(size * 0.42),
        lineHeight: 1
      }}
    >
      {ch}
    </div>
  )
}
