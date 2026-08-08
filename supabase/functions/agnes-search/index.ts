// agnes-search — Supabase Edge Function (Deno)
// 「搜索增强层」：服务端联网检索真实资料，再把「检索结果 + 用户问题」转发给
// 现有的 v9 agnes-proxy（Agnes 平台，agnes-2.0-flash，已验证可用）生成回答。
//
// 设计要点：
//  - 不改动现在能跑的 v9 / Agnes 配置，只是套一层搜索。
//  - 搜索源：优先用可选密钥（Tavily / Brave / Serper）；否则走零成本兜底
//    （中文维基 + 英文维基 + DuckDuckGo HTML）。Edge 节点（悉尼）出网不受国内 GFW 限制，
//    所以即使浏览器在国内，这里也能稳定抓到数据。
//  - 返回体沿用 OpenAI chat/completions 形状，并额外附带 `search` 字段供前端诚实标注。
//
// 部署：
//   supabase functions deploy agnes-search --project-ref wcnssyiqitugqfmcbdhe
// 可选密钥（Supabase 后台 Functions → agnes-search → Add secret）：
//   SEARCH_API_KEY   配了就启用真·搜索（配合 SEARCH_PROVIDER）
//   SEARCH_PROVIDER  tavily | brave | serper
//
// 调试：发请求带 "__probe": true 可让函数只返回各搜索源的出网探测结果（不调用模型）。

// —— 现有 v9（Agnes）的公开地址与匿名 key（匿名 key 本就公开，用于鉴权「能否调用」）——
const V9_BASE =
  Deno.env.get('V9_BASE') ||
  'https://wcnssyiqitugqfmcbdhe.functions.supabase.co/agnes-proxy'
const V9_ANON =
  Deno.env.get('V9_ANON') ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjbnNzeWlxaXR1Z3FmbWNiZGhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDEyNzUsImV4cCI6MjA5ODk3NzI3NX0.9EfbEr7BQhZtbOwHJ3IrkOy16kcaxlmzuJuV0A2Z8Eg'
const V9_MODEL = 'agnes-2.0-flash'

const SEARCH_KEY = Deno.env.get('SEARCH_API_KEY') || ''
const SEARCH_PROVIDER = (Deno.env.get('SEARCH_PROVIDER') || '').toLowerCase()

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(data: unknown, status = 200, extra?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...(extra || {}) }
  })
}

function lastUserText(messages: any[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user') {
      if (typeof m.content === 'string') return m.content
      if (Array.isArray(m.content)) {
        const t = m.content.find((p: any) => p.type === 'text')
        if (t) return t.text
      }
    }
  }
  return ''
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

// 从用户长提示词里抠出「核心检索实体」：去掉指令词/修饰词/标点/引号，保留主体。
// 例：「用三句话介绍浙江大学，并说明它的一个明显优点和一个明显缺点」→「浙江大学」
const QUERY_STOP = [
  '请用', '请', '帮我', '分析一下', '分析', '评估', '推荐', '查一下', '查询', '查', '看一下', '看看',
  '介绍', '说明', '对比', '比较', '总结', '生成', '写', '用三句话', '用一句话', '简述', '概述',
  '说一下', '讲讲', '谈谈', '说大实话', '直说', '拆解', '深度', '维度', '多维度', '核心', '主要',
  '包括', '包含', '关于', '针对', '对于', '明显', '真实信息', '情况', '怎么样', '如何',
  '是否', '吗', '呢', '的', '了', '我', '我们', '想', '要', '需要', '一份', '报告', '简历',
  '并', '和', '与', '及', '它', '他们', '一个', '一些', '这个', '那个', '该', '院校', '学校', '公司', '城市', '找工作', '就业', '优缺点', '优点', '缺点', '亮点', '重点', '避雷', '坑'
]
function extractQuery(text: string): string {
  let q = text || ''
  q = q.replace(/[「」『』""''【】\[\]（）()《》<>]/g, ' ')
  q = q.replace(/[，。、！？；：,.!?;:\s]+/g, ' ')
  for (const s of QUERY_STOP) q = q.split(s).join(' ')
  q = q.replace(/\s+/g, ' ').trim()
  return q || text.trim()
}

// 单次带超时的 fetch
async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 9000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// —— 各搜索源 ——

async function searchTavily(q: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const r = await fetchWithTimeout(
      'https://api.tavily.com/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: SEARCH_KEY,
          query: q,
          search_depth: 'basic',
          max_results: 6,
          include_answer: false,
          language: 'zh'
        })
      },
      12000
    )
    const j = await r.json()
    const items = (j.results || [])
      .slice(0, 6)
      .map((x: any) => `- ${x.title}：${stripHtml(x.content || x.snippet || '')}`)
    return { items, ok: items.length > 0 }
  } catch {
    return { items: [], ok: false }
  }
}

async function searchBrave(q: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const r = await fetchWithTimeout(
      'https://api.search.brave.com/res/v1/web/search?q=' +
        encodeURIComponent(q) +
        '&count=6&hl=zh-cn&country=cn',
      { headers: { Accept: 'application/json', 'X-Subscription-Token': SEARCH_KEY } },
      12000
    )
    const j = await r.json()
    const items = (j.web?.results || [])
      .slice(0, 6)
      .map((x: any) => `- ${x.title}：${stripHtml(x.description || '')}`)
    return { items, ok: items.length > 0 }
  } catch {
    return { items: [], ok: false }
  }
}

async function searchSerper(q: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const r = await fetchWithTimeout(
      'https://google.serper.dev/search',
      {
        method: 'POST',
        headers: { 'X-API-KEY': SEARCH_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, gl: 'cn', hl: 'zh-cn' })
      },
      12000
    )
    const j = await r.json()
    const items = (j.organic || [])
      .slice(0, 6)
      .map((x: any) => `- ${x.title}：${stripHtml(x.snippet || '')}`)
    return { items, ok: items.length > 0 }
  } catch {
    return { items: [], ok: false }
  }
}

async function searchWikipedia(q: string, lang: 'zh' | 'en'): Promise<{ items: string[]; ok: boolean }> {
  try {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(q)}&srlimit=5&srprop=snippet&format=json`
    const r = await fetchWithTimeout(url, { headers: { 'User-Agent': 'zexiaotong/1.0 (search)' } })
    const j = await r.json()
    const items = (j.query?.search || [])
      .slice(0, 5)
      .map((x: any) => `- ${x.title}：${stripHtml(x.snippet || '')}`)
    return { items, ok: items.length > 0 }
  } catch {
    return { items: [], ok: false }
  }
}

async function searchDuckDuckGo(q: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const r = await fetchWithTimeout(
      'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q),
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; zexiaotong/1.0)' } }
    )
    const html = await r.text()
    const snippets: string[] = []
    const re = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
    let m: RegExpExecArray | null
    let i = 0
    while ((m = re.exec(html)) !== null && i < 6) {
      const txt = stripHtml(m[1])
      if (txt) snippets.push('- ' + txt)
      i++
    }
    return { items: snippets, ok: snippets.length > 0 }
  } catch {
    return { items: [], ok: false }
  }
}

interface SearchResult {
  results: string[]
  sources: string[]
  ok: boolean
}

// 多源并发检索，收集任意成功源的结果
async function searchMulti(query: string): Promise<SearchResult> {
  const tokens = query.split(' ').filter(Boolean)
  const wikiQueries = Array.from(new Set([query, ...tokens])).slice(0, 4) // 整句 + 分词，多候选回退

  const tasks: Promise<{ items: string[]; ok: boolean; src: string }>[] = []

  // 有密钥则优先用可靠商业源
  if (SEARCH_KEY) {
    const keySrc = SEARCH_PROVIDER === 'brave' ? 'brave' : SEARCH_PROVIDER === 'serper' ? 'serper' : 'tavily'
    const p = keySrc === 'brave' ? searchBrave : keySrc === 'serper' ? searchSerper : searchTavily
    tasks.push(s2(p(query), keySrc))
  }

  // 零成本兜底源：维基（中/英）多候选并发，DuckDuckGo 兜底
  for (const c of wikiQueries) tasks.push(s2(searchWikipedia(c, 'zh'), 'wiki-zh'))
  for (const c of wikiQueries) tasks.push(s2(searchWikipedia(c, 'en'), 'wiki-en'))
  tasks.push(s2(searchDuckDuckGo(query), 'ddg'))

  const settled = await Promise.all(tasks)
  const sources: string[] = []
  const results: string[] = []
  const seen = new Set<string>()
  for (const s of settled) {
    if (s.ok && s.items.length) {
      const base = s.src.split(':')[0] // wiki-zh / wiki-en / tavily / brave / serper / ddg
      if (!sources.includes(base)) sources.push(base)
      for (const it of s.items) if (!seen.has(it)) { seen.add(it); results.push(it) }
    }
  }
  return { results: results.slice(0, 12), sources, ok: results.length > 0 }
}

function s2(p: Promise<{ items: string[]; ok: boolean }>, src: string) {
  return p.then((r) => ({ ...r, src }))
}

// 仅探测各源出网情况（调试用，不调用模型）
async function probe(): Promise<Record<string, boolean>> {
  const q = '清华大学'
  const out: Record<string, boolean> = {}
  const runs: [string, Promise<{ ok: boolean }>][] = [
    ['wiki-zh', searchWikipedia(q, 'zh')],
    ['wiki-en', searchWikipedia(q, 'en')],
    ['ddg', searchDuckDuckGo(q)]
  ]
  if (SEARCH_KEY) runs.push([SEARCH_PROVIDER || 'tavily-key', searchTavily(q)])
  const res = await Promise.all(runs.map(([, p]) => p))
  runs.forEach(([name], i) => (out[name] = res[i].ok))
  return out
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  // 调试探针
  if (body.__probe) {
    return json({ probe: await probe() })
  }

  const messages: any[] = body.messages || []
  const maxTokens = Math.min(Math.max(body.max_tokens ?? 2000, 1600), 8192)
  const webSearch = !!body.web_search

  // 把 system / 非 system 分开，避免污染
  const sysMessages = messages.filter((m) => m.role === 'system')
  const otherMessages = messages.filter((m) => m.role !== 'system')

  let searchMeta = { ok: false, count: 0, sources: [] as string[] }

  if (webSearch) {
    const rawQuery = lastUserText(otherMessages)
    const query = extractQuery(rawQuery)
    if (query) {
      const ctx = await searchMulti(query)
      searchMeta = { ok: ctx.ok, count: ctx.results.length, sources: ctx.sources }
      if (ctx.ok) {
        sysMessages.push({
          role: 'system',
          content:
            '你具备联网检索能力。以下是针对用户问题实时检索到的资料（来自网络，可能不保证 100% 最新，请批判性采用，优先采信可交叉验证的事实）：\n' +
            '<search>\n' +
            ctx.results.join('\n') +
            '\n</search>\n' +
            '要求：① 优先依据上述检索资料作答，并在关键事实后用「（来源：xxx）」标注；' +
            '② 若资料不足以回答，明确说明「未检索到确切信息」，不要编造；' +
            '③ 涉及排名/分数/政策等易变数据，提醒用户以官方最新公布为准。'
        })
      }
    }
  }

  // 转发给现有 v9（Agnes）
  const upstream = await fetch(`${V9_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${V9_ANON}`
    },
    body: JSON.stringify({
      model: V9_MODEL,
      messages: [...sysMessages, ...otherMessages],
      max_tokens: maxTokens,
      stream: false,
      temperature: body.temperature ?? 0.7
    })
  })

  const data = await upstream.json().catch(() => ({}))
  // 把搜索元数据附到返回体，供前端诚实标注
  const enriched = { ...data, search: searchMeta }
  return json(enriched, upstream.status)
})
