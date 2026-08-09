import { useState, useEffect } from 'react'
import { agnesChat, SearchMeta } from '../lib/agnes'
import { SYSTEM_IDENTITY } from '../lib/prompts'
import { renderReport, ThemeKey } from '../components/Report'
import { exportDocx } from '../lib/docx'
import { addQuery, newId } from '../lib/history'

// 实时资讯台：把「文档工坊」改为「实时信息查询」。
// 每个视角（学校/就业/生活学习/各省通知）实时检索最新公开资料，再由 AI 整理成清晰中文输出
// （直接展示原始检索片段会偶发暴露上游乱码，故走「检索 + 模型整理」路径，中文稳定可靠）。
const TABS = [
  {
    key: 'school',
    label: '🏫 学校信息',
    theme: 'school' as ThemeKey,
    prompt: '请侧重「院校/专业」视角：办学层次、排名、招生与录取、保研就业、食宿生活等关键信息。',
    placeholder: '输入学校或专业，如：清华大学 / 计算机',
    examples: ['清华大学', '四川大学', '计算机专业', '深圳大学']
  },
  {
    key: 'job',
    label: '💼 就业信息',
    theme: 'by-city' as ThemeKey,
    prompt: '请侧重「就业/求职」视角：行业前景、薪资行情、招聘规模、代表企业、入行门槛与避雷点。',
    placeholder: '输入行业或岗位，如：人工智能 / 程序员',
    examples: ['人工智能行业', '新能源汽车', '成都程序员薪资', '教师编制']
  },
  {
    key: 'life',
    label: '🏠 生活学习',
    theme: 'by-city' as ThemeKey,
    prompt: '请侧重「生活与学习」视角：城市生活成本、租房物价、校园食宿、学习环境与通勤等真实细节。',
    placeholder: '输入城市或话题，如：成都生活成本',
    examples: ['北京生活成本', '大学宿舍条件', '广州租房', '考研自习环境']
  },
  {
    key: 'notice',
    label: '📢 各省通知',
    theme: 'school' as ThemeKey,
    prompt: '请侧重「各省招生/政策通知」视角：高考安排、志愿填报时间、招生计划、分数线公布、政策变动等，并标注发布时间与来源。',
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

const INFO_PROMPT = `你是择校通实时资讯助手。用户给出一个关键词（学校 / 专业 / 行业 / 城市 / 省份通知等）。请基于已检索到的最新公开资料，用清晰、有颗粒度的中文输出该视角下的关键信息摘要。
要求：
① 优先采信检索资料中的具体数字、时间、政策原文，并在关键事实后用【资料·来源·时间】标注；
② 用 ===板块名=== 分板块（如「核心信息」「最新动态」「数据明细」「重点提醒」），板块之间不漏；
③ 最关键的数字 / 结论 / 风险点用 **双星号** 包裹（前端自动加粗标红）；
④ 凡无法从检索或自身知识确认的事实写「暂无法确认」，绝不编造；
⑤ 语调直接、接地气，像过来人给建议。`

export default function DocWorkshop() {
  const [tab, setTab] = useState<TabKey>('school')
  const cur = TABS.find((t) => t.key === tab)!
  const [req, setReq] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null)
  const [searched, setSearched] = useState(false)

  // 切换 tab 时清空结果
  useEffect(() => {
    setResult('')
    setSearchMeta(null)
    setError('')
    setSearched(false)
  }, [tab])

  async function run(override?: string) {
    const text = (override ?? req).trim()
    if (!text || loading) return
    setError('')
    setLoading(true)
    setResult('')
    setSearchMeta(null)
    setSearched(true)
    try {
      const { content, search } = await agnesChat(
        [
          { role: 'system', content: `${SYSTEM_IDENTITY}\n\n${INFO_PROMPT}\n\n视角要求：${cur.prompt}` },
          { role: 'user', content: `${text}（请结合最新公开资料，侧重「${cur.label.replace(/^[^ ]+ /, '')}」视角回答）` }
        ],
        { autoSearch: true, maxTokens: 6000 }
      )
      setResult(content)
      setSearchMeta(search ?? null)
      addQuery({
        id: newId(),
        pageKey: 'document-workshop',
        channel: tab,
        pageLabel: '实时资讯',
        question: text,
        answer: content,
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
        <p>输入学校 / 就业 / 生活学习 / 各省通知相关关键词，平台实时检索最新公开资料并由 AI 整理成清晰信息——查动态、政策与真实资料，辅助你做决策。</p>
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
                {loading ? '查询中…' : '实时查询'}
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
          <span className="who">实时信息</span>
          {loading && <span className="meta">· 正在检索最新公开资料并整理…</span>}
          {!loading && searchMeta?.ok && (
            <span className="meta ok">
              🌐 已参考 {searchMeta.count} 条公开资料（{searchMeta.sources.map(srcLabel).join(' · ')}）
            </span>
          )}
          {!loading && searchMeta && !searchMeta.ok && <span className="meta warn">⚠️ 暂未检索到相关公开资料，已按已有知识作答</span>}
        </div>
        <div className="panel-body">
          {!searched && !loading && (
            <div className="note">在上方输入关键词点「实时查询」，平台会实时检索新闻 / 网页 / 维基 / 实时检索等多来源，并由 AI 整理成清晰可辨的信息摘要，关键事实标注来源。</div>
          )}
          {loading && (
            <div className="loading">
              <span className="spinner" /> 正在检索「{cur.label.replace(/^[^ ]+ /, '')}」相关最新资料并整理成摘要…
            </div>
          )}
          {error && <div className="err">出错了：{error}</div>}

          {!loading && searchMeta?.image?.url && (
            <figure className="lead-photo">
              <img src={searchMeta.image.url} alt={searchMeta.image.title || '配图'} loading="lazy" referrerPolicy="no-referrer" />
              <figcaption>配图 · {searchMeta.image.title || '真实资料图'}</figcaption>
            </figure>
          )}

          {!loading && result && (
            <>
              <div className="report">{renderReport(result, cur.theme)}</div>
              <div className="toolbar">
                <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(result).catch(() => {})}>
                  复制
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => exportDocx('实时资讯', cur.label, result)}>
                  导出 Word
                </button>
              </div>
            </>
          )}

          {!loading && searched && !result && !error && (
            <div className="note">没有检索到关于「{req}」的可用信息，换个关键词或省份试试。</div>
          )}
        </div>
      </div>
    </>
  )
}
