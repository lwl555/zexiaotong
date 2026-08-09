import { useState, useEffect } from 'react'
import { agnesChat, SearchMeta } from '../lib/agnes'
import { addQuery, newId } from '../lib/history'

// 实时资讯台：把「文档工坊」改为「实时信息查询」，分 4 个视角检索并即时展示公开资料来源。
// 调用 Edge Function 的 search_only 模式（直接返回检索片段，不调用生成模型，低延迟、实时显示）。
const TABS = [
  {
    key: 'school',
    label: '🏫 学校信息',
    boost: '学校 院校 招生 官网 简介 排名 分数线 专业 保研率',
    placeholder: '输入学校或专业，如：清华大学 / 计算机',
    examples: ['清华大学', '四川大学', '计算机专业', '深圳大学']
  },
  {
    key: 'job',
    label: '💼 就业信息',
    boost: '就业 招聘 薪资 行业 前景 岗位 校招 裁员',
    placeholder: '输入行业或岗位，如：人工智能 / 程序员',
    examples: ['人工智能行业', '新能源汽车', '成都程序员薪资', '教师编制']
  },
  {
    key: 'life',
    label: '🏠 生活学习',
    boost: '生活成本 宿舍 食堂 学习环境 城市 租房 通勤 物价',
    placeholder: '输入城市或话题，如：成都生活成本',
    examples: ['北京生活成本', '大学宿舍条件', '广州租房', '考研自习环境']
  },
  {
    key: 'notice',
    label: '📢 各省通知',
    boost: '2026 高考 招生 政策 通知 省教育考试院 志愿填报 分数线 招生计划',
    placeholder: '输入省份+年份，如：广东省2026高考',
    examples: ['广东省2026高考通知', '河南省志愿填报时间', '江苏省招生计划', '浙江省分数线']
  }
] as const

type TabKey = (typeof TABS)[number]['key']

// 来源英文 key → 中文标签
const SRC_LABEL: Record<string, string> = {
  gnews: '新闻',
  hn: '技术讨论',
  bing: '网页',
  reddit: '社区',
  'wiki-zh': '维基(中)',
  'wiki-en': '维基(英)',
  ddg: '网页',
  tavily: '实时检索',
  brave: '检索',
  serper: '检索'
}
const srcLabel = (s: string) => SRC_LABEL[s] || s

// 从一行检索片段里提取【来源】标签与正文
function parseSnippet(line: string): { tag: string; text: string } {
  const m = line.match(/^-\s*(?:【([^】]+)】)?\s*([\s\S]*)$/)
  if (m) return { tag: m[1] || '资料', text: m[2].trim() }
  return { tag: '资料', text: line.replace(/^-\s*/, '').trim() }
}

export default function DocWorkshop() {
  const [tab, setTab] = useState<TabKey>('school')
  const cur = TABS.find((t) => t.key === tab)!
  const [req, setReq] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<string[]>([])
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null)
  const [searched, setSearched] = useState(false)

  // 切换 tab 时清空结果
  useEffect(() => {
    setResults([])
    setSearchMeta(null)
    setError('')
    setSearched(false)
  }, [tab])

  async function run(override?: string) {
    const text = (override ?? req).trim()
    if (!text || loading) return
    setError('')
    setLoading(true)
    setResults([])
    setSearchMeta(null)
    setSearched(true)
    try {
      const q = `${text} ${cur.boost}`
      const { results: r, search } = await agnesChat([{ role: 'user', content: q }], {
        searchOnly: true,
        maxTokens: 2000
      })
      setResults(r || [])
      setSearchMeta(search ?? null)
      addQuery({
        id: newId(),
        pageKey: 'document-workshop',
        channel: tab,
        pageLabel: '实时资讯',
        question: text,
        answer: (r || []).slice(0, 6).join('\n'),
        search: search ?? null,
        image: search?.image ?? null,
        createdAt: Date.now()
      })
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <h2>实时资讯台</h2>
        <p>输入学校 / 就业 / 生活学习 / 各省通知相关关键词，平台实时检索公开资料并分来源展示——查最新动态、政策与真实信息，辅助你做决策。</p>
      </div>

      <div className="info-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={t.key === tab ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-body">
          <div className="field" style={{ marginBottom: 12 }}>
            <label>搜索「{cur.label.replace(/^[^ ]+ /, '')}」相关实时信息</label>
            <div className="info-search">
              <input
                value={req}
                placeholder={cur.placeholder}
                onChange={(e) => setReq(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && run()}
              />
              <button className="btn btn-primary" onClick={() => run()} disabled={loading || !req.trim()}>
                {loading ? '检索中…' : '实时查询'}
              </button>
            </div>
          </div>
          <div className="chips-wrap">
            <div className="chips-label">热门：</div>
            <div className="chips">
              {cur.examples.map((ex) => (
                <button key={ex} className="chip" onClick={() => run(ex)} disabled={loading}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="who">检索结果</span>
          {loading && <span className="meta">· 正在检索最新公开资料…</span>}
          {!loading && searchMeta?.ok && (
            <span className="meta ok">
              🌐 已参考 {searchMeta.count} 条（{searchMeta.sources.map(srcLabel).join(' · ')}）
            </span>
          )}
          {!loading && searchMeta && !searchMeta.ok && <span className="meta warn">⚠️ 暂未检索到相关公开资料</span>}
        </div>
        <div className="panel-body">
          {!searched && !loading && (
            <div className="note">在上方输入关键词点「实时查询」，平台会从新闻 / 网页 / 维基 / 社区等多来源检索，并分条展示真实资料片段。</div>
          )}
          {loading && (
            <div className="loading">
              <span className="spinner" /> 正在检索「{cur.label.replace(/^[^ ]+ /, '')}」相关最新资料，结果将按来源逐一列出…
            </div>
          )}
          {error && <div className="err">出错了：{error}</div>}

          {!loading && searchMeta?.image?.url && (
            <figure className="lead-photo">
              <img src={searchMeta.image.url} alt={searchMeta.image.title || '配图'} loading="lazy" referrerPolicy="no-referrer" />
              <figcaption>配图 · {searchMeta.image.title || '真实资料图'}</figcaption>
            </figure>
          )}

          {!loading && results.length > 0 && (
            <div className="snippets">
              {results.map((line, i) => {
                const { tag, text } = parseSnippet(line)
                return (
                  <div className="snippet" key={i}>
                    <span className="snip-tag">{tag}</span>
                    <span className="snip-text">{text}</span>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && searched && results.length === 0 && !error && (
            <div className="note">没有检索到关于「{req}」的公开资料，换个关键词或省份试试。</div>
          )}
        </div>
      </div>
    </>
  )
}
