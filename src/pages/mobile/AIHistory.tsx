import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Clock, Search, Bot, FileText, AlertTriangle, Trash2 } from 'lucide-react'
import { getQueries, deleteQuery, QueryRecord } from '../../lib/history'

const SRC_LABEL: Record<string, string> = {
  gnews: '新闻', hn: '技术讨论', bing: '网页', reddit: '社区',
  'wiki-zh': '维基(中)', 'wiki-en': '维基(英)', ddg: 'DuckDuckGo',
  tavily: '综合检索', brave: 'Brave', serper: 'Serper', baidu: '百度'
}

export default function AIHistory() {
  const nav = useNavigate()
  const [queries, setQueries] = useState<QueryRecord[]>(() => getQueries())
  const [kw, setKw] = useState('')

  const filtered = kw
    ? queries.filter(q => q.question.includes(kw) || q.answer.includes(kw) || q.pageLabel.includes(kw))
    : queries

  const handleDelete = (id: string) => {
    deleteQuery(id)
    setQueries(getQueries())
  }

  const handleClearAll = () => {
    if (confirm('确定清空所有查询记录？')) {
      getQueries().forEach(q => deleteQuery(q.id))
      setQueries([])
    }
  }

  // 按日期分组
  const grouped: Record<string, QueryRecord[]> = {}
  filtered.forEach(q => {
    const d = new Date(q.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(q)
  })

  return (
    <div className="px-4 pt-3 pb-10">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => nav(-1)} className="text-gray-400"><ChevronLeft size={20} /></button>
        <h1 className="text-lg font-black text-ink flex-1">AI 查询记录</h1>
        {queries.length > 0 && (
          <button onClick={handleClearAll} className="text-xs text-red-500">清空</button>
        )}
      </div>

      {queries.length > 0 && (
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5 mb-3">
          <Search size={18} className="text-gray-400" />
          <input className="bg-transparent outline-none text-sm flex-1" placeholder="搜索查询记录" value={kw} onChange={e => setKw(e.target.value)} />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-16">
          {kw ? '没有匹配的记录' : '还没有 AI 查询记录'}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).reverse().map(([date, items]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={12} className="text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">{date}</span>
              </div>
              <div className="space-y-2">
                {items.map(q => (
                  <div key={q.id} className="card p-3 active:scale-[.99] transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-medium">{q.pageLabel}</span>
                          {q.search?.ok && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700">已检索</span>}
                        </div>
                        <div className="text-sm font-medium truncate">{q.question}</div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">{q.answer}</div>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                          <span>{new Date(q.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                          {q.links && q.links.length > 0 && <span>{q.links.length} 条链接</span>}
                          {q.image && <span>有配图</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(q.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
