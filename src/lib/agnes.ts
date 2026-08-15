// Agnes / DeepSeek 兼容代理客户端
//
// 安全约定（沿用你既有 ai-director-canvas 的约定）：
// - 开发态（base 以 "/" 开头）：不带头，由本地 Vite proxy 在服务端注入上游 key，bundle 无 key。
// - 生产态（base 是 Supabase Edge Function）：只带 Supabase 匿名 key 鉴权函数调用本身。
//   上游（DeepSeek）key 只存在于函数端 Deno secret，前端永不持有、永不发送。
//   因此这里严禁读取/发送任何上游 key。

// 注：现有 agnes-proxy(v9) 走 Agnes 平台，仅认 'agnes-2.0-flash'。
// 若已 redeploy supabase/functions/agnes-proxy（直连 DeepSeek 版），改回 'deepseek-v4-flash'
// 即可启用服务端联网搜索（web_search 标志才会真正生效）。
export const DEFAULT_MODEL = 'agnes-2.0-flash'

function resolveBase(): string {
  const base = (import.meta as any).env?.VITE_AGNES_BASE as string | undefined
  if (base && base.trim()) return base.trim() // 形如 https://xxxx.functions.supabase.co/agnes-proxy
  return '/api/agnes' // 开发代理（Vite 服务端注入 key）
}

function resolveAuthHeaders(): Record<string, string> {
  const base = resolveBase()
  if (base.startsWith('/')) return {} // 开发代理：无头
  const anon = (import.meta as any).env?.VITE_SUPABASE_ANON as string | undefined
  return anon ? { Authorization: `Bearer ${anon}` } : {}
}

async function call<T = any>(
  path: string,
  opts: { method?: string; body?: any; signal?: AbortSignal }
): Promise<T> {
  const base = resolveBase()
  const url = `${base}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...resolveAuthHeaders()
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 180_000)
  // 外部中断（如「停止生成」）：与超时共用一个 controller，任一触发即取消请求
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort()
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  try {
    let lastErr: any
    // 网络瞬时错误（Failed to fetch / DNS / 5xx）自动重试，指数退避
    // 给用户最稳定的体验，避免一次抖动就显示「出错」
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: opts.method || 'POST',
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: controller.signal
        })
        if (!res.ok) {
          // 5xx 视为可重试；4xx 直接抛出（用户输入问题，重试无意义）
          if (res.status >= 500 && attempt < 2) {
            lastErr = new Error(`HTTP ${res.status}`)
            await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)))
            continue
          }
          let msg = `HTTP ${res.status}`
          try {
            const t = await res.text()
            if (t) msg += ` ${t.slice(0, 300)}`
          } catch {}
          throw new Error(msg)
        }
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('application/json')) return (await res.json()) as T
        return (await res.text()) as unknown as T
      } catch (e: any) {
        // 用户主动中止：不重试
        if (e?.name === 'AbortError') throw e
        // 浏览器原生网络错误（Failed to fetch / DNS / net::ERR_*)：可重试
        const msg = String(e?.message || e)
        const isNetwork = /Failed to fetch|NetworkError|net::ERR|fetch failed|TypeError: fetch/i.test(msg)
        if (isNetwork && attempt < 2) {
          lastErr = e
          await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)))
          continue
        }
        throw e
      }
    }
    throw lastErr || new Error('retry exhausted')
  } finally {
    clearTimeout(timer)
  }
}

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  model?: string
  maxTokens?: number
  /** 强制开启服务端检索（agnes-search 函数支持；为 true 时函数必定先检索再作答） */
  webSearch?: boolean
  /** 由服务端模型自动判断是否检索（agnes-search 函数支持；与 webSearch 二选一，优先级高于 webSearch） */
  autoSearch?: boolean
  /** 仅返回检索结果、不调用生成模型（agnes-search 函数支持；用于实时资讯台） */
  searchOnly?: boolean
  /** 外部中断信号（如用户点击「停止生成」） */
  signal?: AbortSignal
}

/** 一条可点击的参考链接（后端检索时抓取的真实 URL） */
export interface LinkInfo {
  title: string
  url: string
  /** 来源标记：tavily / bing / wiki-zh / gnews / reddit / ddg / tavily-social / bing-social ... */
  source: string
}

/** 函数返回的联网检索元数据（agnes-search 在响应体里附带） */
export interface SearchMeta {
  ok: boolean
  count: number
  sources: string[]
  /** 检索到的真实参考链接（可点击打开 / 复制），可能为空 */
  links?: LinkInfo[]
  /** 针对查询实体的真实题图（维基百科主图），用于报告配图；可能为空 */
  image?: { url: string; title: string } | null
  /** 针对查询实体的真实场景图（维基百科校园/场景图，最多 4 张），用于报告内展示；可能为空 */
  images?: { url: string; title: string }[]
}

/** chat 返回：正文 + 可选的检索元数据 + 可选的纯检索结果（search_only 模式）+ 可选的思考过程 */
export interface ChatResult {
  content: string
  search?: SearchMeta
  results?: string[]
  /** 模型内部推理过程（reasoning_content），已剥离可能的身份泄露词；可能为空 */
  reasoning?: string
}

/** OpenAI 兼容 chat/completions，返回正文与检索元数据。 */
export async function agnesChat(
  messages: ChatMsg[],
  opts: ChatOptions = {}
): Promise<ChatResult> {
  const data = await call('/v1/chat/completions', {
    body: {
      model: opts.model || DEFAULT_MODEL,
      messages,
      max_tokens: Math.min(opts.maxTokens ?? 8192, 8192),
      stream: false,
      web_search: opts.webSearch ?? false,
      auto_search: opts.autoSearch ?? false,
      search_only: opts.searchOnly ?? false
    },
    signal: opts.signal
  })
  const content = (data as any)?.choices?.[0]?.message?.content ?? ''
  const search = (data as any)?.search as SearchMeta | undefined
  const results = (data as any)?.results as string[] | undefined
  const reasoning = (data as any)?.reasoning as string | undefined
  return { content, search, results, reasoning }
}
