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
  '介绍',   '说明', '对比', '比较', '总结', '生成', '写', '用三句话', '用一句话', '简述', '概述',
  '说一下', '讲讲', '谈谈', '说大实话', '直说', '拆解', '深度', '维度', '多维度', '核心', '主要',
  '包括', '包含', '关于', '针对', '对于', '明显', '真实信息', '情况', '怎么样', '如何',
  '是否', '吗', '呢', '的', '了', '我', '我们', '想', '要', '需要', '一份', '报告', '简历',
  '该', '院校', '学校', '公司', '城市', '找工作', '就业', '优缺点', '优点', '缺点', '亮点', '重点', '避雷', '坑'
]
// 注意：「并 / 和 / 与 / 及」是连接词，不是停用词，删了会破坏实体识别（如「宿舍和食堂」变「宿舍 食堂」，
// 让 AI 把检索关键词误当作用户原话引用，参见 2026-08-13 截图 bug）。从 QUERY_STOP 中移除。
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
// 真有区分力的「具体数据/事实线索词」。**不放通用领域词**（「大学/公司/城市/就业」太宽，
// 任何财经/职场/政策文章都可能提一嘴「大学」「公司」「就业」，命中就过审会漏掉真正的无关噪声）。
const STOP_HAN = new Set('的了是我你他她它们这那一个一些这个那个和与及并或也都很就还把被让使给从到在'.split(''))
const DOMAIN_KW = [
  '录取', '分数线', '投档', '调档', '位次', '批次', '志愿',
  '薪资', '年薪', '月薪', '起薪', '工资', '待遇',
  '保研', '保研率', '考研率',
  '学费', '住宿费', '住宿', '食堂', '宿舍', '澡堂', '浴室',
  '公办', '民办', '双一流', '985', '211', '一本', '二本', '专科',
  '校招', '社招', 'offer', '裁员', '应届',
  '高考', '留学', '深造率'
]
// 问句框架词（出现于 query 首尾、不属于实体/事实本身）：剥离后派生「主体」匹配锚点，
// 避免「浙江大学怎么样」因整句严格匹配把相关结果全丢掉。
const FRAME_LEAD = /^(我想知道|我想了解一下|我想问|请问|问下|帮我|麻烦|查一下|搜一下|了解下|我想|看下|说说)/
const FRAME_TAIL = /(怎么样|如何|怎么|怎么选|如何选|选哪个|选什么|怎么办|哪些好|哪个好|好吗|好不好|行不行|可以吗|值得吗|吗|呢|是什么|是啥|评价|口碑|介绍|推荐|对比|分析|查询|了解|值得|呀|啊|哦|哈|呗|嘛)$/g
function relevanceInfo(query: string) {
  // 主体 token：query 中的连续汉字串（去单字停用词），保留原序作为短句单元
  const base = (query.match(/[一-龥]+/g) || []).filter((t) => t.length >= 2 && ![...t].every((c) => STOP_HAN.has(c)))
  // 派生「主体」：剥掉问句框架词，让「浙江大学怎么样」→「浙江大学」成为匹配锚点
  const subjects: string[] = []
  for (const t of base) {
    const s = t.replace(FRAME_LEAD, '').replace(FRAME_TAIL, '').replace(FRAME_TAIL, '')
    if (s.length >= 2 && !base.includes(s) && !subjects.includes(s)) subjects.push(s)
  }
  const tokens = [...base, ...subjects]
  const years = query.match(/(?:19|20)\d{2}/g) || []
  const kw = DOMAIN_KW.filter((k) => query.includes(k))
  return { tokens, years, kw }
}
function isRelevant(snippet: string, info: ReturnType<typeof relevanceInfo>): boolean {
  // query 没提取出任何有意义 token（纯数字/英文/太碎）：不过滤，避免误杀
  if (info.tokens.length === 0 && info.years.length === 0 && info.kw.length === 0) return true
  // 0) 强相关：snippet 直接包含 query 完整主体（去空格拼接），直接过
  const flat = info.tokens.join('')
  if (flat && flat.length >= 2 && snippet.includes(flat)) return true
  // 1) 短语匹配：snippet 必须包含 query 中某个 token 的**完整连续子串**（非单字命中），
  //    且该 token 至少 2 汉字（避免「美/大/学」这种单字高频字混入误判）
  for (const tok of info.tokens) {
    if (tok.length >= 2 && snippet.includes(tok)) return true
  }
  // 2) 弱相关兜底：query 含明确年份，snippet 也含该年份
  if (info.years.some((y) => snippet.includes(y))) return true
  // 3) 弱相关兜底：query 含具体数据线索词，snippet 也含该词
  if (info.kw.some((k) => snippet.includes(k))) return true
  return false
}

// 单次带超时的 fetch
async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 15000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// ===== 维基图片抓取公用件 =====
// 说明：Supabase Edge 共享出口 IP 易被维基限流（HTTP 429 Too Many Requests）。
// 两条对策：① 合并请求（题图+英文标题一次拿，省一次往返）；② 所有维基请求经 wikiGetJSON
// 走「合规 UA + 429 重试退避」，限流时退避 0.8/1.6/2.4s 后重试，可大幅救回被瞬时限流的请求。
const WIKI_UA = 'zexiaotong/1.0 (https://lwl555.github.io/zexiaotong; contact: zexiaotong@example.com)'

async function wikiGetJSON(url: string, ms = 15000, retries = 3): Promise<any | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetchWithTimeout(url, { headers: { 'User-Agent': WIKI_UA, Accept: 'application/json' } }, ms)
      if (r.status === 429) {
        await new Promise((res) => setTimeout(res, 800 * (attempt + 1)))
        continue
      }
      if (!r.ok) return null
      return await r.json()
    } catch {
      await new Promise((res) => setTimeout(res, 800 * (attempt + 1)))
    }
  }
  return null
}

// —— 各搜索源 ——

async function searchTavily(q: string, domains?: string[]): Promise<{ items: string[]; ok: boolean }> {
  try {
    const body: any = {
      api_key: SEARCH_KEY,
      query: q,
      // advanced 深度返回更长、更详细的正文片段；域作用域检索（社媒）必用 advanced 以拿到真实帖子内容
      search_depth: domains && domains.length ? 'advanced' : 'advanced',
      max_results: 8,
      include_answer: false,
      language: 'zh'
    }
    if (domains && domains.length) body.include_domains = domains
    const r = await fetchWithTimeout(
      'https://api.tavily.com/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      },
      25000
    )
    const j = await r.json()
    const results = (j.results || []).slice(0, 8)
    const items = results.map((x: any) => `- ${x.title}：${stripHtml(x.content || x.snippet || '')}`)
    const links: LinkInfo[] = results
      .filter((x: any) => x.url)
      .map((x: any) => ({ title: stripHtml(x.title || ''), url: String(x.url), source: 'tavily' }))
    return { items, ok: items.length > 0, links }
  } catch {
    return { items: [], ok: false, links: [] }
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
    const results = (j.web?.results || []).slice(0, 6)
    const items = results.map((x: any) => `- ${x.title}：${stripHtml(x.description || '')}`)
    const links: LinkInfo[] = results.filter((x: any) => x.url).map((x: any) => ({ title: stripHtml(x.title || ''), url: String(x.url), source: 'brave' }))
    return { items, ok: items.length > 0, links }
  } catch {
    return { items: [], ok: false, links: [] }
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
      25000
    )
    const j = await r.json()
    const results = (j.organic || []).slice(0, 6)
    const items = results.map((x: any) => `- ${x.title}：${stripHtml(x.snippet || '')}`)
    const links: LinkInfo[] = results.filter((x: any) => x.link).map((x: any) => ({ title: stripHtml(x.title || ''), url: String(x.link), source: 'serper' }))
    return { items, ok: items.length > 0, links }
  } catch {
    return { items: [], ok: false, links: [] }
  }
}

async function searchWikipedia(q: string, lang: 'zh' | 'en'): Promise<{ items: string[]; ok: boolean }> {
  try {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(q)}&srlimit=5&srprop=snippet&format=json`
    const r = await fetchWithTimeout(url, { headers: { 'User-Agent': 'zexiaotong/1.0 (search)' } })
    const j = await r.json()
    const results = (j.query?.search || []).slice(0, 5)
    const items = results.map((x: any) => `- ${x.title}：${stripHtml(x.snippet || '')}`)
    const links: LinkInfo[] = results
      .filter((x: any) => x.title)
      .map((x: any) => ({ title: x.title, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(x.title)}`, source: `wiki-${lang}` }))
    return { items, ok: items.length > 0, links }
  } catch {
    return { items: [], ok: false, links: [] }
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
    const links: LinkInfo[] = []
    const re = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
    let m: RegExpExecArray | null
    let i = 0
    while ((m = re.exec(html)) !== null && i < 6) {
      const txt = stripHtml(m[1])
      if (txt) snippets.push('- ' + txt)
      i++
    }
    // 结果链接：DDG 用 /l/?uddg=<encoded> 包装，需解出真实 URL
    const reA = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    let ma: RegExpExecArray | null
    let li = 0
    while ((ma = reA.exec(html)) !== null && li < 6) {
      let href = ma[1]
      const um = href.match(/[?&]uddg=([^&]+)/)
      if (um) { try { href = decodeURIComponent(um[1]) } catch {} }
      else if (href.startsWith('//')) href = 'https:' + href
      const title = stripHtml(ma[2]) || href
      if (/^https?:\/\//.test(href)) links.push({ title, url: href, source: 'ddg' })
      li++
    }
    return { items: snippets, ok: snippets.length > 0, links }
  } catch {
    return { items: [], ok: false, links: [] }
  }
}

// 一次请求同时拿：① 条目主图（pageimages）② 对端语言标题（langlinks）。
// 合并二者省一次往返，降低对维基的请求数，从而减少 429 触发概率。
async function fetchLeadAndEn(title: string, lang: 'zh' | 'en'): Promise<{ lead: { url: string; title: string } | null; otherTitle: string | null }> {
  const otherLang = lang === 'zh' ? 'en' : 'zh'
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json` +
    `&titles=${encodeURIComponent(title)}&prop=pageimages|langlinks` +
    `&piprop=thumbnail|original&pithumbsize=640&lllang=${otherLang}&lllimit=1&redirects=1`
  const j = await wikiGetJSON(url)
  const pages = j?.query?.pages || {}
  let lead: { url: string; title: string } | null = null
  let otherTitle: string | null = null
  for (const k of Object.keys(pages)) {
    const p = pages[k]
    const thumb = p?.thumbnail?.source || p?.original?.source
    if (thumb && !lead) lead = { url: thumb, title: p?.title || title }
    const ll = (p?.langlinks || [])[0]
    if (ll && ll['*']) otherTitle = ll['*']
  }
  return { lead, otherTitle }
}

// 从用户原始文本提取最可能的「实体名」，用于题图检索。
// 维基 pageimages 需要精确标题，不能直接用检索 query——后者是去停用词后的长串残留
// （如「四大板块详细分析浙江大学」），查维基会 missing 拿不到图。
// 从用户原始文本提取最可能的「实体名」，用于题图检索。
// 维基 pageimages 需要精确标题，不能直接用检索 query（去停用词后的长串残留）。
// 做法：先复用 extractQuery 把指令词（如「分析」）替换成空格，使「浙江大学」成为独立
// token，再从清洗后的 token 里挑末尾带实体后缀的短 token。比脆弱的正则重叠匹配稳得多。
function extractEntity(text: string): string {
  const cleaned = extractQuery(text || '')
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  for (const tok of tokens) {
    if (/(大学|学院|学校|公司|企业|集团|医院|银行|电视台|日报|市|省|县|新区)$/.test(tok) && tok.length <= 8) {
      return tok
    }
  }
  // 退路：直接从清洗文本抓「≤6 汉字 + 后缀」
  const m = cleaned.match(/[一-龥]{1,6}(大学|学院|学校|公司|企业|集团|医院|银行|电视台|日报|市|省|县|新区)/)
  if (m) return m[0]
  const han = tokens.filter((x) => /^[一-龥]+$/.test(x)).sort((a, b) => b.length - a.length)
  return han[0] || (text || '').trim()
}

// 从维基「图片生成器」拉取条目相关图片，按校园/场景关键词过滤，返回缩略图列表（最多 max 张）。
// 用于给学校/实体报告配「真实场景图」（图书馆/校门/操场/航拍等），不止一张 logo。
async function fetchWikiImages(lang: 'zh' | 'en', title: string, max = 8): Promise<{ url: string; title: string }[]> {
  try {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json` +
      `&generator=images&titles=${encodeURIComponent(title)}&gimlimit=50` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=640&redirects=1`
    const j = await wikiGetJSON(url)
    if (!j) return []
    const pages = j?.query?.pages || {}
    // 校园/生活/场景类图片才要；logo/地图/图标/文件类一律跳过。
    // 注意：特意加入「canteen/dormitory/食堂/宿舍/小吃」等**生活类**关键词——
    // 用户诉求是「接地气内部情报」，食堂/宿舍/小吃场景比图书馆/校门更贴合。
  const SCENE = /(campus|校园|校区|图书馆|library|体育馆|gym|校门|门|楼|building|aerial|航拍|风景|scenery|lake|湖|广场|square|hall|堂|stadium|操场|center|centre|中心|park|园|garden|museum|馆|lab|实验|hospital|医院|bridge|桥|street|街|road|路|全景|panorama|夜景|庄|苑|canteen|dining|dormitory|宿舍|食堂|小吃|restaurant|food|cafe|student|餐|men|kitchen|厨房|snack|coffee)/i
  const SKIP = /(logo|徽|icon|svg|map|地图|flag|旗|seal|章|stamp|印章|question|问号|commons|文件|pdf|audio|ogg|video|play|star|星|symbol|符号|thumb|占位|placeholder|stub|小作品|disambig|消歧|redirect|重定向|模板|template|200px)/i
    const out: { url: string; title: string }[] = []
    for (const k of Object.keys(pages)) {
      const p = pages[k]
      const t = (p?.title || '')
        .replace(/^File:/, '')
        .replace(/_/g, ' ')
        .replace(/\.(jpg|jpeg|png|gif|svg|webp|JPG)$/i, '') // 清洗文件后缀，避免 alt 文本出现「.JPG」
      const ii = p?.imageinfo?.[0]
      const thumb = ii?.thumburl || ii?.url
      if (!thumb) continue
      if (SKIP.test(t)) continue
      if (!SCENE.test(t)) continue
      out.push({ url: thumb, title: t })
      if (out.length >= max) break
    }
    return out
  } catch {
    return []
  }
}

// 从维基共享资源（commons）按关键词搜图片，专门补「接地气」生活类场景（食堂/宿舍/小吃）。
// 维基条目主页 generator=images 多挂校园/图书馆图，食堂/宿舍图常散落在 commons 分类里，故单独搜。
// 失败不影响主流程（catch 返回空）。
async function fetchCommonsImages(query: string, max = 3): Promise<{ url: string; title: string }[]> {
  try {
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json` +
      `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=${max}` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=640&redirects=1`
    const j = await wikiGetJSON(url)
    if (!j) return []
    const pages = j?.query?.pages || {}
    // 共享资源鱼龙混杂：既要「强拒噪声」（扫描书封/djvu/档案/印章等），也要「必须命中生活/校园关键词」，
    // 否则 "Sichuan University canteen" 会搜到无关的旧书籍扫描件（实测出现过工程学会通信录 djvu）。
    const SKIP = /(logo|icon|svg|map|flag|seal|stamp|章|question|commons|pdf|audio|video|star|symbol|stub|disambig|redirect|template|200px|diagram|graph|chart|emblem|coat|arms|djvu|tif|tiff|scan|book|cover|通信|档案|卷|册|page1|page2|封|影印|索引)/i
    const REQUIRE = /(canteen|dormitory|食堂|宿舍|小吃|campus|library|student|food|dining|university|college|school|building|hall|gate|yard|apartment|restaurant|meal|kitchen|snack|coffee|咖啡|楼|馆|校|院|园|场)/i
    const out: { url: string; title: string }[] = []
    for (const k of Object.keys(pages)) {
      const p = pages[k]
      const t = (p?.title || '')
        .replace(/^File:/, '')
        .replace(/_/g, ' ')
        .replace(/\.(jpg|jpeg|png|gif|svg|webp|JPG)$/i, '')
      const ii = p?.imageinfo?.[0]
      const thumb = ii?.thumburl || ii?.url
      if (!thumb || SKIP.test(t) || !REQUIRE.test(t)) continue
      out.push({ url: thumb, title: t })
      if (out.length >= max) break
    }
    return out
  } catch {
    return []
  }
}

// 取某实体的「题图 + 场景图」：
//  - lead：条目主图（中文维基 pageimages，失败回退英文维基 langlinks）
//  - scenes：条目相关校园/场景图（最多 4 张，过滤掉 logo/地图/图标等）
async function fetchSchoolImages(entity: string): Promise<ImgSet> {
  const zh = await fetchLeadAndEn(entity, 'zh')
  let lead = zh.lead
  let enEntity = zh.otherTitle || entity
  if (!lead && enEntity !== entity) {
    const en = await fetchLeadAndEn(enEntity, 'en')
    if (en.lead) lead = en.lead
  }

  const scenes: { url: string; title: string }[] = []
  // 校园/图书馆等场景图：维基条目主页图（中→英兜底）。
  // 注：commons 搜「食堂/宿舍」对中文院校命中极低且每个 entity 白吃 2 次请求，极易触发维基 429 导致整组图丢失，
  // 故不再调用 commons，聚焦维基主图更稳（用户诉求「只要是学校的都发出来 + 门面为主」已能满足）。
  const wikiScenes = await fetchWikiImages('zh', entity)
  if (wikiScenes.length < 3) {
    const enScenes = await fetchWikiImages('en', enEntity)
    const seen = new Set(scenes.map((s) => s.url))
    for (const s of enScenes) if (!seen.has(s.url)) wikiScenes.push(s)
  }
  for (const s of wikiScenes) if (!scenes.some((x) => x.url === s.url)) scenes.push(s)

  // 用户诉求：只要有「学校门面 / 校门 / 牌坊 / 正门」图，就把它作为主图（lead）最显眼地展示。
  const gateRe = /(gate|校门|大门|正门|牌坊|entrance|facade|[东南西北]门|main building|front view|正门)/i
  const gate = scenes.find((s) => gateRe.test(s.title))
  if (gate) {
    lead = gate
    scenes = scenes.filter((s) => s.url !== gate!.url)
  }
  // 主图没拿到（如限流瞬间未命中）但有场景图时，取首图兜底，避免 lead 长期为空
  if (!lead && scenes.length) lead = scenes[0]
  else if (lead) scenes = scenes.filter((s) => s.url !== lead!.url)
  // 生活类（食堂/宿舍/小吃）排前面，更贴合「接地气内部情报」诉求；门面图已作 lead 单独展示
  const lifeRe = /(canteen|dining|dormitory|宿舍|食堂|小吃|restaurant|food|cafe|student|餐|kitchen|snack|coffee)/i
  scenes.sort((a, b) => (lifeRe.test(b.title) ? 1 : 0) - (lifeRe.test(a.title) ? 1 : 0))
  return { lead, scenes: scenes.slice(0, 4) }
}

// 剥离模型思考过程中可能泄露底层模型/供应商身份的词（保持平台「择校通助手」身份纯净）。
function stripIdentity(s: string): string {
  return s
    .replace(/agnes[-_]?2\.0[-_]?flash/gi, '')
    .replace(/\b(agnes|sapiens|deepseek|openai|chatgpt|gpt[- ]?\d|claude|gemini|qwen|ernie|kimi)\b/gi, '')
    .replace(/我是[^。\n]{0,40}?(模型|大模型|AI 助手|人工智能)/g, '')
    .slice(0, 8000)
}

// 检索返回的可点击参考链接（标题 + 真实 URL + 来源标记），供前端渲染「相关链接」卡片。
interface LinkInfo {
  title: string
  url: string
  source: string
}

interface SearchResult {
  results: string[]
  sources: string[]
  links: LinkInfo[]
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
    const links: LinkInfo[] = []
    const re = /<item>([\s\S]*?)<\/item>/g
    let m: RegExpExecArray | null
    let i = 0
    while ((m = re.exec(xml)) !== null && i < 6) {
      const block = m[1]
      const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
      const src = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || ''
      const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || ''
      const t = stripHtml(title).replace(/\s+-\s+[^-]+$/, '') // 去掉末尾 " - 来源"
      if (t) items.push('- 【新闻】' + t + (src ? `（${stripHtml(src)}）` : ''))
      if (link) links.push({ title: t || '新闻', url: stripHtml(link), source: 'gnews' })
      i++
    }
    return { items, ok: items.length > 0, links }
  } catch {
    return { items: [], ok: false, links: [] }
  }
}

// Hacker News（Algolia API）：科技 / 创业 / 产品类讨论，JSON 免 key，稳定。
async function searchHackerNews(q: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const url = 'https://hn.algolia.com/api/v1/search?query=' + encodeURIComponent(q) + '&hitsPerPage=5'
    const r = await fetchWithTimeout(url, { headers: { 'User-Agent': 'zexiaotong/1.0' } })
    const j = await r.json()
    const hits = (j.hits || []).slice(0, 5)
    const items = hits.map((h: any) => {
      const pts = h.points != null ? `（👍${h.points}）` : ''
      const d = h.created_at ? ` ${String(h.created_at).slice(0, 10)}` : ''
      return `- 【讨论】${stripHtml(h.title || '')}${pts}${d}`
    })
    const links: LinkInfo[] = hits
      .filter((h: any) => h.objectID)
      .map((h: any) => ({ title: stripHtml(h.title || ''), url: `https://news.ycombinator.com/item?id=${h.objectID}`, source: 'hn' }))
    return { items, ok: items.length > 0, links }
  } catch {
    return { items: [], ok: false, links: [] }
  }
}

// Bing 网页搜索：通用网页摘要，覆盖面广，但偶有反爬挑战页（检测到就跳过）。
// 注意：Bing 中文结果可能以 GBK 返回，Deno 默认按 UTF-8 解出乱码，故用 arrayBuffer 双解码兜底。
async function searchBing(q: string, siteScope?: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const qFull = siteScope ? `${q} ${siteScope}` : q
    const url = 'https://www.bing.com/search?q=' + encodeURIComponent(qFull) + '&setlang=zh-CN&cc=CN'
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
    const links: LinkInfo[] = []
    const re = /<li class="b_algo"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g
    let m: RegExpExecArray | null
    let i = 0
    while ((m = re.exec(html)) !== null && i < 6) {
      const txt = stripHtml(m[1])
      if (txt && txt.length > 15) snippets.push('- ' + txt.slice(0, 200))
      i++
    }
    // 结果链接：b_algo 块内第一个 h2>a 的 href 即真实地址
    const reA = /<li class="b_algo"[\s\S]*?<h2><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    let ma: RegExpExecArray | null
    while ((ma = reA.exec(html)) !== null && links.length < 6) {
      const href = ma[1]
      if (/^https?:\/\//.test(href)) links.push({ title: stripHtml(ma[2]) || href, url: href, source: 'bing' })
    }
    return { items: snippets, ok: snippets.length > 0, links }
  } catch {
    return { items: [], ok: false, links: [] }
  }
}

// 百度网页搜索：中文覆盖面最广的通用源。数据中心 IP 偶发安全验证页（检测到就跳过），
// 同样存在 GBK 返回问题，用 arrayBuffer 双解码兜底；解析失败时优雅返回空。
async function searchBaidu(q: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const url = 'https://www.baidu.com/s?wd=' + encodeURIComponent(q) + '&rn=10'
    const r = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    const buf = await r.arrayBuffer()
    let html = new TextDecoder('utf-8').decode(buf)
    if (html.includes('�')) { try { html = new TextDecoder('gbk').decode(buf) } catch {} }
    if (/安全验证|百度安全验证|wappass|请输入验证码|网络不给力/i.test(html)) {
      return { items: [], ok: false }
    }
    const snippets: string[] = []
    const re = /<div class="c-abstract[^"]*"[^>]*>([\s\S]*?)<\/div>|<span class="content-right[^"]*"[^>]*>([\s\S]*?)<\/span>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null && snippets.length < 6) {
      const txt = stripHtml(m[1] || m[2] || '')
      if (txt && txt.length > 15) snippets.push('- ' + txt.slice(0, 200))
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
    const children = (j.data?.children || []).slice(0, 5)
    const items = children.map((c: any) => {
      const d = c.data || {}
      const txt = String(d.selftext || d.title || '').slice(0, 180)
      return `- 【社区】r/${d.subreddit || '?'}：${stripHtml(txt)}`
    })
    const links: LinkInfo[] = children
      .filter((c: any) => c.data?.permalink)
      .map((c: any) => ({ title: stripHtml(String(c.data.title || '').slice(0, 80)), url: `https://www.reddit.com${c.data.permalink}`, source: 'reddit' }))
    return { items, ok: items.length > 0, links }
  } catch {
    return { items: [], ok: false, links: [] }
  }
}

// 社媒/UGC 作用域：搜索引擎已收录抖音/小红书/B站/知乎/微博的公开页，用域作用域拉真实 UGC
// （合规、免签名；直爬这些平台需登录态+请求签名，serverless 架构做不到，且违背 ToS）
const SOCIAL_DOMAINS = ['xiaohongshu.com', 'douyin.com', 'bilibili.com', 'zhihu.com', 'weibo.com', 'tieba.baidu.com', 'douban.com']
const SOCIAL_SITE_SCOPE = '(site:xiaohongshu.com OR site:douyin.com OR site:bilibili.com OR site:zhihu.com OR site:weibo.com OR site:tieba.baidu.com)'

// 多源并发检索，收集任意成功源的结果
async function searchMulti(query: string): Promise<SearchResult> {
  const tokens = query.split(' ').filter(Boolean)
  const wikiQueries = Array.from(new Set([query, ...tokens])).slice(0, 3) // 整句 + 分词，多候选回退

  const tasks: Promise<{ items: string[]; ok: boolean; src: string }>[] = []

  // 有密钥则优先用可靠商业源（Tavily 已配置，覆盖实时检索；中文经模型整理输出，规避上游偶发乱码）
  let keySrc = 'tavily'
  if (SEARCH_KEY) {
    keySrc = SEARCH_PROVIDER === 'brave' ? 'brave' : SEARCH_PROVIDER === 'serper' ? 'serper' : 'tavily'
    const p = keySrc === 'brave' ? searchBrave : keySrc === 'serper' ? searchSerper : searchTavily
    tasks.push(s2(p(query), keySrc))
  }
  // 社媒/UGC 专项检索：把抖音/小红书/B站/知乎/微博的公开内容纳入（经搜索引擎收录，合规免签名）。
  // 这些结果已按 query + 域名双重过滤，故标记 relaxed=true 跳过通用相关性门禁（避免「浙大」≠「浙江大学」误杀）。
  tasks.push(s2(searchBing(query, SOCIAL_SITE_SCOPE), 'bing-social', true))
  if (keySrc === 'tavily') {
    tasks.push(s2(searchTavily(query, SOCIAL_DOMAINS), 'tavily-social', true))
  }

  // 动态 / 新闻源（最新信息，优先注入模型上下文）
  tasks.push(s2(searchGoogleNews(query), 'gnews'))
  tasks.push(s2(searchHackerNews(query), 'hn'))
  // 通用网页源（中文覆盖面广）：Bing + 百度。二者对数据中心 IP 偶发验证页/限流，
  // 检测到即跳过，不影响其他源；GBK 返回已用 arrayBuffer 双解码兜底。
  tasks.push(s2(searchBing(query), 'bing'))
  tasks.push(s2(searchBaidu(query), 'baidu'))
  tasks.push(s2(searchReddit(query), 'reddit'))

  // 百科兜底源：维基（中/英，多候选并发）+ DuckDuckGo
  for (const c of wikiQueries) tasks.push(s2(searchWikipedia(c, 'zh'), 'wiki-zh'))
  for (const c of wikiQueries) tasks.push(s2(searchWikipedia(c, 'en'), 'wiki-en'))
  tasks.push(s2(searchDuckDuckGo(query), 'ddg'))

  const settled = await Promise.all(tasks)
  const sources: string[] = []
  const dyn: string[] = []
  const wiki: string[] = []
  const social: string[] = [] // 社媒/UGC 专项池：保证抖音/小红书等内容有独立配额，不被通用结果淹没
  const seen = new Set<string>()
  const rt = relevanceInfo(query)
  // 收集可点击参考链接（去重 + 过滤搜索引擎自身包装/跳转噪音），供前端「相关链接」卡片使用
  const links: LinkInfo[] = []
  const seenLinks = new Set<string>()
  const isNoiseLink = (u: string) => /(duckduckgo\.com\/l\/|bing\.com\/ck\/|google\.com\/url|news\.google\.com\/rss|bing\.com\/search|baidu\.com)/.test(u)
  for (const s of settled) {
    if (s.ok && s.items.length) {
      const base = s.src.split(':')[0] // gnews / hn / bing / reddit / wiki-zh / wiki-en / ddg / tavily / brave / serper / tavily-social / bing-social
      if (!sources.includes(base)) sources.push(base)
      const bucket = base === 'wiki-zh' || base === 'wiki-en' || base === 'ddg'
        ? wiki
        : base === 'tavily-social' || base === 'bing-social'
        ? social
        : dyn
      for (const raw of s.items) {
        if (raw.includes('�')) continue // 丢弃乱码片段，避免污染生成模型
        const it = raw.length > 320 ? raw.slice(0, 320) + '…' : raw
        if (!s.relaxed && !isRelevant(it, rt)) continue // 社媒域作用域结果已按 query 过滤，跳过通用相关性门禁
        if (!seen.has(it)) { seen.add(it); bucket.push(it) }
      }
    }
    // 链接独立收集：即便片段被相关性门禁过滤，真实来源链接仍对用户有用
    for (const lk of s.links || []) {
      if (!lk?.url || seenLinks.has(lk.url) || isNoiseLink(lk.url)) continue
      try { new URL(lk.url) } catch { continue }
      seenLinks.add(lk.url)
      links.push(lk)
    }
  }
  // 通用动态源（最多 14）+ 社媒/UGC 专项（固定 6 条配额）+ 维基兜底（最多 8），合计 28 条上限
  let merged: string[] = [...dyn.slice(0, 14), ...social.slice(0, 6), ...wiki.slice(0, 8)]
  // 安全网：若相关性过滤后结果过少（易致「查不到」），放宽门禁，避免空答
  if (merged.length < 5) {
    const seenR = new Set(merged)
    const relaxed: string[] = []
    for (const s of settled) {
      if (!s.ok) continue
      for (const raw of s.items) {
        if (raw.includes('�')) continue
        const it = raw.length > 320 ? raw.slice(0, 320) + '…' : raw
        if (!seenR.has(it)) { seenR.add(it); relaxed.push(it) }
      }
    }
    if (relaxed.length) merged = [...merged, ...relaxed].slice(0, 32)
  }
  // 参考链接上限：优先保留社媒/UGC（用户明确要的抖音/小红书等）与新闻，整体最多 16 条
  if (links.length > 16) links.length = 16
  return { results: merged, sources, links, ok: merged.length > 0 }
}

function s2(p: Promise<{ items: string[]; ok: boolean; links?: LinkInfo[] }>, src: string, relaxed = false) {
  return p.then((r) => ({ ...r, src, relaxed, links: r.links || [] }))
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

// 注：原 decideSearch（模型判断「是否检索」）已废弃——用户要求「100% 联网检索」，
// 凡有实质查询（非纯问候/算术/创作）一律检索，不再用模型二次判定（既慢又曾误判漏检）。
// 见下方请求入口的 autoSearch 分支。

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
  // 图片代理：服务端拉取维基图片再回传，绕开维基图床在部分网络下加载失败 / 被墙的问题。
  // 函数域名（Supabase）国内可访问，比浏览器直连 upload.wikimedia.org 更稳。
  // 仅放行维基系主机（*.wikipedia.org / *.wikimedia.org），避免被当成公开代理滥用。
  if (req.method === 'GET') {
    const reqUrl = new URL(req.url)
    if (reqUrl.pathname.endsWith('/img')) {
      const target = reqUrl.searchParams.get('u') || ''
      let parsed: URL
      try {
        parsed = new URL(target)
      } catch {
        return new Response('bad url', { status: 400 })
      }
      if (!/(wikipedia|wikimedia)\.org$/.test(parsed.hostname)) {
        return new Response('host not allowed', { status: 403 })
      }
      try {
        // 去掉维基自动追加的 utm 跟踪参数，并用浏览器 UA（维基对数据中心/自定义 UA 的图床常返回 403）
        const cleanTarget = parsed.toString().replace(/[?&]utm_[^&]+/g, '').replace(/\?$/, '')
        const r = await fetch(cleanTarget, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'image/avif,image/webp,image/png,image/*,*/*;q=0.8'
          }
        })
        if (!r.ok) return new Response('upstream ' + r.status, { status: 502 })
        return new Response(r.body, {
          status: 200,
          headers: {
            'Content-Type': r.headers.get('content-type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
            ...CORS
          }
        })
      } catch {
        return new Response('fetch failed', { status: 502 })
      }
    }
  }

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
  // 推理模型需要足够预算：max_tokens=2000 时 reasoning_content 经常把预算吃光，content 变空。
  // 默认抬到 6000（上限 8192），让 reasoning 和 content 都有空间。
  const maxTokens = Math.min(Math.max(body.max_tokens ?? 6000, 6000), 8192)
  const webSearch = !!body.web_search
  const autoSearch = !!body.auto_search
  const searchOnly = !!body.search_only

  // 把 system / 非 system 分开，避免污染
  const sysMessages = messages.filter((m) => m.role === 'system')
  const otherMessages = messages.filter((m) => m.role !== 'system')

  const rawUser = lastUserText(otherMessages)
  const query = extractQuery(rawUser)

  // 是否需要检索：search_only 强制检索；auto_search 改为「100% 联网检索」（仅纯问候/算术/创作这类
  // 无意义查询跳过，避免浪费外部检索额度与无谓延迟；凡涉及具体学校/公司/城市/政策/数据的实质问题一律检索）；
  // web_search 强制；否则不检索。
  let needSearch = false
  if (searchOnly) {
    needSearch = !!query
  } else if (autoSearch) {
    needSearch = query ? !looksTrivial(query) : false
  } else if (webSearch) {
    needSearch = !!query
  }

  type ImgSet = { lead: { url: string; title: string } | null; scenes: { url: string; title: string }[] }
  const EMPTY_IMG: ImgSet = { lead: null, scenes: [] }

  let searchMeta: {
    ok: boolean
    count: number
    sources: string[]
    links: LinkInfo[]
    image: { url: string; title: string } | null
    images: { url: string; title: string }[]
  } = { ok: false, count: 0, sources: [], links: [], image: null, images: [] }
  let rawResults: string[] = []

  if (needSearch && query) {
    const ctx = await searchMulti(query)
    searchMeta = { ok: ctx.ok, count: ctx.results.length, sources: ctx.sources, links: ctx.links, image: null, images: [] }
    rawResults = ctx.results
    if (ctx.ok && !searchOnly) {
      const linkBlock = ctx.links.length
        ? '\n【检索到的参考链接（请在回答末尾「相关链接与地点」板块中如实引用，标注来源；不要编造未列出的链接）：】\n' +
          ctx.links.slice(0, 10).map((l, i) => `${i + 1}. （${l.source}）${l.title} ${l.url}`).join('\n') + '\n'
        : ''
      sysMessages.push({
        role: 'system',
        content:
          '你具备查阅最新公开资料的能力。\n' +
          `【用户原话】${rawUser}\n` +
          '以下是针对用户原话检索到的资料（来自网络，可能不保证 100% 最新，请批判性采用，优先采信可交叉验证的事实）：\n' +
          '<search>\n' +
          ctx.results.join('\n') +
          '\n</search>\n' +
          linkBlock +
          '要求：① 优先依据上述资料作答，并在关键事实后用「（来源：xxx）」标注；' +
          '② 若资料不足以回答，明确说明「未检索到确切信息」，不要编造；' +
          '③ 涉及排名/分数/政策等易变数据，提醒用户以官方最新公布为准；' +
          '④ 引用用户原话时务必使用上面【用户原话】字段里的完整字句，不要把检索片段里的 query 拼接词当成用户原话；' +
          '⑤ 回答末尾必须包含「相关链接与地点」板块，列出上述参考链接中的官网/百科/新闻/社媒主页，并补充该实体的具体地址、交通、地图可定位信息（查不到写「暂无法确认具体地址」）。'
      })
    }
  }

  // 真实学校/实体图（题图 + 场景图）。与检索、生成并行获取，失败不影响主回答。
  const imagePromise: Promise<ImgSet> =
    needSearch && rawUser ? fetchSchoolImages(extractEntity(rawUser)) : Promise.resolve(EMPTY_IMG)

  // —— 实时资讯模式：只返回检索结果，不调用生成模型（低延迟、直接展示来源）——
  if (searchOnly) {
    const imgs = await imagePromise.catch(() => EMPTY_IMG)
    return json(
      {
        results: rawResults,
        search: { ...searchMeta, image: imgs.lead, images: imgs.scenes },
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
  const imgs = await imagePromise.catch(() => EMPTY_IMG)

  // —— 防御：推理模型偶发"reasoning 把 token 吃光 / 输出截断"，导致 content 为空但 reasoning 还在 ——
  // 现象：用户看到的"AI 思考过程"有内容，正文却空白。
  // 修复：检测到 content 为空且 reasoning 非空时，自动用更小预算、强制简短指令重试一次，
  //       同时把模型在 reasoning 里"自导自演"的伪 <search> 标签过滤掉，避免暴露内部检索机制。
  let content = (data as any)?.choices?.[0]?.message?.content ?? ''
  if (!content?.trim()) {
    try {
      const retryMsgs = [
        ...sysMessages,
        { role: 'user' as const, content: rawUser + '\n\n【系统提示】上一轮回复因输出截断为空，请直接给出完整答案，不要再做内部检索模拟。' }
      ]
      const retry = await fetch(`${V9_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${V9_ANON}` },
        body: JSON.stringify({ model: V9_MODEL, messages: retryMsgs, max_tokens: 4000, stream: false, temperature: 0.7 })
      })
      const rd = await retry.json().catch(() => ({}))
      const rcontent = rd?.choices?.[0]?.message?.content ?? ''
      if (rcontent?.trim()) {
        content = rcontent
        // 把重试拿到的 content 合并回 data，让前端走正常渲染路径
        ;(data as any).choices = (data as any).choices || [{}]
        ;(data as any).choices[0].message = { ...((data as any).choices[0].message || {}), content: rcontent }
      }
    } catch {
      // 重试失败也无所谓，至少不返空白
    }
  }

  // 抽取模型内部思考（reasoning_content），剥离可能泄露底层模型身份的词，附到返回体供前端展示「AI 思考过程」
  const rawReasoning = (data as any)?.choices?.[0]?.message?.reasoning_content || ''
  // 过滤掉模型在 reasoning 里"自导自演"的伪 <search> 标签——它不是真检索结果，是模型模拟的动作，会误导用户
  const cleanedReasoning = rawReasoning.replace(/<search>[\s\S]*?<\/search>/g, '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const reasoning = cleanedReasoning ? stripIdentity(cleanedReasoning) : ''
  // 把搜索元数据（含真实题图 + 场景图）与思考过程附到返回体，供前端诚实标注与配图
  const enriched = {
    ...data,
    search: { ...searchMeta, image: imgs.lead, images: imgs.scenes },
    reasoning
  }
  return json(enriched, upstream.status)
})
