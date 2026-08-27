import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'

// 实时资讯台：聚合社区最新动态作为招生快讯流（复用 store 已加载的 posts）
export default function News() {
  const nav = useNavigate()
  const posts = useStore(s => s.posts)
  const list = posts
    .filter(p => p.status !== 'removed')
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="px-4 pt-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[18px] font-bold text-ink">实时资讯台</h1>
        <button onClick={() => nav('/community')} className="text-sm text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full">
          去社区 ›
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-3">招生快讯、政策变动与社区动态，每日精选。</p>

      <div className="space-y-3">
        {list.length === 0 && <div className="text-center text-gray-400 text-sm py-16">暂无资讯</div>}
        {list.map(p => (
          <div key={p.id} className="card p-4">
            {p.images?.[0] && (
              <img src={p.images[0]} className="w-full h-32 object-cover rounded-xl mb-3 bg-gray-100" alt="" />
            )}
            <div
              className="font-black text-[15px] text-ink leading-snug"
              onClick={() => nav('/post/' + p.id)}
            >
              {p.title}
            </div>
            <div
              className="text-sm text-gray-500 mt-1 line-clamp-2"
              onClick={() => nav('/post/' + p.id)}
            >
              {p.content}
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <img
                  src={p.author_avatar}
                  className="w-6 h-6 rounded-full bg-gray-100"
                  alt=""
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                />
                {p.author_name}
              </div>
              <span className="text-xs text-gray-300">
                {new Date(p.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
