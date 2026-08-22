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

// 「深度思考」结构化指令：当前上游 agnes-2.0-flash 不暴露独立 reasoning_content 通道
// （已用 curl 实测：流式 / 非流式均只返回 content，无 reasoning_content / thinking 字段），
// 因此无法像 DeepSeek-R1 那样「边生成边推 reasoning」。退而求其次：要求模型把思考过程
// 作为正文的第一段显式写出来，再以原样标记【回答】分隔正式回答；前端即可在「深度思考中」
// 阶段就把这段思考正文实时流出，结束后切到正式回答。structured_reasoning 标志开启时注入。
const STRUCTURED_REASONING_DIRECTIVE = `你正处于「深度思考」模式。请直接输出内容，不要复述、解释或引用本指令：
1. 先写你的思考 / 分析过程（可分步、口语化，写出推理链条与权衡）。
2. 换行，单独一行只写【回答】这四个字作为分隔。
3. 在【回答】之后写正式回答。
注意：绝不要把上面的格式说明写进你的回复里；【回答】之前是思考、之后是正式回答。`

const SEARCH_KEY = Deno.env.get('SEARCH_API_KEY') || ''
const SEARCH_PROVIDER = (Deno.env.get('SEARCH_PROVIDER') || '').toLowerCase()

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// 完整浏览器请求头：模拟真实浏览器访问，降低被反爬拦截概率
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
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

function decodeEntities(s: string): string {
  return s
    .replace(/&ensp;|&emsp;|&thinsp;|&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => { try { return String.fromCodePoint(parseInt(h, 16)) } catch { return '' } })
    .replace(/&#(\d+);/g, (_, d: string) => { try { return String.fromCodePoint(parseInt(d, 10)) } catch { return '' } })
    .replace(/&hellip;|&#8230;/g, '…')
}
function stripHtml(s: string): string {
  return decodeEntities(
    s
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

// 从用户长提示词里抠出「核心检索实体」：去掉指令词/修饰词/标点/引号，保留主体。
// 例：「用三句话介绍浙江大学，并说明它的一个明显优点和一个明显缺点」→「浙江大学」
// 关键：「学校/学院/公司/企业/集团」等后缀是实体名的一部分，不能单独剥离——
// 否则「内江医科学校」→「内江医科」，检索跑偏到其他医科大学。
const QUERY_STOP = [
  '请用', '请', '帮我', '分析一下', '分析', '评估', '推荐', '查一下', '查询', '查', '看一下', '看看',
  '介绍',   '说明', '对比', '比较', '总结', '生成', '写', '用三句话', '用一句话', '简述', '概述',
  '说一下', '讲讲', '谈谈', '说大实话', '直说', '拆解', '深度', '维度', '多维度', '核心', '主要',
  '包括', '包含', '关于', '针对', '对于', '明显', '真实信息', '情况', '怎么样', '如何',
  '是否', '吗', '呢', '的', '了', '我', '我们', '想', '要', '需要', '一份', '报告', '简历',
  '该', '找工作', '就业', '优缺点', '优点', '缺点', '亮点', '重点', '避雷', '坑'
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
// 抽取含后缀的完整实体名（用于多 query 变体），「内江医科学校」→「内江医科学校」而非「内江医科」
function extractEntityQuery(text: string): string {
  const m = (text || '').match(/[一-龥A-Za-z0-9]{2,}(大学|学院|学校|公司|企业|集团|医院|银行|市|省|县|新区)/)
  return m ? m[0] : text.trim()
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
function isRelevant(snippet: string, info: ReturnType<typeof relevanceInfo>, relaxed = false): boolean {
  // query 没提取出任何有意义 token（纯数字/英文/太碎）：不过滤，避免误杀
  if (info.tokens.length === 0 && info.years.length === 0 && info.kw.length === 0) return true
  // 0) 强相关：snippet 直接包含 query 完整主体（去空格拼接），直接过
  const flat = info.tokens.join('')
  if (flat && flat.length >= 2 && snippet.includes(flat)) return true
  // 1) 短语匹配：snippet 必须包含 query 中某个 token 的**完整连续子串**（非单字命中），
  //    且该 token 至少 2 汉字（避免「美/大/学」这种单字高频字混入误判）
  //    多实体查询（≥3 个不同实体 token）要求命中 ≥2 个不同 token，避免「杭州方言」因含「杭州」就过审
  const hitTokens = info.tokens.filter((tok) => tok.length >= 2 && snippet.includes(tok))
  const minHit = relaxed ? 1 : (info.tokens.length >= 3 ? 2 : 1)
  if (hitTokens.length >= minHit) return true
  // 2) 弱相关兜底：query 含明确年份，snippet 也含该年份
  if (info.years.some((y) => snippet.includes(y))) return true
  // 3) 弱相关兜底：query 含具体数据线索词，snippet 也含该词
  if (info.kw.some((k) => snippet.includes(k))) return true
  return false
}

// 链接相关性：title+url 必须命中至少 1 个 query 主体 token（剔除「肺癌论文 / Unicode 字符表」这种跟学校/公司完全不沾边的噪声）；
// 仅「机构/权威源」域名天然保留（政府/教育/职业主页通常就是用户要查的实体本身）；
// 维基百科**不**无条件保留——任何 wiki 条目都匹配 wikipedia.org，所以必须额外校验 title 命中 query token。
const TRUST_HOST = /(\.gov(\.cn)?|\.edu(\.cn)?$|\.edu\.cn|linkedin\.com|github\.com)/i
function isLinkRelevant(lk: LinkInfo, info: ReturnType<typeof relevanceInfo>): boolean {
  if (info.tokens.length === 0 && info.years.length === 0 && info.kw.length === 0) return true
  if (TRUST_HOST.test(lk.url)) return true
  // 维基百科：title 必须命中 token 才留（避免「List of Unicode characters」这种无关条目混进卡片）
  if (lk.source === 'wiki-zh' || lk.source === 'wiki-en') return isRelevant(lk.title || '', info)
  // 其他通用源：title+url 命中 token / 年份 / 领域词
  const text = ((lk.title || '') + ' ' + lk.url).toLowerCase()
  for (const tok of info.tokens) if (tok.length >= 2 && text.includes(tok.toLowerCase())) return true
  for (const y of info.years) if (text.includes(y)) return true
  for (const k of info.kw) if (text.includes(k)) return true
  return false
}

// 链接展示优先级：机构权威源（.gov/.edu 等就是实体本身）> 维基百科（实体百科词条）> 社媒（用户明确要的抖音/小红书等）> 新闻 / 社区 > 通用搜索
function linkPriority(lk: LinkInfo): number {
  const s = lk.source
  if (TRUST_HOST.test(lk.url)) return 0
  if (s === 'wiki-zh' || s === 'wiki-en') return 1
  if (s === 'tavily-social' || s === 'bing-social') return 2
  if (s === 'gnews' || s === 'reddit' || s === 'hn') return 3
  return 4
}
function sortLinks(arr: LinkInfo[]): LinkInfo[] {
  return [...arr].sort((a, b) => linkPriority(a) - linkPriority(b))
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
      max_results: 12,
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
    if (!r.ok) {
      // 让失效/过期 key 在日志里可见（实测曾返回 401 Unauthorized），而非静默空结果。
      const errTxt = await r.text().catch(() => '')
      console.error(`[tavily] HTTP ${r.status} for "${q}": ${errTxt.slice(0, 200)}`)
      return { items: [], ok: false, links: [] }
    }
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
    const results = (j.web?.results || []).slice(0, 8)
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
    const results = (j.organic || []).slice(0, 8)
    const items = results.map((x: any) => `- ${x.title}：${stripHtml(x.snippet || '')}`)
    const links: LinkInfo[] = results.filter((x: any) => x.link).map((x: any) => ({ title: stripHtml(x.title || ''), url: String(x.link), source: 'serper' }))
    return { items, ok: items.length > 0, links }
  } catch {
    return { items: [], ok: false, links: [] }
  }
}

// 从原始 query 提取"实体词"用于百科检索：去掉尾部提问意图词（怎么样/避坑/就业…），再取首词块。
// 整句直搜（如"攀枝花学院 宿舍 食堂 避坑"）常因多词 AND 而 0 结果 → 用实体词回退命中词条，
// 避免"其实查得到却搜不到"的伪缺失（实测 攀枝花学院 全句 0 结果、实体词 5 条）。
function wikiEntityVariants(q: string): string[] {
  const INTENT = /(怎么样|怎样|如何|咋样|好吗|好不好|行不行|值得去吗|值得吗|靠谱吗|避坑|避雷|宿舍|食堂|待遇|加班|就业|前景|分数线|录取|最近|新闻|发布|加盟|房价|工作|平均|一分一段表|这家公司|这家|计算机|专业|公办|民办|2025|2024|2023|2022)\s*/g
  const cleaned = q.replace(INTENT, ' ').trim()
  const toks = cleaned.split(/\s+/).filter(Boolean)
  const variants = new Set<string>([q])
  if (cleaned && cleaned !== q) variants.add(cleaned)
  if (toks[0]) variants.add(toks[0])
  if (toks[0] && toks[1]) variants.add(toks[0] + ' ' + toks[1])
  return [...variants]
}

async function searchWikipedia(q: string, lang: 'zh' | 'en'): Promise<{ items: string[]; ok: boolean }> {
  try {
    // 先整句，0 结果再回退到实体词（首词块 / 首两词块），避免长尾实体被多词 AND 误杀。
    const variants = wikiEntityVariants(q)
    let items: string[] = []
    let links: LinkInfo[] = []
    for (const v of variants) {
      const url =
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search` +
        `&srsearch=${encodeURIComponent(v)}&srlimit=8&srprop=snippet&format=json`
      const r = await fetchWithTimeout(url, { headers: { 'User-Agent': 'zexiaotong/1.0 (search)' } })
      const j = await r.json()
      const results = (j.query?.search || []).slice(0, 5)
      if (results.length) {
        items = results.map((x: any) => `- ${x.title}：${stripHtml(x.snippet || '')}`)
        links = results
          .filter((x: any) => x.title)
          .map((x: any) => ({ title: x.title, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(x.title)}`, source: `wiki-${lang}` }))
        break
      }
    }
    return { items, ok: items.length > 0, links }
  } catch {
    return { items: [], ok: false, links: [] }
  }
}

async function searchDuckDuckGo(q: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const r = await fetchWithTimeout(
      'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q),
      { headers: { ...BROWSER_HEADERS } }
    )
    const buf = await r.arrayBuffer()
    let html = new TextDecoder('utf-8').decode(buf)
    if (html.includes('�')) { try { html = new TextDecoder('gbk').decode(buf) } catch {} }
    const snippets: string[] = []
    const links: LinkInfo[] = []
    const re = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
    let m: RegExpExecArray | null
    let i = 0
    while ((m = re.exec(html)) !== null && i < 10) {
      const txt = stripHtml(m[1])
      if (txt) snippets.push('- ' + txt)
      i++
    }
    // 结果链接：DDG 用 /l/?uddg=<encoded> 包装，需解出真实 URL
    const reA = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    let ma: RegExpExecArray | null
    let li = 0
    while ((ma = reA.exec(html)) !== null && li < 8) {
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
  let cleaned = extractQuery(text || '')
  // 剥掉尾部问句 / filler，避免「字节跳动有什么坑」「腾讯公司值得去吗」被截成
  // 「字节跳动有什么」「腾讯公司值得去」导致维基 / Wikidata 查不到图（公司品牌名常无后缀）。
  const TAIL = /(有什么|有啥|怎么样|如何|怎么选|值得去|值得|好吗|好不好|行不行|可以吗|吗|呢|是什么|是啥|评价|口碑|推荐|对比|分析|介绍|查询|了解|呀|啊|哦|哈|呗|嘛|的坑|的雷|的利弊|优缺点|优劣势)$/g
  cleaned = cleaned.replace(TAIL, '').replace(/\s+/g, ' ').trim()
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  for (const tok of tokens) {
    if (/(大学|学院|学校|公司|企业|集团|医院|银行|电视台|日报|市|省|县|新区)$/.test(tok) && tok.length <= 8) {
      return tok
    }
  }
  // 退路：直接从清洗文本抓「≤6 汉字 + 后缀」
  const m = cleaned.match(/[一-龥]{1,6}(大学|学院|学校|公司|企业|集团|医院|银行|电视台|日报|市|省|县|新区)/)
  if (m) return m[0]
  // 兜底：取最长纯汉字 token（公司 / 品牌名常无后缀，如「字节跳动」「腾讯」「华为」）
  const han = tokens.filter((x) => /^[一-龥]+$/.test(x) && x.length >= 2).sort((a, b) => b.length - a.length)
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
// 维基数据（Wikidata）兜底：取实体的官方 logo(P154) 与主图(P18)。
// 学校/城市主要靠维基百科场景图；企业/机构类在维基百科常只有 logo（且被 SCENE 的 SKIP 过滤掉）、场景图也极少，
// 故新增 Wikidata logo 兜底，保证公司类也能带真实图（官网 logo + 办公楼），不再整组为空。
async function fetchWikidataImages(entity: string): Promise<{ logo: { url: string; title: string } | null; main: { url: string; title: string } | null }> {
  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(entity)}&language=zh&format=json&limit=1`
    const sj = await wikiGetJSON(searchUrl, 6000, 1)
    const qid = sj?.search?.[0]?.id
    if (!qid) return { logo: null, main: null }
    const entUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`
    const ej = await wikiGetJSON(entUrl, 6000, 1)
    const claims = ej?.entities?.[qid]?.claims || {}
    const getImg = (pid: string): { url: string; title: string } | null => {
      const arr = claims[pid]
      if (!arr || !arr.length) return null
      const raw = arr[0]?.mainsnak?.datavalue?.value
      const file = String(raw || '').replace(/^File:/, '').replace(/^Special:FilePath\//, '')
      if (!file) return null
      const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=640`
      return { url, title: file }
    }
    return { logo: getImg('P154'), main: getImg('P18') }
  } catch {
    return { logo: null, main: null }
  }
}

// 取某实体的「题图 + 场景图」（学校 / 公司 / 城市 / 机构通用）。
//  - lead：维基百科条目主图（中→英兜底）；公司类优先用 Wikidata 官方 logo 作门面。
//  - scenes：维基百科场景图 + Wikidata 主图 / logo 兜底（公司类补 logo）。
async function fetchEntityImages(entity: string): Promise<ImgSet> {
  // 维基百科主图与场景图并行拉取，节省耗时（图片整体受 1.8s 响应态截止约束）
  const [zh, wikiScenesZh] = await Promise.all([fetchLeadAndEn(entity, 'zh'), fetchWikiImages('zh', entity)])
  let lead = zh.lead
  let enEntity = zh.otherTitle || entity
  if (!lead && enEntity !== entity) {
    const en = await fetchLeadAndEn(enEntity, 'en')
    if (en.lead) lead = en.lead
  }

  let scenes: { url: string; title: string }[] = []
  const wikiScenes = wikiScenesZh
  if (wikiScenes.length < 3) {
    const enScenes = await fetchWikiImages('en', enEntity)
    const seen = new Set(scenes.map((s) => s.url))
    for (const s of enScenes) if (!seen.has(s.url)) wikiScenes.push(s)
  }
  for (const s of wikiScenes) if (!scenes.some((x) => x.url === s.url)) scenes.push(s)

  // 公司/机构类判定：命中企业类后缀即视为公司，优先用 logo 作门面、并补 Wikidata 图
  const isCompany = /(公司|企业|集团|科技|银行|传媒|控股|实业|股份|有限公司|网络|半导体|制药|能源|汽车|地产|保险|证券|通信|电子|金融|互联网|投资)/.test(entity)

  // 仅在「维基场景图偏少」或「公司类」时补 Wikidata（省时，常见学校/城市路径不变快）
  let wdLogoUrl: string | null = null
  if (scenes.length < 2 || isCompany) {
    const wd = await fetchWikidataImages(entity)
    if (wd.main && !scenes.some((s) => s.url === wd.main!.url)) scenes.push(wd.main)
    if (wd.logo && !scenes.some((s) => s.url === wd.logo!.url)) {
      scenes.push(wd.logo)
      wdLogoUrl = wd.logo.url
    }
    if (!lead && wd.logo && isCompany) lead = wd.logo
    if (!lead && wd.main && isCompany) lead = wd.main
  }

  // 学校场景：只要有「校门/正门/牌坊」图就作 lead 最显眼展示（公司类跳过，改用 logo）
  const gateRe = /(gate|校门|大门|正门|牌坊|entrance|facade|[东南西北]门|main building|front view|正门)/i
  const gate = !isCompany ? scenes.find((s) => gateRe.test(s.title)) : undefined
  if (gate) {
    lead = gate
    scenes = scenes.filter((s) => s.url !== gate!.url)
  }
  // 主图没拿到但有场景图时，取首图兜底，避免 lead 长期为空
  if (!lead && scenes.length) lead = scenes[0]
  else if (lead) scenes = scenes.filter((s) => s.url !== lead!.url)
  // 生活类（食堂/宿舍/小吃）排前面，更贴合「接地气内部情报」诉求；公司类则把 logo 置顶
  const lifeRe = /(canteen|dining|dormitory|宿舍|食堂|小吃|restaurant|food|cafe|student|餐|kitchen|snack|coffee)/i
  scenes.sort((a, b) => {
    if (isCompany && wdLogoUrl) {
      const aLogo = a.url === wdLogoUrl ? 1 : 0
      const bLogo = b.url === wdLogoUrl ? 1 : 0
      if (aLogo !== bLogo) return bLogo - aLogo
    }
    return (lifeRe.test(b.title) ? 1 : 0) - (lifeRe.test(a.title) ? 1 : 0)
  })
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

// 剥离模型偶发吐出的内部工具调用标签（<tool_call>/<tool_calls>/<function=...>/<minimax_agent> 等）。
// 背景：agnes-2.0-flash 推理模型看到「检索」会自作主张调用 web_search 工具，而本 v9 链路未接工具执行回环，
// 于是模型把内部协议标签直接吐进正文、真正的回答缺失（实测该版块提交后正文全是 <tool_call><function=web_search> 碎片）。
// 这些标签不是给用户看的内容，必须清掉。
// eslint-disable-next-line no-control-regex
function cleanToolCalls(s: string): string {
  return s
    // 单标签无差别剥离：覆盖模型实际吐出的 broken / 不配对工具标签（注意不能要求成对闭合，
    // 否则 <tool_call>...</function> 这种不配对碎片会原样残留）。
    .replace(/<\/?tool_calls?[^>]*>/gi, '')        // <tool_call> / <tool_calls> / </tool_call>
    .replace(/<\/?function_call[^>]*>/gi, '')       // <function_call> / </function_call>
    .replace(/<\/?function[^>]*>/gi, '')            // <function=...> / <function> / </function>
    .replace(/<\/?parameter[^>]*>/gi, '')           // <parameter=query> / </parameter>
    .replace(/<\/?minimax_agent[^>]*>/gi, '')       // <minimax_agent> / </minimax_agent>
    .replace(/<\/?invoke[^>]*>/gi, '')              // <invoke> / </invoke>
    .replace(/<\/?think[^>]*>/gi, '')               // <think> / </think>
    .trim()
}
// 判断原始输出是否主要是工具调用泄漏（用于决定是否需要重试）
function looksLikeToolCallLeak(raw: string): boolean {
  return /<tool_calls?|<function|<\/function|<parameter|function_call|<minimax_agent|<invoke/i.test(raw)
}
// 内部指令名泄漏清洗：模型偶发把 system 里的内部常量名（SOURCE_RULE / BLUNT_RULE / DETAIL_RULE 等）
// 回显到正文（如「===数据明细（按 SOURCE_RULE / BLUNT_RULE 执行；…）」），影响观感。这些词只存在于
// prompt 内部，正常用户内容不会用到，可安全剥离。
function cleanInternalLeak(s: string): string {
  return s
    .replace(/（[^）]*\b(?:SOURCE|BLUNT|DETAIL|FRESHNESS|LINKS_LOCATION|PROMPT_EMPHASIS|OPINION|AVOID)_RULE[^）]*）/g, '') // 括号里的规则名说明
    .replace(/【[^】]*\b(?:SOURCE|BLUNT|DETAIL|FRESHNESS|LINKS_LOCATION|PROMPT_EMPHASIS|OPINION|AVOID)_RULE[^】]*】/g, '') // 方括号里的规则名说明
    .replace(/\b(?:SOURCE|BLUNT|DETAIL|FRESHNESS|LINKS_LOCATION|PROMPT_EMPHASIS|OPINION|AVOID)_RULE\b/g, '') // 裸规则名
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// 标签墙清洗：剥离模型正文里过度喷涌的「行内/句末来源标签」。
// 背景：尽管 prompt 已要求"来源标签只在确实引用了具体外部资料时才贴"，
//       但实测模型在"未检索到 / 推测判断"语境下仍会每条都喷【AI 整理·模型知识】、
//       （AI 整理）、（AI 推测·未经验证）—— 用户称这是"标注墙"。
// 修法（硬约束）：剥离以下行内括号/方括号标签，只保留【资料·来源：xxx】等正规引用。
// 「===信息来源备注==="整段保留（用户约定那是来源集中说明位置）。
function cleanLabelWall(s: string): string {
  if (!s) return s
  let out = s
  // 1) 整段去除方括号行内标签（【AI 整理】/【AI 整理·模型知识】/【AI 对比】/【AI 推测】 等）
  out = out.replace(/【\s*AI\s*(整理|对比|推测|推测·未经验证|整理·模型知识|整理对比|判断|参考|推测未经验证)[^】]*】/g, '')
  // 2) 整段去除句末/行内的括号小标签（（AI 整理） / （AI 整理·模型知识） / （AI 推测·未经验证） 等）
  out = out.replace(/[（(]\s*AI\s*(整理|对比|推测|推测·未经验证|整理·模型知识|整理对比|判断|参考)[^）)]*[）)]/g, '')
  // 3) 清理可能被空格/全角空格分隔的两段式拼写
  out = out.replace(/【\s*检索\s*·\s*来源[^】]*】/g, '')
  // 4) 修复"清洗后 broken 尾巴"——只在【】标签紧邻的"标【AI 整理】..."这种结构里连带清掉。
  //    不再无脑匹配"均为..."等无标签句，避免误伤「(检索结果均为...与...无关)」这类正常括号补充说明。
  out = out.replace(/(均(明确|直接|已)?(标(注)?)?|部分(为)?(推测|为推测))(【[^】\n]*】)/g, '$6')
  out = out.replace(/([^【】\n]{0,30})(【[^】\n]*】)/g, (m, pre, tag) => {
    // 当 pre 里只是"标/标注/明确标"这类残留介词时，一并剥掉
    if (/^[\s，,。]*((均(明确|直接|已)?(标(注)?)?)|((为|是)(推测|AI 整理)))$/.test(pre)) return ''
    return m
  })
  // 5) 「AI 整理部分约占一半篇幅（组织 / 对比 / 判断）」 / 「(AI 整理)」 之类被剥成 broken 的残余
  out = out.replace(/，\s*(AI 整理(部分)?[^，。\n]{0,30}(组织|对比|判断)|均(已|明确)?[^，。\n]{0,8})/g, '')
  // 6) 清理空白行/多余换行
  out = out.replace(/\n{3,}/g, '\n\n')
  return out
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
  diag?: { settled: { src: string; ok: boolean; n: number; timeout: boolean; relaxed: boolean }[] }
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
    while ((m = re.exec(xml)) !== null && i < 10) {
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
    const hits = (j.hits || []).slice(0, 8)
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

// —— Bing 片段质量门禁（仅用于 searchBing，避免把 SERP 噪声注入模型）——
// Bing 免费 SERP 的 b_algo 首段常是百科/词典/歌词/广告/歧义词条（「某」→字典、「字节」→存储单位、「最近」→歌词），
// 这些噪声会污染模型上下文、浪费 token。注入前做轻量相关性过滤，但保留 relaxed 不丢真相关结果（分层回退）。
function isBingNoise(t: string): boolean {
  return /(拼音|部首是|部首为|读音|笔画|由.+演唱|作词|作曲|古称|别称.*市|是指|指说话前|新华字典|说文|总笔画|部首：|指不定的|指示代词|书证|某字|释义|康熙字典)/.test(t)
}
function bingAnchors(q: string): string[] {
  const clean = q.replace(/[\s,，。、？?！!]/g, '')
  const n = clean.length
  if (n < 3) return []
  const set = new Set<string>()
  for (let i = 0; i + 3 <= n; i++) set.add(clean.slice(i, i + 3))
  for (let i = 0; i + 4 <= n; i++) set.add(clean.slice(i, i + 4))
  return [...set]
}
// 命中锚点数（用于保底层：要求 ≥2 个锚点，过滤掉「最近」古文、「某」字典这类仅共享 1 个歧义词的噪声）
function bingGramHits(q: string, t: string): number {
  const anchors = bingAnchors(q)
  if (anchors.length === 0) return 1
  let h = 0
  for (const g of anchors) if (t.includes(g)) h++
  return h
}
function bingRelevant(q: string, t: string): boolean {
  const anchors = bingAnchors(q)
  if (anchors.length === 0) return true
  let hit = 0
  let hit4 = false
  for (const g of anchors) {
    if (t.includes(g)) { hit++; if (g.length >= 4) hit4 = true }
  }
  return hit >= 2 || hit4
}

// Bing 网页搜索：通用网页摘要，覆盖面广，但偶有反爬挑战页（检测到就跳过）。
// 注意：Bing 中文结果可能以 GBK 返回，Deno 默认按 UTF-8 解出乱码，故用 arrayBuffer 双解码兜底。
async function searchBing(q: string, siteScope?: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const qFull = siteScope ? `${q} ${siteScope}` : q
    const url = 'https://www.bing.com/search?q=' + encodeURIComponent(qFull) + '&cc=us&setlang=en-US'
    const r = await fetchWithTimeout(url, { headers: { ...BROWSER_HEADERS } })
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
    while ((m = re.exec(html)) !== null && i < 15) {
      const txt = stripHtml(m[1])
      // 先丢字典/歌词/百科卡片类噪声片段（「某」→拼音、由…演唱 等）
      if (txt && txt.length > 15 && !isBingNoise(txt)) snippets.push('- ' + txt.slice(0, 500))
      i++
    }
    // 结果链接：b_algo 块内第一个 h2>a 的 href 即真实地址
    const reA = /<li class="b_algo"[\s\S]*?<h2><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    let ma: RegExpExecArray | null
    while ((ma = reA.exec(html)) !== null && links.length < 8) {
      const href = ma[1]
      if (/^https?:\/\//.test(href)) links.push({ title: stripHtml(ma[2]) || href, url: href, source: 'bing' })
    }
    // 相关性门禁（分层回退，避免把 SERP 噪声注入模型）：
    // ① 严格层：片段需命中 ≥2 个不同锚点或 1 个 ≥4 字锚点；
    // ② 宽松层：至少命中 1 个 3~4 字锚点；
    // ③ 保底层：原样返回（极端情况也不让 Bing 退化成空，模型自有兜底）。
    const strict = snippets.filter((s) => bingRelevant(q, s))
    const soft = snippets.filter((s) => bingGramHits(q, s) >= 2)
    // 两层都空则不硬塞原始噪声，让 Bing 退化成空（模型 + gnews/wiki 自有兜底）
    const finalItems = strict.length ? strict : soft
    return { items: finalItems.slice(0, 10), ok: finalItems.length > 0, links }
  } catch {
    return { items: [], ok: false, links: [] }
  }
}

// 百度网页搜索：中文覆盖面最广的通用源。数据中心 IP 偶发安全验证页（检测到就跳过），
// 同样存在 GBK 返回问题，用 arrayBuffer 双解码兜底；解析失败时优雅返回空。
async function searchBaidu(q: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    // 移动端入口：百度对移动 UA 反爬更宽松
    const url = 'https://m.baidu.com/s?wd=' + encodeURIComponent(q) + '&rn=10'
    const r = await fetchWithTimeout(url, { headers: { ...BROWSER_HEADERS } })
    const buf = await r.arrayBuffer()
    let html = new TextDecoder('utf-8').decode(buf)
    if (html.includes('�')) { try { html = new TextDecoder('gbk').decode(buf) } catch {} }
    if (/安全验证|百度安全验证|wappass|请输入验证码|网络不给力/i.test(html)) {
      return { items: [], ok: false }
    }
    const snippets: string[] = []
    // 兼容桌面端 + 移动端百度 HTML 结构
    const re = /<div class="(?:c-abstract|cos-space-mb-sm)[^"]*"[^>]*>([\s\S]*?)<\/div>|<span class="(?:content-right|cos-text-hide)[^"]*"[^>]*>([\s\S]*?)<\/span>|<div class="c-span-last"[^>]*>([\s\S]*?)<\/div>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null && snippets.length < 10) {
      const txt = stripHtml(m[1] || m[2] || m[3] || '')
      if (txt && txt.length > 15) snippets.push('- ' + txt.slice(0, 500))
    }
    return { items: snippets, ok: snippets.length > 0 }
  } catch {
    return { items: [], ok: false }
  }
}

// Reddit 社区讨论：真实用户观点，对「体验」「口碑」「避雷」类问题有价值。
async function searchReddit(q: string): Promise<{ items: string[]; ok: boolean }> {
  try {
    const url = 'https://www.reddit.com/search.json?q=' + encodeURIComponent(q) + '&limit=8&sort=relevance'
    const r = await fetchWithTimeout(url, { headers: { ...BROWSER_HEADERS } })
    const j = await r.json()
    const children = (j.data?.children || []).slice(0, 8)
    const items = children.map((c: any) => {
      const d = c.data || {}
      const txt = String(d.selftext || d.title || '').slice(0, 500)
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
  const tasks: Promise<{ items: string[]; ok: boolean; src: string }>[] = []

  // 有密钥则优先用可靠商业源（Tavily 覆盖实时检索；中文经模型整理输出，规避上游偶发乱码）
  // 通用网页源（Tavily/Brave/Serper）本身已按 query 定向检索，结果天然相关，**跳过严格 token 过滤**（relaxed），
  // 否则「内江医科学校」这类长尾实体的网页结果会因片段未逐字命中实体名而被全数丢弃。
  let keySrc = 'tavily'
  if (SEARCH_KEY) {
    keySrc = SEARCH_PROVIDER === 'brave' ? 'brave' : SEARCH_PROVIDER === 'serper' ? 'serper' : 'tavily'
    const p = keySrc === 'brave' ? searchBrave : keySrc === 'serper' ? searchSerper : searchTavily
    tasks.push(withTimeout(s2(p(query), keySrc, true), 3500))
  }

  // 免密钥通用网页源（常驻兜底，不依赖任何 API key）：Bing 从悉尼出口实测可达、中文干净、~240ms。
  // 即便配了付费 key，Bing 也并行提供第二路通用网页结果，提升「县城/小生意/长尾实体」类查询的覆盖率。
  tasks.push(withTimeout(s2(searchBing(query), 'bing', true), 3500))

  // 中文覆盖面最广的通用源（百度）：中文实体/长尾查询覆盖率高于 Bing，悉尼出口可达。
  tasks.push(withTimeout(s2(searchBaidu(query), 'baidu', true), 3500))

  // DuckDuckGo HTML 版：免 key 通用网页源，反爬宽松，实测悉尼可达
  tasks.push(withTimeout(s2(searchDuckDuckGo(query), 'ddg', true), 3500))

  // 动态 / 新闻源（最新信息，优先注入模型上下文）。同样 relaxed：新闻/HN 已是 query 定向，
  // 区域相关新闻（如查某县高校命中该县新闻）对回答有价值，不必逐字命中实体名。
  tasks.push(withTimeout(s2(searchGoogleNews(query), 'gnews', true), 1800))
  tasks.push(withTimeout(s2(searchHackerNews(query), 'hn', true), 1800))
  // 百科兜底源：维基（中/英）。维基片段偶发严重跑题（如查「内江医科学校」返回「中国高校合并」通页），
  // 故**保留**严格 token 相关性过滤，避免把无关词条污染生成模型。
  tasks.push(withTimeout(s2(searchWikipedia(query, 'zh'), 'wiki-zh'), 1800))
  tasks.push(withTimeout(s2(searchWikipedia(query, 'en'), 'wiki-en'), 1800))

  // 冷启动守护（关键修复）：原先 0.7s 一刀切导致悉尼冷实例下所有外部源（gnews/wiki/tavily 普遍 0.7~1.5s）
  // 全部被丢弃 → 检索结果恒为 0 → 模型拿不到资料只能说「未检索到」。改为**按源给独立超时预算**
  // （通用网页 3.5s、新闻/HN/维基 1.8s），既保住真实可达的结果，又防止单源挂死拖垮整体。
  const settled: any[] = (await Promise.all(tasks)).filter((s: any) => s && !s._timeout)
  const sources: string[] = []
  const dyn: string[] = []
  const wiki: string[] = []
  const social: string[] = [] // 社媒/UGC 专项池：保证抖音/小红书等内容有独立配额，不被通用结果淹没
  const seen = new Set<string>()
  const rt = relevanceInfo(query)
  // 收集可点击参考链接（去重 + 过滤搜索引擎自身包装/跳转噪音 + 通用源关联性门控），供前端「相关链接」卡片使用
  // 通用搜索引擎（Tavily/Brave/Serper/Bing/DDG）若整源 items 全被相关性过滤（典型：Tavily 共享 key 出乱数据返回 Unicode 字符表这种内容），
  // 其 links 全部丢弃——否则「内江医科学校」会混进 Unicode 表/肺癌论文这种不沾边的卡片噪声；
  // 权威/特定源（wiki/reddit/hn/gnews）天然保留 links（这些源的链接即便主题不显式相关也对用户有用）。
  const TRUSTED_LINK_SRC = new Set(['wiki-zh', 'wiki-en', 'reddit', 'hn', 'gnews'])
  const links: LinkInfo[] = []
  const seenLinks = new Set<string>()
  const isNoiseLink = (u: string) => /(duckduckgo\.com\/l\/|bing\.com\/ck\/|google\.com\/url|news\.google\.com\/rss|bing\.com\/search|baidu\.com)/.test(u)
  for (const s of settled) {
    let sourceRelevantCount = 0
    if (s.ok && s.items.length) {
      const base = s.src.split(':')[0] // gnews / hn / bing / reddit / wiki-zh / wiki-en / ddg / tavily / brave / serper / tavily-social / bing-social
      if (!sources.includes(base)) sources.push(base)
      const bucket = base === 'wiki-zh' || base === 'wiki-en' || base === 'ddg'
        ? wiki
        : base === 'tavily-social' || base === 'bing-social'
        ? social
        : dyn
      for (const raw of s.items) {
        if (raw.includes('\uFFFD')) continue // 丢弃乱码片段，避免污染生成模型
        // 单条截断上限 480→1200：给生成模型更完整的原始事实（分数线/薪资/地址等常超 480 字被腰斩），
        // 正文才能写得有细节、有数据，而非泛泛而谈。
        const it = raw.length > 1200 ? raw.slice(0, 1200) + '…' : raw
        if (!isRelevant(it, rt, !!s.relaxed)) continue // 社媒域作用域结果已按 query 过滤，跳过通用相关性门禁
        if (!seen.has(it)) { seen.add(it); bucket.push(it); sourceRelevantCount++ }
      }
    }
    // 链接收集：权威/特定源直接保留；通用源需至少 1 条相关 items 才保留链接（防 Tavily 共享 key 出乱数据污染）
    const base = s.src.split(':')[0]
    const skipLinks = !TRUSTED_LINK_SRC.has(base) && sourceRelevantCount === 0
    for (const lk of s.links || []) {
      if (!lk?.url || seenLinks.has(lk.url) || isNoiseLink(lk.url)) continue
      try { new URL(lk.url) } catch { continue }
      if (skipLinks) continue
      seenLinks.add(lk.url)
      links.push(lk)
    }
  }
  // 通用动态源（最多 20）+ 社媒/UGC 专项（固定 10 条配额）+ 维基兜底（最多 14），合计 44 条上限。
  // 适度放宽：给生成模型更多事实底座，正文才能写得更详实（之前 28 条上限偏低，常导致「暂无法确认」偏多）。
  let merged: string[] = [...dyn.slice(0, 20), ...social.slice(0, 10), ...wiki.slice(0, 14)]
  // 最终兜底：再滤一次含 U+FFFD 的片段（上游网页偶发编码损坏，单点过滤可能漏网，防止污染模型上下文导致回答出乱码方块）
  merged = merged.filter((r) => !r.includes('\uFFFD'))
  // 安全网：若相关性过滤后结果过少（易致「查不到」），放宽门禁，避免空答
  if (merged.length < 5) {
    const seenR = new Set(merged)
    const relaxed: string[] = []
    for (const s of settled) {
      if (!s.ok) continue
      for (const raw of s.items) {
        if (raw.includes('\uFFFD')) continue
        const it = raw.length > 1200 ? raw.slice(0, 1200) + '…' : raw
        if (!seenR.has(it)) { seenR.add(it); relaxed.push(it) }
      }
    }
    if (relaxed.length) merged = [...merged, ...relaxed].slice(0, 48)
  }
  // 参考链接：相关性去噪（query 主体 token 必须命中；维基条目也走相关性；机构权威域名天然保留）→ 按权威度排序 → 上限 6 条
// 不设安全网：宁可链接为 0 让前端不渲染卡片，也绝不展示不沾边的乱数据（Tavily 共享 key 偶发返回无关 cache 内容时尤其重要，安全网会把它们原样复活，污染用户体验）
const linksFinal = sortLinks(links.filter((lk) => isLinkRelevant(lk, rt))).slice(0, 8)
  // 严格判定 ok：至少 3 条长度 ≥ 50 字符的实质片段 才算检索成功。
  // 原 `merged.length > 0` 太松，5 条 < 10 字符的 gnews 短标题噪声也会被算成功，引发 model 误判"资料齐全"→ 信心满满地"自查 + 编"。
  // 注意：链接不再作为硬门槛——`isLinkRelevant` 对热门实体偶尔会过严（如电子科大维基条目被滤），
  // 但只要内容充足（≥ 3 条实质片段）就足够支撑"资料齐全"作答。
  const usefulResults = merged.filter((r) => r.length >= 50)
  const strictOk = usefulResults.length >= 3
  return {
    results: merged,
    sources,
    links: linksFinal,
    ok: strictOk,
    diag: {
      settled: settled.map((s: any) => ({ src: s.src, ok: !!s.ok, n: (s.items || []).length, timeout: !!s._timeout, relaxed: !!s.relaxed })),
      useful: usefulResults.length,
      raw: merged.length
    }
  }
}

function s2(p: Promise<{ items: string[]; ok: boolean; links?: LinkInfo[] }>, src: string, relaxed = false) {
  return p.then((r) => ({ ...r, src, relaxed, links: r.links || [] }))
}

// —— 浏览器级全文抓取 ——
// 像浏览器一样：不只看搜索摘要，还打开排名靠前的页面抓取全文内容。
// 这样模型能拿到足够详实的素材，回答才能「像浏览器查到的一样详细」。
async function fetchPageContent(url: string, maxChars = 3500): Promise<string> {
  try {
    const r = await fetchWithTimeout(url, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, 8000)
    if (!r.ok) return ''
    const ct = r.headers.get('content-type') || ''
    if (!ct.includes('text/html') && !ct.includes('text/plain') && !ct.includes('application/xhtml')) return ''
    const buf = await r.arrayBuffer()
    let html = new TextDecoder('utf-8').decode(buf)
    if (html.includes('�')) { try { html = new TextDecoder('gbk').decode(buf) } catch {} }
    // 剥离脚本/样式/导航/页脚/广告等非正文元素
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
    const text = stripHtml(html).replace(/\s+/g, ' ').trim()
    return text.length > maxChars ? text.slice(0, maxChars) + '…' : text
  } catch {
    return ''
  }
}

// 对排名靠前的检索结果做「浏览器级」全文抓取，返回可直接注入 <search> 的文本片段。
// 最多抓 maxPages 个页面，每页限 maxChars 字；整体硬截止 maxMs 毫秒，超时则返回已抓到的部分。
async function deepFetchLinks(links: LinkInfo[], maxPages = 3, maxChars = 3500, maxMs = 6000): Promise<string[]> {
  const top = links.filter(lk => /^https?:\/\//.test(lk.url)).slice(0, maxPages)
  if (top.length === 0) return []
  const results = await Promise.race([
    Promise.all(top.map(async (lk) => {
      const content = await fetchPageContent(lk.url, maxChars)
      if (!content || content.length < 200) return null
      return `- 【网页全文·${lk.title || new URL(lk.url).host}】${content}`
    })),
    new Promise<null[]>(r => setTimeout(() => r([]), maxMs))
  ])
  return results.filter((r): r is string => r !== null)
}

// 给单个检索任务独立超时预算：超时则返回 {_timeout:true}，不拖垮整段检索。
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | { _timeout: true }> {
  return Promise.race<T | { _timeout: true }>([p, new Promise((res) => setTimeout(() => res({ _timeout: true }), ms))])
}

// —— 统一收尾（流式 / 非流式共用）：清洗正文（工具标签 / 标签墙 / 内部泄漏），
//    content 为空则强制简短重试一次，抽取 reason 并剥离身份泄漏词，最后补抓实体配图。
//    抽成函数是为保证两条路径的「防幻觉 / 防泄漏 / 配图」行为完全一致，避免流式分支漏掉防御。
async function finalizeGeneration(
  sysMessages: any[],
  rawUser: string,
  data: any,
  searchMeta: any,
  imagePromise: Promise<{ lead: { url: string; title: string } | null; scenes: { url: string; title: string }[] }>
): Promise<{ content: string; reasoning: string; imgs: { lead: { url: string; title: string } | null; scenes: { url: string; title: string }[] }; data: any }> {
  const imgs = await Promise.race([
    imagePromise,
    new Promise<{ lead: { url: string; title: string } | null; scenes: { url: string; title: string }[] }>((r) =>
      setTimeout(() => r({ lead: null, scenes: [] }), 1800)
    )
  ]).catch(() => ({ lead: null, scenes: [] }))

  let content = (data as any)?.choices?.[0]?.message?.content ?? ''
  // 防御：agnes-2.0-flash 偶发把内部 <tool_call>/<function> 工具调用标签直接吐进正文，
  // 导致正文变成工具调用碎片、真正的回答缺失。先剥离这些内部标签；若剥离后正文过短（视为坏输出），触发重试。
  const origRaw = content
  content = cleanToolCalls(content)
  // 标签墙硬约束：剥离模型正文里过度喷涌的【AI 整理·模型知识】等行内/句末来源标签（用户投诉"标注墙"）。
  // 注意：只清洗这种内联小标签；用户约定的 ===信息来源备注=== 整段集中说明保留。
  content = cleanLabelWall(content)
  content = cleanInternalLeak(content)
  const toolLeak = looksLikeToolCallLeak(origRaw)
  // 修复：只要原始输出或清洗后残留含工具调用标签，就进重试——不被「一句前言 + 海量 broken 标签」的长度骗过。
  if (!content?.trim() || toolLeak || looksLikeToolCallLeak(content)) {
    try {
      // 严禁工具调用的强指令：资料已附在 <search> 中，直接作答、不要再触发 web_search / 工具调用
      const directive =
        '你已拥有完整检索资料，请直接基于 <search> 中的资料作答。绝对禁止调用任何搜索工具或函数（不要使用 web_search，不要输出 <tool_call>/<function> 等任何内部协议标签）。直接给出最终答案。'
      for (let attempt = 0; attempt < 2; attempt++) {
        const retryMsgs = [
          ...sysMessages,
          { role: 'system' as const, content: directive },
          {
            role: 'user' as const,
            content:
              rawUser +
              '\n\n【系统提示】上一轮回复因输出截断或误触发工具调用而缺失，请直接给出完整答案，不要再做内部检索模拟，也不要调用任何工具。'
          }
        ]
        const retry = await callV9(
          { model: V9_MODEL, messages: retryMsgs, max_tokens: 6500, stream: false, temperature: 0.7 },
          30000
        )
        const rd = retry.data ?? {}
        const rcontent = cleanToolCalls(rd?.choices?.[0]?.message?.content ?? '')
        // 接受条件：非空、长度足够、且清洗后**无任何工具标签残留**（避免被 broken 标签骗过）
        if (rcontent?.trim() && rcontent.trim().length >= 50 && !looksLikeToolCallLeak(rcontent)) {
          content = rcontent
          // 把重试拿到的 content 合并回 data，让前端走正常渲染路径
          ;(data as any).choices = (data as any).choices || [{}]
          ;(data as any).choices[0].message = { ...((data as any).choices[0].message || {}), content: rcontent }
          break
        }
      }
    } catch {
      // 重试失败也无所谓，至少不返空白
    }
  }

  // 抽取模型内部思考（reasoning_content），剥离可能泄露底层模型身份的词，附到返回体供前端展示「AI 思考过程」
  const rawReasoning = (data as any)?.choices?.[0]?.message?.reasoning_content || ''
  // 过滤掉模型在 reasoning 里"自导自演"的伪 <search> 标签——它不是真检索结果，是模型模拟的动作，会误导用户
  const cleanedReasoning = rawReasoning
    .replace(/<search>[\s\S]*?<\/search>/g, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<tool_calls?[\s\S]*?<\/tool_calls?>/gi, '')
    .replace(/<function=[\s\S]*?<\/function>/gi, '')
    .replace(/<function=[^>]*>/gi, '')
    .trim()
  const reasoning = cleanedReasoning ? stripIdentity(cleanedReasoning) : ''
  // 兜底：清洗模型输出里偶发的 U+FFFD 乱码字符（上游检索片段编码损坏被模型引用时），避免用户看到乱码方块
  if ((data as any)?.choices?.[0]?.message?.content) {
    ;(data as any).choices[0].message.content = cleanInternalLeak(cleanLabelWall(cleanToolCalls(
      String((data as any).choices[0].message.content).replace(/\uFFFD/g, '')
    )))
  }
  return { content, reasoning, imgs, data }
}

// 带超时与自动重试的 v9(Agnes) 调用封装。
// 背景：agnes-2.0-flash 是推理模型，冷启动偶发 60s+ 才返回；而 Supabase Edge Function 网关预算约 50s，
// 一旦超过会被强杀 → 前端干等 60s 后只看到报错。改为：单次 22s 超时，失败（含超时）自动重试一次，
// 两次都失败则交由上层「降级」分支返回 200 + 已检索资料，绝不让用户干挂。
async function callV9(payload: any, timeoutMs = 30000): Promise<{ data: any; status: number }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${V9_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${V9_ANON}` },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    })
    const data = await r.json().catch(() => ({}))
    return { data, status: r.status }
  } finally {
    clearTimeout(timer)
  }
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

  try {
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
  // 搜索诊断：逐源暴露「原始条数 / 相关性过滤后条数 / 截断前样本」，定位检索被清空在哪一层
  if (body.__debug_search) {
    const q = String(body.query || body.__debug_search || '')
    const rt = relevanceInfo(q)
    const sources: [string, Promise<{ items: string[]; ok: boolean; links?: any[] }>][] = [
      ['bing', searchBing(q)],
      ['ddg', searchDuckDuckGo(q)],
      ['reddit', searchReddit(q)],
      ['baidu', searchBaidu(q)],
      ['gnews', searchGoogleNews(q)],
      ['hn', searchHackerNews(q)],
      ['wiki-zh', searchWikipedia(q, 'zh')],
      ['wiki-en', searchWikipedia(q, 'en')]
    ]
    if (SEARCH_KEY) sources.push([SEARCH_PROVIDER || 'tavily', searchTavily(q)])
    const settled = await Promise.all(
      sources.map(([name, p]) => Promise.race<any>([p.then((r) => ({ ...r, name })), new Promise((res) => setTimeout(() => res({ _timeout: true, name }), 1800))]))
    )
    const diag = settled.map((s: any) => {
      const raw = (s.items || []).length
      const relevant = (s.items || []).filter((it: string) => isRelevant(it, rt)).length
      const sample = (s.items || []).slice(0, 2).map((it: string) => it.slice(0, 80))
      return { src: s.name, timeout: !!s._timeout, ok: !!s.ok, raw, relevant, sample }
    })
    return json({ query: q, tokens: rt.tokens, years: rt.years, kw: rt.kw, perSource: diag })
  }
  // 关键修复：原「Failed to fetch」根因是 Bing/DDG/Reddit 等检索源在悉尼节点经常被 GFW/限流挂死，
  // 导致 searchMulti 迟迟不返回、整段响应超网关首字节预算（约 3s）→ 503 无 CORS。修复分两层：
  // (1) searchMulti 改按源给独立超时预算（通用网页 3500ms、新闻/HN/维基 1800ms），挂死慢源超时丢弃，保留已返回的快源；
  // (2) 配图 fetchEntityImages 内部 3s cap，主路径（v9 返回后）再套 1.8s「响应态短截止」——
  //     图片获取实测仅 ~1–1.5s（曾因 `const scenes` 重赋值 bug 抛异常被吞，已修复），与 v9 并行启动，
  //     暖路径总响应 ≈ v9+图 ≈ 2.5s < 网关预算(约2.8s) → 既保 200 又带回真实题图/场景图；
  //     冷路径 v9 远慢于图，await 立即取真值。腾不出图的暖实例仍发空图保 200，前端 onError 兜底插画。
  const messages: any[] = body.messages || []
  // 推理模型需要足够预算：max_tokens=2000 时 reasoning_content 经常把预算吃光，content 变空。
  // 默认直接拉到上限 8192，并把下限抬到 8000，确保「隐藏推理」与「可见正文」都有充足空间，
  // 避免正文被 reasoning 挤占而显得单薄（用户反馈「AI 说得不详细」的主因）。
  const maxTokens = Math.min(Math.max(body.max_tokens ?? 8192, 8000), 8192)
  const webSearch = !!body.web_search
  const autoSearch = !!body.auto_search
  const searchOnly = !!body.search_only
  const stream = !!body.stream  // 前端请求流式：推理过程边想边推
  const structuredReasoning = !!body.structured_reasoning  // 深度思考：模型先写思考再【回答】分隔

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
    query?: string
    needSearch?: boolean
    diag?: any
  } = { ok: false, count: 0, sources: [], links: [], image: null, images: [] }
  // 透出诊断：无论是否真正发起检索，都把 query / needSearch 带回，便于排查「检索被跳过」类问题
  searchMeta.query = query
  searchMeta.needSearch = needSearch
  let rawResults: string[] = []

  if (needSearch && query) {
    let ctx = await searchMulti(query)
    // 第一次检索资料不足时，用完整实体名再查一次（避免"内江医科学校"被拆成"内江医科"导致跑偏）
    if (!ctx.ok) {
      const entityQuery = extractEntityQuery(rawUser)
      if (entityQuery !== query) ctx = await searchMulti(entityQuery)
    }
    searchMeta = { ok: ctx.ok, count: ctx.results.length, sources: ctx.sources, links: ctx.links, image: null, images: [], query, needSearch, diag: ctx.diag }
    // 清洗无效 Unicode（lone surrogates 等）：TextEncoder round-trip 模拟 UTF-8 传输，
    // 让无法编码的字符现形为 U+FFFD 再删除——否则 Deno 编码响应体时它们会变成 U+FFFD 乱码方块到达客户端
    rawResults = ctx.results.map(r => { try { return new TextDecoder().decode(new TextEncoder().encode(r)).replace(/\uFFFD/g, '') } catch { return r } }).filter(r => r.trim().length > 10)
    // 浏览器级全文抓取：对排名靠前的参考链接打开页面抓全文，像浏览器一样拿到详细正文。
    // 检索成功且有链接时触发，与图片抓取并行、硬截止 6s，不拖慢主路径。
    let deepPromise: Promise<string[]> = Promise.resolve([])
    if (ctx.ok && ctx.links.length > 0 && !searchOnly) {
      deepPromise = deepFetchLinks(ctx.links, 3, 3500, 6000)
    }
    // 资料不足分支：检索跑过但没拿到有效资料（连 2 条 ≥50 字的实质片段都凑不齐）。
    // 原代码不分这种情况，都走"资料齐全"分支并允许 AI 用知识补 → 大量幻觉（用户截图：
    // "内江医科学校"根本不存在，模型自信满满编"中等职业学校，培养护理药剂检验"）。
    // 现在专门推一条强指令，禁止 AI 用自身知识补，直接告知未检索到、列出已尝试的源、建议换关键词。
    if (!ctx.ok && !searchOnly) {
      const sourcesTxt = ctx.sources.length ? ctx.sources.join('、') : '全部内置源'
      const rawLen = rawResults.length
      const linksTxt = ctx.links.length
        ? `\n下面列出已抓到的链接（供用户点击备查）：\n${ctx.links.slice(0, 8).map((l, i) => `${i + 1}. ${l.title} — ${l.url}`).join('\n')}`
        : ''
      sysMessages.push({
        role: 'system',
        content:
          `【重要】针对用户原话「${rawUser}」的检索结果如下：\n` +
          `<search>\n${ctx.results.join('\n') || '（空）'}\n</search>\n` +
          `\n⚠️ 资料不足以让你给出真实答案：仅 ${rawLen} 条短片段（最长 ${Math.max(...ctx.results.map((r) => r.length), 0)} 字），且 ${ctx.links.length ? '' : '无'}可靠的官网/百科链接。已尝试源：${sourcesTxt}。${linksTxt}\n` +
          `\n请严格遵守（本次回复不可偏离）：\n` +
          `① 不要基于自身知识编造任何具体事实——尤其是学校类型 / 办学层次 / 专业设置 / 分数线 / 就业率 / 升学通道 / 学费 这类不在本次 <search> 里原文出现的内容。编出来就是幻觉，会严重误导正在做择校决定的学生与家长；\n` +
          `② 不要给出「该校是 X 类型学校 / 位于 X 省 Y 市 / 设有 X 专业」这类确定性描述，除非 <search> 里原文出现；\n` +
          `③ 明确告知用户："关于「${rawUser}」，本次未检索到相关公开资料"，并列出本次已尝试的检索源（${sourcesTxt}），让用户知道系统确实跑过检索；\n` +
          `④ 给出可操作的建议，例如："可尝试换用更口语或常用名（学校全称 / 所在地 + '大学/学院/学校' / 招生年份 + 校名）"或"直接查询该校官网 / 官方公众号 / 招生办电话"；` +
          `⑤ 回答风格：简短、客观、不绕弯。**不要写**「## 学校概况」「## 办学定位」「## 优劣势分析」这种假装资料的标题——这是以前模型胡编时的"伪资料"包装；直接一句话点明情况 + 建议即可。` +
          `⑥ 严禁调用任何搜索工具或函数，直接基于本提示与 <search> 作答。`
      })
    } else if (ctx.ok && !searchOnly) {
      // 浏览器级全文抓取：await 已并行启动的 deepPromise，合并到 <search> 中。
      // 全文片段带「网页全文」前缀，与检索摘要区分，让模型优先引用全文内容。
      const deepResults = await deepPromise
      const mergedForSearch = deepResults.length ? [...ctx.results, ...deepResults] : ctx.results
      const linkBlock = ctx.links.length
        ? '\n【检索到的参考链接（请在回答末尾「相关链接与地点」板块中如实引用，标注来源；不要编造未列出的链接）：】\n' +
          ctx.links.slice(0, 14).map((l, i) => `${i + 1}. （${l.source}）${l.title} ${l.url}`).join('\n') + '\n'
        : ''
      sysMessages.push({
        role: 'system',
        content:
          '你具备查阅最新公开资料的能力。\n' +
          `【用户原话】${rawUser}\n` +
          '以下是针对用户原话检索到的资料（来自网络，可能不保证 100% 最新，请批判性采用，优先采信可交叉验证的事实）：\n' +
          '（注：前缀「网页全文」的片段是打开对应网页抓取的完整正文，内容远比普通检索摘要详细，请优先基于它们作答。）\n' +
          '<search>\n' +
          mergedForSearch.join('\n') +
          '\n</search>\n' +
          linkBlock +
          '要求：① 优先依据上述资料作答；' +
          '② 严禁"来源标注成灾"——只在确实引用了上方 <search> 里某段具体外部资料（如官网具体数字 / 某新闻报道 / 维基词条里的明文事实）时，才在该句末用【资料·来源：xxx】简短标注（如「【资料·来源：维基百科】」）。' +
          '严禁给"自身知识 / 通用常识 / 行业经验 / 跨年对比 / 推断判断"贴来源标签——这类原本就不属于检索资料，强行贴来源会污染正文，' +
          '也不要在每句话、每条优缺点后都贴来源（那叫"标注墙"，用户根本看不下去）。' +
          '若通篇没有具体引用外部资料的数字/事实，就不要在正文中堆任何来源标签；' +
          '③ **仅当 <search> 里确有可用资料时**才允许"综合作答"：基于上方 <search> 资料与你自身的知识一起作答；资料齐全处直接给结论与数据，资料偏旧处用知识补充并标注「（以下为 AI 基于公开知识补充，非本次检索原文）」；' +
          '若 <search> 几乎为空 / 片段极短 / 全部不沾边（本情况会单独推一条「资料不足」指令，不再走本条），**严禁**用自身知识编造具体事实（学校类型、办学层次、专业设置、分数线、就业率、内部数据 等），那些不在检索资料里、用户查不到、编出来就是幻觉——这是上一版模型集中翻车的根因；' +
          '只有连你也无法确认的具体数字 / 内部信息才单独标注「暂无法确认」，且要小范围、克制；' +
          '④ 涉及排名/分数/政策等易变数据，提醒用户以官方最新公布为准；' +
          '⑤ 引用用户原话时务必使用上面【用户原话】字段里的完整字句，不要把检索片段里的 query 拼接词当成用户原话；' +
          '⑥ 回答末尾必须包含「相关链接与地点」板块，列出上述参考链接中的官网/百科/新闻/社媒主页，并补充该实体的具体地址、交通、地图可定位信息（查不到写「暂无法确认具体地址」）。' +
          '⑦ 你**不需要、也不允许**调用任何搜索或函数工具（如 web_search）；资料已附在 <search> 中，请直接基于它们作答，严禁输出 <tool_call>、<function> 等内部协议标签。\n' +
          '⑧ **你必须深度思考，给出自己的分析和判断，而非单纯复述检索资料**：\n' +
          '  a) 回答前先梳理检索资料的关键信息，辨别哪些是最相关、最可靠的；\n' +
          '  b) 结合你的知识进行交叉验证、对比分析——比如查学校时横向对比同档次院校，查城市时结合产业结构分析就业机会；\n' +
          '  c) 给出你明确的观点和结论（用「综合来看」「我的分析是」「值得注意」等措辞），而非罗列一堆资料让用户自己判断；\n' +
          '  d) 对不确定的信息诚实标注（「这一点暂无确切数据，仅供参考」），但不确定的东西不要编；\n' +
          '  e) 结尾给出可操作的建议（择校：关注哪些指标、避开哪些坑；求职：城市/行业怎么选；搞钱：风险点在哪）。\n' +
          '  f) **说直白，有问题就直接说**：学校烂就直说「这学校牌子不够硬，就业市场认可度有限」；公司加班狠就直说「拼多多以996著称，身体不好的慎去」；查不到就直说「查不到，建议换个关键词」。不要和稀泥、不要两面讨好、不要「仁者见仁智者见智」。用户要的是你真实的判断，不是外交辞令。'
      })
    }
  }

  // 真实实体图（题图 + 场景图，学校/公司/城市通用）。与检索、生成并行获取，失败不影响主回答。
  // 内部 3s 硬截止保住真实题图/场景图（前端有 onError 兜底，拿不到也不影响正文）。
  // 关键：主路径在「v9 返回之后」再对图片套 1.8s 响应态短截止（见下方 line ~1018），
  // 确保暖路径图片绝不拖慢首字节/整体响应；冷路径图片早已在 3s 内解析完，await 立即取真值。
  let imagePromise: Promise<ImgSet> =
    needSearch && rawUser ? fetchEntityImages(extractEntity(rawUser)) : Promise.resolve(EMPTY_IMG)
  imagePromise = Promise.race<ImgSet>([imagePromise, new Promise<ImgSet>((res) => setTimeout(() => res(EMPTY_IMG), 3000))])

  // —— 实时资讯模式：只返回检索结果，不调用生成模型（低延迟、直接展示来源）——
  if (searchOnly) {
    // 此分支无 v9 长板，图片是唯一长杆；给 1.5s 短截止，多数图片能在预算内返回，最差发空也不致 503。
    const imgs = await Promise.race([imagePromise, new Promise<ImgSet>((r) => setTimeout(() => r(EMPTY_IMG), 1500))]).catch(() => EMPTY_IMG)
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
  // 深度思考：要求模型先输出思考过程，再以【回答】分隔正式回答（上游无独立 reasoning 通道时的折中方案）
  if (structuredReasoning) {
    sysMessages.push({ role: 'system', content: STRUCTURED_REASONING_DIRECTIVE })
  }

  // —— 流式路径：边生成边把「推理过程」推给前端，实现「深度思考时思考流程实时流出」——
  if (stream) {
    const encoder = new TextEncoder()
    const ss = new ReadableStream({
      async start(controller) {
        const send = (obj: any) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)) } catch {}
        }
        try {
          const r = await fetch(`${V9_BASE}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${V9_ANON}` },
            body: JSON.stringify({
              model: V9_MODEL,
              messages: [...sysMessages, ...otherMessages],
              max_tokens: maxTokens,
              stream: true,
              temperature: body.temperature ?? 0.7
            })
          })
          if (!r.ok || !r.body) throw new Error('v9 stream ' + r.status)
          const reader = r.body.getReader()
          const decoder = new TextDecoder()
          let buf = ''
          let fullReasoning = ''
          let fullContent = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
            let idx: number
            while ((idx = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, idx).trim()
              buf = buf.slice(idx + 1)
              if (!line.startsWith('data:')) continue
              const payload = line.slice(5).trim()
              if (payload === '[DONE]') continue
              try {
                const delta = JSON.parse(payload)?.choices?.[0]?.delta || {}
                // 推理模型：思考过程在 reasoning_content（个别实现叫 reasoning）里逐 token 流出
                if (delta.reasoning_content) {
                  fullReasoning += delta.reasoning_content
                  send({ type: 'reasoning', delta: delta.reasoning_content })
                } else if (delta.reasoning) {
                  fullReasoning += delta.reasoning
                  send({ type: 'reasoning', delta: delta.reasoning })
                }
                // 上游 agnes-2.0-flash 实测不返回独立 reasoning 通道，思考即正文的一部分；
                // 把 content 增量实时推给前端，前端即可在「深度思考中」阶段就把思考正文流出。
                if (delta.content) {
                  fullContent += delta.content
                  send({ type: 'content', delta: delta.content })
                }
              } catch {}
            }
          }
          // 用完整内容做与非流式一致的清洗 / 重试 / 配图，再发最终 done 事件
          const data = { choices: [{ message: { content: fullContent, reasoning_content: fullReasoning } }] }
          const { reasoning, imgs } = await finalizeGeneration(sysMessages, rawUser, data, searchMeta, imagePromise)
          send({
            type: 'done',
            content: (data as any).choices?.[0]?.message?.content || '',
            reasoning,
            search: { ...searchMeta, image: imgs.lead, images: imgs.scenes },
            degraded: false
          })
        } catch (e) {
          send({
            type: 'done',
            content: '⏱️ 生成中断，请点「重新生成」再试一次。',
            reasoning: '',
            search: { ...searchMeta },
            degraded: true
          })
        }
        try { controller.close() } catch {}
      }
    })
    return new Response(ss, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        ...CORS
      }
    })
  }

  // v9 调用统一走 callV9：单次 40s 超时 + 失败（含超时）自动重试一次，共 ~80s，
  // 远在 Edge Function 网关预算（免费档约 50s）兜底里靠 Supabase 客户端层面 retry；两次都失败 → 降级而非干挂。
  // 40s 是经验值：暖路径实测 1–12s（curl 杭电 19.78s 拿到 1183 token），冷启动 25–35s 也覆盖；
  // 比之前 30s 更宽容，彻底避开偶发 30-40s 卡死的冷启动——本轮用户截图"杭州电子科技大学超时"根因就是阈值太紧。
  let v9Resp: { data: any; status: number } | null = null
  for (let i = 0; i < 2 && !v9Resp; i++) {
    try {
      v9Resp = await callV9(
        {
          model: V9_MODEL,
          messages: [...sysMessages, ...otherMessages],
          max_tokens: maxTokens,
          stream: false,
          temperature: body.temperature ?? 0.7
        },
        40000
      )
    } catch {
      // 重试前短暂等待，给 agnes-proxy 冷实例一点启动时间（仅首次重试前等，避免叠加超时）
      if (i === 0) await new Promise((r) => setTimeout(r, 800))
    }
  }

  // 降级：v9 两次都超时/失败（偶发冷启动卡死）。返回 200 + degraded 标记 + 已检索资料摘要，
  // 避免用户干等 60s+ 后只看到空白答案。前端会提示「生成超时，已为你整理资料 + 重新生成」按钮。
  if (!v9Resp) {
    const q = (rawUser || '').slice(0, 100) // 用原始用户问题，不被 extractQuery 截断
    const links = searchMeta.links || []
    const sources = searchMeta.sources || []
    // 摘要列表：优先 links（带标题+URL） → fallback sources（仅标题） → fallback rawResults 片段（保证有内容）
    let list: string
    if (links.length) {
      list = links.slice(0, 5).map((l, i) => `${i + 1}. ${l.title} — ${l.url}`).join('\n')
    } else if (sources.length) {
      list = sources.slice(0, 5).map((t, i) => `${i + 1}. ${t}`).join('\n')
      if (rawResults.length) {
        list += '\n\n**📖 资料摘要片段：**\n' + rawResults.slice(0, 2).map((t) => `> ${t.slice(0, 220).replace(/\n+/g, ' ')}`).join('\n\n')
      }
    } else if (rawResults.length) {
      list = rawResults.slice(0, 3).map((t, i) => `${i + 1}. ${t.slice(0, 220).replace(/\n+/g, ' ')}`).join('\n\n')
    } else {
      list = '（暂无资料）'
    }
    const fallbackContent =
      `⏱️ **AI 生成超时（网络偶发卡顿）**，但已为你检索到 ${searchMeta.count || 0} 条公开资料，请你先参考下方链接；点「重新生成」可再试一次。\n\n` +
      `> 关于「${q}」的参考资料：\n${list}\n\n` +
      `💡 建议：点击下方「重新生成」可再试一次，或直接打开上方链接获取完整信息。`
    return json(
      {
        degraded: true,
        choices: [{ message: { content: fallbackContent } }],
        search: { ...searchMeta, image: EMPTY_IMG.lead, images: EMPTY_IMG.scenes },
        reasoning: ''
      },
      200
    )
  }

  const upstream = v9Resp
  const data = v9Resp.data ?? {}

  // 统一收尾：清洗正文 / 正文空则重试 / 抽 reason / 抓配图（与流式路径共用 finalizeGeneration）
  const { reasoning, imgs } = await finalizeGeneration(sysMessages, rawUser, data, searchMeta, imagePromise)
  const enriched = {
    ...data,
    search: { ...searchMeta, image: imgs.lead, images: imgs.scenes },
    reasoning
  }
  return json(enriched, upstream.status)
  } catch (err) {
    // 兜底：任何未捕获异常都转成 200 JSON（带 CORS），避免网关直接 503 无体、前端 Failed to fetch 且无法排查。
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : ''
    return json({ error: 'INTERNAL', message: msg, stack: stack ? String(stack).slice(0, 800) : '' }, 200)
  }
})
