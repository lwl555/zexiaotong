// 路由级骨架屏：懒加载 chunk 下载期间显示。
// 之前 Suspense fallback 是一个孤零零的转圈，重页面（AI 聊天/文档工坊/后台看板）
// 首屏实测要 5–8 秒，用户看到的是「一片空白 + 转圈」，很容易以为卡死直接退出。
// 改成骨架屏后：首帧立即出现页面结构（卡片轮廓 + 微光呼吸），观感上是「正在加载内容」
// 而不是「页面坏了」。纯 CSS，无第三方依赖，不增加任何体积。
const BLOCK = 'bg-[#eeeeee] rounded-[3px] animate-pulse'

export default function RouteSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      {/* 顶部标题条占位 */}
      <div className="px-4 pt-4 pb-3 border-b border-[#f1f1f1]">
        <div className={BLOCK} style={{ width: 92, height: 16 }} />
        <div className={BLOCK} style={{ width: 168, height: 11, marginTop: 10 }} />
      </div>

      {/* 内容卡片占位 */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border border-[#f1f1f1] rounded-[4px] p-3.5 flex flex-col gap-2.5">
            <div className={BLOCK} style={{ width: `${64 - i * 9}%`, height: 13 }} />
            <div className={BLOCK} style={{ width: '94%', height: 11 }} />
            <div className={BLOCK} style={{ width: `${52 + i * 8}%`, height: 11 }} />
            <div className="flex items-center gap-2 pt-1">
              <div className={BLOCK} style={{ width: 20, height: 20, borderRadius: 999 }} />
              <div className={BLOCK} style={{ width: 64, height: 10 }} />
            </div>
          </div>
        ))}

        {/* 明确的状态文案，避免用户以为白屏 */}
        <div className="flex items-center justify-center gap-2 mt-2 text-[#a9a9a9]" style={{ fontSize: 12 }}>
          <span
            className="animate-spin inline-block"
            style={{ width: 13, height: 13, border: '2px solid #e6e6e6', borderTopColor: '#c2410c', borderRadius: '50%' }}
          />
          正在加载…
        </div>
      </div>
    </div>
  )
}
