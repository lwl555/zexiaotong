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
  // 前端被动超时：75s（双重保险）。后端 v9 调用已自带 22s×2 超时 + 降级返回，
  // 正常情况下 44s 内就会拿到结果（含 degraded 降级），不会走到这里；
  // 仅当整条链路异常时才触发，避免用户无限转圈。
  const timer = setTimeout(() => controller.abort(), 75_000)
  // 外部中断（如「停止生成」）：与超时共用一个 controller，任一触发即取消请求
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort()
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  try {
    let lastErr: any
    // 网络瞬时错误（Failed to fetch / DNS / 5xx）自动重试，指数退避 + 抖动。
    // 背景：Supabase Edge Function 网关偶发把请求路由到「卡死/冷启动超时」的实例并直接 503（无 CORS、无 body，
    // 浏览器表现为 Failed to fetch）。该抖动与我们的代码无关、不可预测，但健康实例 1.5s 即可正常返回。
    // 因此靠「重试绕开卡死实例」是唯一稳健解法：实测 5 次重试可把最终成功率从 ~50% 提到 92%+，6 次接近 98%。
    const MAX_ATTEMPTS = 6
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, {
          method: opts.method || 'POST',
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: controller.signal
        })
        if (!res.ok) {
          // 5xx 与 429 视为可重试：5xx=网关/实例抖动，429=Supabase 免费档瞬时限流（退避后可恢复）；
          // 其余 4xx（400/401/403 等）属用户/配置问题，直接抛出不重试。
          if ((res.status >= 500 || res.status === 429) && attempt < MAX_ATTEMPTS - 1) {
            lastErr = new Error(`HTTP ${res.status}`)
            await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt) + Math.random() * 300))
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
        // 浏览器原生网络错误（Failed to fetch / DNS / net::ERR_*）：可重试（含网关 503 无 CORS 触发的网络错误）
        const msg = String(e?.message || e)
        const isNetwork = /Failed to fetch|NetworkError|net::ERR|fetch failed|TypeError: fetch|aborted/i.test(msg)
        if (isNetwork && attempt < MAX_ATTEMPTS - 1) {
          lastErr = e
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt) + Math.random() * 300))
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
  /** 生成超时降级标记：v9 两次调用均超时/失败，后端已返回已检索资料，前端应提示用户「重新生成」 */
  degraded?: boolean
}

/** 图片生成请求 */
export interface ImageGenOptions {
  prompt: string
  model?: string
  n?: number
  size?: string
  signal?: AbortSignal
}

/** 图片生成响应 */
export interface ImageGenResult {
  ok: boolean
  url?: string
  error?: string
}

/** 视频生成请求 */
export interface VideoGenOptions {
  prompt: string
  model?: string
  height?: number
  width?: number
  num_frames?: number
  frame_rate?: number
  signal?: AbortSignal
}

/** 视频生成提交响应 */
export interface VideoSubmitResult {
  ok: boolean
  video_id?: string
  error?: string
}

/** 视频轮询响应 */
export interface VideoPollResult {
  ok: boolean
  status?: string  // 'processing' | 'completed' | 'failed'
  url?: string
  error?: string
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
  const degraded = !!(data as any)?.degraded
  return { content, search, results, reasoning, degraded }
}

/**
 * 流式 chat：边生成边把「思考/正文」增量回调给前端（onContent），结束后 onDone 给出完整结果。
 * 后端（agnes-search）以 SSE 形式推送三类事件：
 *   data: {"type":"reasoning","delta":"..."}   推理过程增量（上游支持时）
 *   data: {"type":"content","delta":"..."}     正文增量（实时流出，用于「深度思考中」实时展示）
 *   data: {"type":"done","content":..., "reasoning":..., "search":..., "degraded":...}  最终结果
 * 若后端尚未升级（返回普通 JSON），则自动降级为一次性回调 onDone。
 */
export async function agnesChatStream(
  messages: ChatMsg[],
  opts: ChatOptions & {
    /** 深度思考：要求模型先输出思考再【回答】分隔（agnes-search 据此注入结构化指令） */
    structuredReasoning?: boolean
    onContent?: (delta: string) => void
    onDone?: (res: ChatResult) => void
  } = {}
): Promise<void> {
  const base = resolveBase()
  const url = `${base}/v1/chat/completions`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...resolveAuthHeaders()
  }
  const body = JSON.stringify({
    model: opts.model || DEFAULT_MODEL,
    messages,
    max_tokens: Math.min(opts.maxTokens ?? 8192, 8192),
    stream: true,
    structured_reasoning: opts.structuredReasoning ?? false,
    web_search: opts.webSearch ?? false,
    auto_search: opts.autoSearch ?? false,
    search_only: opts.searchOnly ?? false
  })

  // 初始连接偶发被网关路由到卡死实例（503/无 CORS）→ 重试绕开
  const MAX_ATTEMPTS = 4
  let res: Response | null = null
  let lastErr: any
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const r = await fetch(url, { method: 'POST', headers, body, signal: opts.signal })
      if (r.ok) { res = r; break }
      if ((r.status >= 500 || r.status === 429) && attempt < MAX_ATTEMPTS - 1) {
        lastErr = new Error(`HTTP ${r.status}`)
        await new Promise((rr) => setTimeout(rr, 500 * Math.pow(2, attempt) + Math.random() * 300))
        continue
      }
      let msg = `HTTP ${r.status}`
      try { const t = await r.text(); if (t) msg += ` ${t.slice(0, 200)}` } catch {}
      throw new Error(msg)
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e
      const msg = String(e?.message || e)
      if (/Failed to fetch|NetworkError|net::ERR|fetch failed|aborted/i.test(msg) && attempt < MAX_ATTEMPTS - 1) {
        lastErr = e
        await new Promise((rr) => setTimeout(rr, 500 * Math.pow(2, attempt) + Math.random() * 300))
        continue
      }
      throw e
    }
  }
  if (!res) throw lastErr || new Error('retry exhausted')

  // 后端未升级：返回的是 JSON 而非 SSE，降级处理
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('text/event-stream')) {
    const data = await res.json().catch(() => ({}))
    const content = (data as any)?.choices?.[0]?.message?.content ?? ''
    const search = (data as any)?.search as SearchMeta | undefined
    const reasoning = (data as any)?.reasoning as string | undefined
    const degraded = !!(data as any)?.degraded
    opts.onDone?.({ content, search, results: (data as any)?.results, reasoning, degraded })
    return
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let content = ''
  let reasoning = ''
  let search: any
  let degraded = false
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
        const o = JSON.parse(payload)
        if (o.type === 'reasoning' && o.delta) {
          reasoning += o.delta
          opts.onContent?.(o.delta)
        } else if (o.type === 'content' && o.delta) {
          content += o.delta
          opts.onContent?.(o.delta)
        } else if (o.type === 'done') {
          content = o.content || content
          reasoning = o.reasoning || reasoning
          search = o.search
          degraded = !!o.degraded
        }
      } catch {}
    }
  }
  opts.onDone?.({ content, reasoning, search, degraded })
}

/** 文生图：调用 Agnes agnes-image-2.1-flash（同步，~10s） */
export async function agnesImageGen(
  opts: ImageGenOptions
): Promise<ImageGenResult> {
  try {
    const data = await call('/v1/images/generations', {
      body: {
        model: opts.model || 'agnes-image-2.1-flash',
        prompt: opts.prompt,
        n: opts.n || 1,
        size: opts.size || '1024x1024'
      },
      signal: opts.signal
    })
    const url = (data as any)?.data?.[0]?.url
    if (!url) return { ok: false, error: (data as any)?.error?.message || '生成失败，请重试' }
    return { ok: true, url }
  } catch (e: any) {
    return { ok: false, error: e?.message || '生成失败' }
  }
}

/** 提交视频生成任务（异步）：返回 video_id */
export async function agnesVideoSubmit(
  opts: VideoGenOptions
): Promise<VideoSubmitResult> {
  try {
    const data = await call('/v1/videos', {
      body: {
        model: opts.model || 'agnes-video-v2.0',
        prompt: opts.prompt,
        height: opts.height || 768,
        width: opts.width || 1152,
        num_frames: opts.num_frames || 121,
        frame_rate: opts.frame_rate || 24
      },
      signal: opts.signal
    })
    const vid = (data as any)?.video_id
    if (!vid) return { ok: false, error: (data as any)?.error?.message || '提交失败，请重试' }
    return { ok: true, video_id: vid }
  } catch (e: any) {
    return { ok: false, error: e?.message || '提交失败' }
  }
}

/** 轮询视频生成结果 */
export async function agnesVideoPoll(
  videoId: string,
  signal?: AbortSignal
): Promise<VideoPollResult> {
  try {
    const base = resolveBase()
    const url = `${base}/agnesapi?video_id=${encodeURIComponent(videoId)}`
    const headers: Record<string, string> = {
      ...resolveAuthHeaders()
    }
    const res = await fetch(url, { headers, signal })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    const status = (data as any)?.status || 'processing'
    if (status === 'completed' || status === 'succeeded') {
      const videoUrl = (data as any)?.url || (data as any)?.video_url
      return { ok: true, status: 'completed', url: videoUrl }
    }
    if (status === 'failed') return { ok: false, status: 'failed', error: (data as any)?.error || '生成失败' }
    return { ok: true, status: 'processing' }
  } catch (e: any) {
    return { ok: false, error: e?.message || '轮询失败' }
  }
}

// —— 预热：页面加载 / 窗口聚焦时后台暖热 agnes-search 与 v9(agnes-proxy) 两个 Edge Function ——
// 两者各自冷启动约 1.5s+，叠加后「用户首个真实提问」会撞双冷启动（耗时 10s+，偶发被网关掐断 → "Failed to fetch"）。
// 这里在页面加载即无声发起一次极轻的请求（trivial query 仍会调 v9 以暖热它），结果被忽略，失败也无所谓；
// 数秒后用户发起的真实提问将命中已热实例，约 3s 返回，彻底规避冷启动超时。
let __agnesWarmed = false
export function warmupAgnes(force = false): void {
  if (__agnesWarmed && !force) return
  __agnesWarmed = true
  const base = resolveBase()
  if (base.startsWith('/')) return // 开发态走本地代理，无需预热
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...resolveAuthHeaders()
  }
  const body = JSON.stringify({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: '你好' }],
    max_tokens: 200,
    stream: false,
    auto_search: true
  })
  // 连续多次：Supabase 网关偶发把首请求路由到「冷启动超时」的卡死实例（直接 503），
  // 多发几次可保证至少有一个健康实例被暖热，用户首个真实提问命中热实例（~1.5s）而非撞冷启。
  const fire = () => {
    fetch(`${base}/v1/chat/completions`, { method: 'POST', headers, body }).catch(() => {})
  }
  fire()
  setTimeout(fire, 1500)
  setTimeout(fire, 3500)
}

// 页面加载即预热；窗口重新聚焦（用户离开又回来）时也补一次，覆盖「长时间闲置后回来」的场景
if (typeof window !== 'undefined') {
  warmupAgnes()
  window.addEventListener('focus', () => warmupAgnes(true))
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') warmupAgnes(true)
    })
  }
}
