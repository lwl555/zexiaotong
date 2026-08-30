import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Clock, Search, Bot, FileText, AlertTriangle, Trash2 } from 'lucide-react'
import { getQueries, deleteQuery, QueryRecord } from '../../lib/history'
import {
  PageHeader,
  SectionLabel,
  SoftCard,
  BtnGhost,
  Tag,
  INK,
  MUTED,
  FAINT,
  ACCENT,
  FONT,
  MONO,
} from '../../components/Editorial'

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
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader
        eyebrow="AI History"
        title="AI 查询记录"
        desc="每一次提问与回答，按日期归档，随时回看。"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'inline-flex' }}>
              <ChevronLeft size={20} />
            </button>
            {queries.length > 0 && (
              <BtnGhost onClick={handleClearAll} style={{ padding: '7px 12px', color: ACCENT, borderColor: ACCENT }}>
                清空
              </BtnGhost>
            )}
          </div>
        }
      />

      {queries.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: `2px solid ${INK}`,
            paddingBottom: 10,
            marginBottom: 18,
          }}
        >
          <Search size={18} color={MUTED} />
          <input
            value={kw}
            onChange={e => setKw(e.target.value)}
            placeholder="搜索查询记录"
            style={{ flex: 1, border: 'none', outline: 'none', fontFamily: FONT, fontSize: 15, color: INK, background: 'transparent' }}
          />
          <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: 2 }}>
            {String(filtered.length).padStart(2, '0')}
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '64px 0' }}>
          {kw ? '没有匹配的记录' : '还没有 AI 查询记录'}
        </div>
      ) : (
        <div>
          {Object.entries(grouped).reverse().map(([date, items]) => (
            <div key={date} style={{ marginBottom: 22 }}>
              <SectionLabel label={date} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {items.map(q => (
                  <SoftCard key={q.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                        <Tag tone="accent">{q.pageLabel}</Tag>
                        {q.search?.ok && <Tag tone="line">已检索</Tag>}
                      </div>
                      <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.question}
                      </div>
                      <div style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.55 }}>{q.answer}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontFamily: MONO, fontSize: 10.5, color: FAINT, letterSpacing: 0.5 }}>
                        <span>{new Date(q.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                        {q.links && q.links.length > 0 && <span>{q.links.length} 条链接</span>}
                        {q.image && <span>有配图</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(q.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: FAINT, flexShrink: 0, display: 'inline-flex', padding: 4 }}>
                      <Trash2 size={15} />
                    </button>
                  </SoftCard>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
