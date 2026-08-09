// agnes-search — Supabase Edge Function (Deno)
// 「搜索增强层」：服务端联网检索真实资料，再把「检索结果 + 用户问题」转发给
// 现有的 v9 agnes-proxy（Agnes 平台，agnes-2.0-flash，已验证可用）生成回答。
//
// 设计要点：
//  - 不改动现在能跑的 v9 / Agnes 配置，只是套一层搜索。
//  - 搜索源：**无需任何外部密钥即可联网**。动态/新闻类（Google News 中文 RSS、
//    Hacker News、Bing 网页摘要、Reddit 社区）+ 百科类（中文/英文维基 + DuckDuckGo 兜底）。
//    可选密钥（Tavily / Brave / Serper）仅在配置后启用，作为进一步的质量升级。
//    Edge 节点（悉尼）出网不受国内 GFW 限制，浏览器在国内也能稳定抓到数据。
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

// 平台身份指令：在转发 v9 时强制注入到 system 最前，盖掉模型自带的「Agnes / Sapiens AI」
// 等固有身份，确保所有路径下用户都只看到「择校通助手」，不泄露底层模型/供应商。
const PLATFORM_IDENTITY = `你是「择校通」平台官方提供的 AI 助手，名字叫「择校通助手」。
你的职责是帮助用户做择校、求职、搞钱相关的理性决策。
【绝对纪律】严禁向用户透露你底层的模型名称、技术供应商或开发方（例如不得提及 Agnes、Sapiens、任何大模型或公司名）。
若用户问你「是什么模型 / 谁开发的 / 你的训练数据」，只能回答：「我是择校通平台的 AI 助手，专门帮你做择校、求职与搞钱决策。」除此之外不要补充任何技术细节。`

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

// —— 检索片段相关性过滤 ——
// 目的：剔除与问题主体无关的噪声片段（如某次出现的「廪学」乱入），避免污染生成模型。
// 思路：抽取 query 的「去重汉字集合 + 年份 + 关键领域词」，保留的片段需满足其一：
//   ① 与 query 共享的汉字数 ≥ 阈值（长 query 需 ≥2，极短 query 需全命中）；
//   ② 命中 query 中的年份（如 2025）；
//   ③ 命中 query 与片段共有的关键领域词（录取/薪资/政策…）。
// 纯英文 / 纯数字 query（无汉字也无年份/关键词）则不做过滤，避免误杀。
const KEYWORDS = [
  '录取', '分数', '分数线', '成绩', '薪资', '工资', '待遇', '收入', '月薪', '年薪',
  '招聘', '政策', '通知', '大学', '学院', '学校', '公司', '企业', '城市', '就业',
  '专业', '高考', '本科', '专科', '研究生', '考研', '留学', '宿舍', '食堂', '学费',
  '排名', '公办', '民办', '双一流', '985', '211', '专业组', '位次', '志愿', '批次'
]
function relevanceInfo(query: string) {
  const qcjk = Array.from(new Set((query.match(/[一-龥]/g) || [])))
  const years = query.match(/(?:19|20)\d{2}/g) || []
  const kw = KEYWORDS.filter((k) => query.includes(k))
  return { qcjk, years, kw }
}
function isRelevant(snippet: string, info: ReturnType<typeof relevanceInfo>): boolean {
  if (info.qcjk.length === 0 && info.years.length === 0 && info.kw.length === 0) return true
  const scjk = new Set((snippet.match(/[一-龥]/g) || []))
  let shared = 0
  for (const c of info.qcjk) if (scjk.has(c)) shared++
  const need = info.qcjk.length <= 2 ? info.qcjk.length : 2
  if (shared >= need) return true
  if (info.years.some((y) => snippet.includes(y))) return true
  if (info.kw.some((k) => snippet.includes(k))) return true
  return false
}

// 单次带超时的 fetch
async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 6000): Promise<Response> {
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
    const buf = await r.arrayBuffer()
    let html = new TextDecoder('utf-8').decode(buf)
    if (html.includes('�')) { try { html = new TextDecoder('gbk').decode(buf) } catch {} }
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

// 维基百科题图（REST summary）：给 AI 报告配「真实学校/实体照片」。
// 仅作点缀，失败不影响主回答。Edge 节点（悉尼）可稳定访问维基。
async function fetchLeadImage(q: string): Promise<{ url: string; title: string } | null> {
  for (const lang of ['zh', 'en'] as const) {
    try {
      const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`
      const r = await fetchWithTimeout(url, { headers: { 'User-Agent': 'zexiaotong/1.0 (image)' } }, 6000)
      if (!r.ok) continue
      const j = await r.json()
      const thumb = j?.thumbnail?.source
      if (thumb) return { url: thumb, title: j?.title || q }
    } catch {
      /* ignore */
    }
  }
  return null
}

interface SearchResult {
  results: string[]
  sources: string[]
  ok: boolean
}

// —— 动态 / 新闻类（免 key）——
// Google News 中文 RSS：拿到最新新闻标题与来源，最适合「最新」「近期」「新闻」类查询。
async function searchGoogleNews(q: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const url =
      'https://news.google.com/rss/search?q=' +
      encodeURIComponent(q) +
      '&hl=zh-CN&gl=CN&ceid=CN:zh-Hans'
    const r = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; zexiaotong/1.0)' }
    })
    const buf = await r.arrayBuffer()
    let xml = new TextDecoder('utf-8').decode(buf)
    if (xml.includes('�')) { try { xml = new TextDecoder('gbk').decode(buf) } catch {} }
    const items: string[] = []
    const re = /<item>([\s\S]*?)<\/item>/g
    let m: RegExpExecArray | null
    let i = 0
    while ((m = re.exec(xml)) !== null && i < 6) {
      const block = m[1]
      const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
      const src = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || ''
      const t = stripHtml(title).replace(/\s+-\s+[^-]+$/, '') // 去掉末尾 " - 来源"
      if (t) items.push('- 【新闻】' + t + (src ? `（${stripHtml(src)}）` : ''))
      i++
    }
    return { items, ok: items.length > 0 }
  } catch {
    return { items: [], ok: false }
  }
}

// Hacker News（Algolia API）：科技 / 创业 / 产品类讨论，JSON 免 key，稳定。
async function searchHackerNews(q: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const url = 'https://hn.algolia.com/api/v1/search?query=' + encodeURIComponent(q) + '&hitsPerPage=5'
    const r = await fetchWithTimeout(url, { headers: { 'User-Agent': 'zexiaotong/1.0' } })
    const j = await r.json()
    const items = (j.hits || [])
      .slice(0, 5)
      .map((h: any) => {
        const pts = h.points != null ? `（👍${h.points}）` : ''
        const d = h.created_at ? ` ${String(h.created_at).slice(0, 10)}` : ''
        return `- 【讨论】${stripHtml(h.title || '')}${pts}${d}`
      })
    return { items, ok: items.length > 0 }
  } catch {
    return { items: [], ok: false }
  }
}

// Bing 网页搜索：通用网页摘要，覆盖面广，但偶有反爬挑战页（检测到就跳过）。
// 注意：Bing 中文结果可能以 GBK 返回，Deno 默认按 UTF-8 解出乱码，故用 arrayBuffer 双解码兜底。
async function searchBing(q: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const url = 'https://www.bing.com/search?q=' + encodeURIComponent(q) + '&setlang=zh-CN&cc=CN'
    const r = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    const buf = await r.arrayBuffer()
    let html = new TextDecoder('utf-8').decode(buf)
    if (html.includes('�')) {
      try { html = new TextDecoder('gbk').decode(buf) } catch { /* keep utf-8 */ }
    }
    if (/verify you are human|CAPTCHA|异常访问|启用 JavaScript|are you a robot/i.test(html)) {
      return { items: [], ok: false }
    }
    const snippets: string[] = []
    const re = /<li class="b_algo"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g
    let m: RegExpExecArray | null
    let i = 0
    while ((m = re.exec(html)) !== null && i < 6) {
      const txt = stripHtml(m[1])
      if (txt && txt.length > 15) snippets.push('- ' + txt.slice(0, 200))
      i++
    }
    return { items: snippets, ok: snippets.length > 0 }
  } catch {
    return { items: [], ok: false }
  }
}

// Reddit 社区讨论：真实用户观点，对「体验」「口碑」「避雷」类问题有价值。
async function searchReddit(q: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const url = 'https://www.reddit.com/search.json?q=' + encodeURIComponent(q) + '&limit=5&sort=relevance'
    const r = await fetchWithTimeout(url, { headers: { 'User-Agent': 'zexiaotong/1.0 by researcher' } })
    const j = await r.json()
    const items = (j.data?.children || [])
      .slice(0, 5)
      .map((c: any) => {
        const d = c.data || {}
        const txt = String(d.selftext || d.title || '').slice(0, 180)
        return `- 【社区】r/${d.subreddit || '?'}：${stripHtml(txt)}`
      })
    return { items, ok: items.length > 0 }
  } catch {
    return { items: [], ok: false }
  }
}

// 多源并发检索，收集任意成功源的结果
async function searchMulti(query: string): Promise<SearchResult> {
  const tokens = query.split(' ').filter(Boolean)
  const wikiQueries = Array.from(new Set([query, ...tokens])).slice(0, 3) // 整句 + 分词，多候选回退

  const tasks: Promise<{ items: string[]; ok: boolean; src: string }>[] = []

  // 有密钥则优先用可靠商业源（Tavily 已配置，覆盖实时检索；中文经模型整理输出，规避上游偶发乱码）
  if (SEARCH_KEY) {
    const keySrc = SEARCH_PROVIDER === 'brave' ? 'brave' : SEARCH_PROVIDER === 'serper' ? 'serper' : 'tavily'
    const p = keySrc === 'brave' ? searchBrave : keySrc === 'serper' ? searchSerper : searchTavily
    tasks.push(s2(p(query), keySrc))
  }

  // 动态 / 新闻源（最新信息，优先注入模型上下文）
  tasks.push(s2(searchGoogleNews(query), 'gnews'))
  tasks.push(s2(searchHackerNews(query), 'hn'))
  // 注：Bing 中文结果常返回 GBK，而 Edge(Deno) 运行时 TextDecoder 不支持 gbk，
  // 解出乱码；中文检索已由 tavily(实时) + gnews(新闻) + 维基(百科) 充分覆盖，故移除 Bing。
  // tasks.push(s2(searchBing(query), 'bing'))
  tasks.push(s2(searchReddit(query), 'reddit'))

  // 百科兜底源：维基（中/英，多候选并发）+ DuckDuckGo
  for (const c of wikiQueries) tasks.push(s2(searchWikipedia(c, 'zh'), 'wiki-zh'))
  for (const c of wikiQueries) tasks.push(s2(searchWikipedia(c, 'en'), 'wiki-en'))
  tasks.push(s2(searchDuckDuckGo(query), 'ddg'))

  const settled = await Promise.all(tasks)
  const sources: string[] = []
  const dyn: string[] = []
  const wiki: string[] = []
  const seen = new Set<string>()
  const rt = relevanceInfo(query)
  for (const s of settled) {
    if (s.ok && s.items.length) {
      const base = s.src.split(':')[0] // gnews / hn / bing / reddit / wiki-zh / wiki-en / ddg / tavily / brave / serper
      if (!sources.includes(base)) sources.push(base)
      const bucket = base === 'wiki-zh' || base === 'wiki-en' || base === 'ddg' ? wiki : dyn
      for (const raw of s.items) {
        if (raw.includes('�')) continue // 丢弃乱码片段，避免污染生成模型
        const it = raw.length > 320 ? raw.slice(0, 320) + '…' : raw
        if (!isRelevant(it, rt)) continue // 丢弃与问题主体无关的噪声片段
        if (!seen.has(it)) { seen.add(it); bucket.push(it) }
      }
    }
  }
  // 动态源优先（最多 12 条），维基兜底（最多 6 条），合计 18 条上限
  const merged = [...dyn.slice(0, 12), ...wiki.slice(0, 6)]
  return { results: merged, sources, ok: merged.length > 0 }
}

function s2(p: Promise<{ items: string[]; ok: boolean }>, src: string) {
  return p.then((r) => ({ ...r, src }))
}

// —— 检索决策器：让模型判断「这个问题是否需要检索最新公开资料才能准确回答」——
// 纯历史 / 概念 / 常识 / 数学 / 创作 / 闲聊类无需检索；涉及具体院校 / 公司 / 城市当前信息、
// 最新政策 / 实时数据 / 新闻类则需要。返回 true 才真正发起多源检索（省额度、降延迟）。
// 含具体实体 / 当前信息 / 政策 / 数据的线索词：命中则不应判为「无需检索」
const ENTITY_KW = [
  '大学', '学院', '学校', '公司', '企业', '城市', '省份', '省', '市', '县',
  '政策', '分数线', '分数', '薪资', '工资', '招聘', '新闻', '就业', '专业',
  '考研', '高考', '留学', '录取', '排名', '公办', '民办', '双一流', '本科', '专科', '202'
]
// 本地快检：明显无需检索的纯问题（纯算术 / 问候 / 纯创作 / 纯概念），直接判定「不检索」，
// 省一次模型往返（模型判断调用在 Edge 内偶发超时，本地快检可兜底常见 trivial 场景，避免无谓检索与延迟）。
function looksTrivial(q: string): boolean {
  const t = (q || '').trim()
  if (!t) return true
  // 纯符号算术（1+1, 2*3, (1+2) 等）
  if (new RegExp('^[\\d\\s.+*/=()-]+$').test(t)) return true
  // 中文算术式：数字 + 运算符 + 数字，如「1加1等于几」「5乘以3是多少」
  if (/\d+\s*(加|减|乘|除|加上|减去|乘以|除以)\s*\d+/.test(t)) return true
  // 简单问候 / 致谢 / 闲聊（用字符串构造，避免 \b? 等写法在 Deno 解析下的问题）
  if (new RegExp('^(你好|您好|hi|hello|hey|在吗|谢谢|感谢|thanks|再见|拜拜|哈喽|嗨)$', 'i').test(t)) return true
  // 无具体实体线索时，纯创作 / 纯概念定义也无需检索
  const hasEntity = ENTITY_KW.some((k) => t.includes(k))
  if (!hasEntity) {
    // 纯创作：写/作/编/画/翻译 + 创作对象（诗/故事/简历…）
    if (/(写|作|编|创作|画|翻译|生成|描述).{0,10}(诗|词|故事|笑话|文章|作文|小说|歌|文案|简历|段子|绕口令|祝福语|演讲稿)/.test(t)) return true
    // 纯概念定义：什么是 / 是什么意思 / 解释 / 怎么理解
    if (/(什么是|是什么意思|的定义|解释一下|怎么理解|如何理解)/.test(t)) return true
  }
  return false
}

async function decideSearch(q: string): Promise<boolean> {
  if (!q) return false
  if (looksTrivial(q)) return false
  try {
    const r = await fetchWithTimeout(
      `${V9_BASE}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${V9_ANON}`
        },
        body: JSON.stringify({
          model: V9_MODEL,
          max_tokens: 64,
          temperature: 0,
          messages: [
            {
            role: 'system',
            content:
              '你是检索调度器。判断用户问题是否需要检索最新公开资料才能准确回答。规则：除非用户问题明显是纯数学计算、纯概念定义、纯闲聊、纯创作（且不涉及任何具体实体/当前信息/政策/数据），否则回复 NEED。当用户提到具体学校/公司/城市/省份/政策/分数线/薪资/招聘/新闻/具体年份/当前事件，必须回复 NEED。只回复一个词：NEED 或 NO。'
          },
            { role: 'user', content: q }
          ]
        })
      },
      20000
    )
    const j = await r.json()
    const msg = j?.choices?.[0]?.message || {}
    // agnes-2.0-flash 是推理模型：tiny 预算下答案常落在 reasoning_content，content 可能为空。
    // 同时读取两处，用 NEED / NO 信号判定，避免「content 为空 → 默认检索」的误判。
    const combined = String(msg.content || '') + ' ' + String(msg.reasoning_content || '')
    const hasNeed = /NEED|需要检索|必须检索|应.*检索|要检索/i.test(combined)
    const hasNo = /NO|不需要检索|不检索|无需检索|不必检索/i.test(combined)
    if (hasNeed) return true
    if (hasNo) return false
    // 命中不清则默认检索（保持原行为，不退化成无资料作答）
    return true
  } catch {
    // 决策失败则默认检索（保持原行为，不退化成无资料作答）
    return true
  }
}

// 仅探测各源出网情况（调试用，不调用模型）
async function probe(): Promise<Record<string, boolean>> {
  const q = '清华大学'
  const out: Record<string, boolean> = {}
  const runs: [string, Promise<{ ok: boolean }>][] = [
    ['wiki-zh', searchWikipedia(q, 'zh')],
    ['wiki-en', searchWikipedia(q, 'en')],
    ['ddg', searchDuckDuckGo(q)],
    ['gnews', searchGoogleNews(q)],
    ['hn', searchHackerNews(q)],
    ['bing', searchBing(q)],
    ['reddit', searchReddit(q)]
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
  const autoSearch = !!body.auto_search
  const searchOnly = !!body.search_only

  // 把 system / 非 system 分开，避免污染
  const sysMessages = messages.filter((m) => m.role === 'system')
  const otherMessages = messages.filter((m) => m.role !== 'system')

  const rawUser = lastUserText(otherMessages)
  const query = extractQuery(rawUser)

  // 是否需要检索：search_only 强制检索；auto_search 由模型判断；web_search 强制；否则不检索
  let needSearch = false
  if (searchOnly) {
    needSearch = !!query
  } else if (autoSearch) {
    needSearch = await decideSearch(query)
  } else if (webSearch) {
    needSearch = !!query
  }

  let searchMeta: { ok: boolean; count: number; sources: string[]; image: { url: string; title: string } | null } = {
    ok: false,
    count: 0,
    sources: [] as string[],
    image: null
  }
  let rawResults: string[] = []

  if (needSearch && query) {
    const ctx = await searchMulti(query)
    searchMeta = { ok: ctx.ok, count: ctx.results.length, sources: ctx.sources, image: null }
    rawResults = ctx.results
    if (ctx.ok && !searchOnly) {
      sysMessages.push({
        role: 'system',
        content:
          '你具备查阅最新公开资料的能力。以下是针对用户问题检索到的资料（来自网络，可能不保证 100% 最新，请批判性采用，优先采信可交叉验证的事实）：\n' +
          '<search>\n' +
          ctx.results.join('\n') +
          '\n</search>\n' +
          '要求：① 优先依据上述资料作答，并在关键事实后用「（来源：xxx）」标注；' +
          '② 若资料不足以回答，明确说明「未检索到确切信息」，不要编造；' +
          '③ 涉及排名/分数/政策等易变数据，提醒用户以官方最新公布为准。'
      })
    }
  }

  // 真实题图（与检索并行获取，失败不影响主回答）
  const imagePromise = needSearch && query ? fetchLeadImage(query) : Promise.resolve(null)

  // —— 实时资讯模式：只返回检索结果，不调用生成模型（低延迟、直接展示来源）——
  if (searchOnly) {
    const image = await imagePromise.catch(() => null)
    return json(
      {
        results: rawResults,
        search: { ...searchMeta, image },
        // 兼容 OpenAI 形状，避免前端误判
        choices: [{ message: { content: '' } }]
      },
      200
    )
  }

  // 转发给现有 v9（Agnes）—— 强制在最前注入平台身份，盖掉模型固有身份
  sysMessages.unshift({ role: 'system', content: PLATFORM_IDENTITY })
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
  const image = await imagePromise.catch(() => null)
  // 把搜索元数据（含真实题图）附到返回体，供前端诚实标注与配图
  const enriched = { ...data, search: { ...searchMeta, image } }
  return json(enriched, upstream.status)
})
