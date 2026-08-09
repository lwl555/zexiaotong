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
    const res = await fetch(url, {
      method: opts.method || 'POST',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal
    })
    if (!res.ok) {
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
  /** 开启服务端联网搜索（agnes-search 函数支持；为 true 时函数会先检索再作答） */
  webSearch?: boolean
  /** 外部中断信号（如用户点击「停止生成」） */
  signal?: AbortSignal
}

/** 函数返回的联网检索元数据（agnes-search 在响应体里附带） */
export interface SearchMeta {
  ok: boolean
  count: number
  sources: string[]
  /** 针对查询实体的真实题图（维基百科），用于报告配图；可能为空 */
  image?: { url: string; title: string } | null
}

/** chat 返回：正文 + 可选的检索元数据 */
export interface ChatResult {
  content: string
  search?: SearchMeta
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
      max_tokens: Math.min(opts.maxTokens ?? 8000, 9000),
      stream: false,
      web_search: opts.webSearch ?? false
    },
    signal: opts.signal
  })
  const content = (data as any)?.choices?.[0]?.message?.content ?? ''
  const search = (data as any)?.search as SearchMeta | undefined
  return { content, search }
}
