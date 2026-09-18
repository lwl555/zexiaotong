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

// —— 上游限流(429)冷却机制 ——
// Agnes 免费档速率配额极小：实测同一窗口内 6s 间隔的第二发必 429，而静默等 ~30s 后探测即恢复 200。
// 所以撞限流后不立刻失败，而是「等满一个窗口再自动重试」——比让用户看到「限流，请重新生成」体验好得多。
// 冷却时间戳全模块共享：用户手动点「重新生成」时若仍在冷却期内，也会先等满窗口再发（否则必再撞 429）。
const RATE_LIMIT_COOLDOWN_MS = 26000
let __rateLimitedUntil = 0
async function waitRateLimitWindow(): Promise<void> {
  const wait = __rateLimitedUntil - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}
function markRateLimited(): void {
  __rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS
}

async function call<T = any>(
  path: string,
  opts: { method?: string; body?: any; signal?: AbortSignal; skipCooldown?: boolean; timeoutMs?: number }
): Promise<T> {
  const base = resolveBase()
  const url = `${base}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...resolveAuthHeaders()
  }
  const controller = new AbortController()
  // 前端被动超时：默认 75s（双重保险）。后端 v9 调用已自带 22s×2 超时 + 降级返回，
  // 正常情况下 44s 内就会拿到结果（含 degraded 降级），不会走到这里；
  // 仅当整条链路异常时才触发，避免用户无限转圈。
  // 图片生成单独放宽（timeoutMs）：方舟 Seedream 2K 图热态 ~20s、冷启动实测可达 60s。
  // 普通 chat：主链路智谱 GLM（3–19s）+ Agnes 兜底（40s 预算），极端情况合计可能接近 60s，默认给到 100s 防误杀
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 100_000)
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
        // 若刚撞过限流、仍在冷却窗口内（典型：用户立刻点「重新生成」），先等满窗口再发，避免必撞 429。
        // skipCooldown：备用通道取检索资料（search_only，不消耗生成配额）时跳过等待，避免白等 26s。
        if (!opts.skipCooldown) await waitRateLimitWindow()
        const res = await fetch(url, {
          method: opts.method || 'POST',
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: controller.signal
        })
        if (!res.ok) {
          const t = await res.text().catch(() => '')
          // 429（上游免费额度限流）单独处理：把响应体挂到错误上供上层降级（429 body 里带已检索到的 search 资料），
          // 并进入冷却重试——等满一个窗口再发一次（实测 30s 后恢复），只给一次机会，仍失败则交上层展示资料。
          if (res.status === 429) {
            const e: any = new Error(`HTTP 429 ${t.slice(0, 200)}`)
            try { e.payload = JSON.parse(t) } catch {}
            lastErr = e
            markRateLimited()
            // 已配置备用通道时：不原地等窗口（上层会立即切备用出答案，远好于干等 26s）
            if (!hasBackupChannel() && attempt < 1) {
              await waitRateLimitWindow()
              continue
            }
            throw e
          }
          if (res.status >= 500 && attempt < MAX_ATTEMPTS - 1) {
            lastErr = new Error(`HTTP ${res.status}`)
            await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt) + Math.random() * 300))
            continue
          }
          throw new Error(`HTTP ${res.status} ${t.slice(0, 300)}`)
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
  /** 图生图：输入图片 URL 或 base64 data URI */
  image?: string
  /** 图生图：变化强度 0-1，越高变化越大 */
  strength?: number
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
  /** 图生视频：输入图片 URL 或 base64 data URI */
  image?: string
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

// ===== 备用 AI 通道（Agnes 限流时自动兜底）=====
// 背景：Agnes 免费档速率配额极小（实测 30s 窗口仅放 1~2 次生成），主通道撞限流时用户只能干等或看降级提示。
// 备用通道 = 任意 OpenAI 兼容平台（推荐免费额度宽松的国产模型，如智谱 GLM-4-Flash，注册免费、不绑卡）。
// 配置来源（二选一；两者都未配置时整条备用链完全跳过，行为与之前完全一致）：
//   ① 运行时（免重新部署）：localStorage['zex:ai_backup'] = {"base":"https://open.bigmodel.cn/api/paas/v4","key":"xxx","model":"glm-4-flash"}
//   ② 构建注入：VITE_AI_BACKUP_BASE / VITE_AI_BACKUP_KEY / VITE_AI_BACKUP_MODEL
interface BackupCfg { base: string; key: string; model: string }
function resolveBackup(): BackupCfg | null {
  const norm = (b: string) => b.trim().replace(/\/+$/, '')
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('zex:ai_backup') : null
    if (raw) {
      const o = JSON.parse(raw)
      if (o?.base && o?.key) {
        return { base: norm(String(o.base)), key: String(o.key), model: String(o.model || 'glm-4-flash') }
      }
    }
  } catch {}
  const env = (import.meta as any).env || {}
  if (env.VITE_AI_BACKUP_BASE && env.VITE_AI_BACKUP_KEY) {
    return {
      base: norm(String(env.VITE_AI_BACKUP_BASE)),
      key: String(env.VITE_AI_BACKUP_KEY),
      model: String(env.VITE_AI_BACKUP_MODEL || 'glm-4-flash')
    }
  }
  return null
}
export function hasBackupChannel(): boolean { return !!resolveBackup() }

/** 备用通道纯生成（OpenAI 兼容，非流式） */
async function backupChat(messages: ChatMsg[], maxTokens: number): Promise<string> {
  const cfg = resolveBackup()
  if (!cfg) throw new Error('no backup channel')
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      max_tokens: Math.min(maxTokens, 8192),
      stream: false,
      temperature: 0.7
    })
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`backup HTTP ${res.status} ${t.slice(0, 150)}`)
  }
  const data = await res.json().catch(() => ({}))
  return (data as any)?.choices?.[0]?.message?.content ?? ''
}

/**
 * 主通道不可用时走备用通道出答案。
 * 关键：联网检索是 agnes-search 的「免 key 自爬」层、**不消耗生成配额**——
 * 所以这里先用 search_only 模式把资料取回来（零配额），再把「资料 + 问题」交给备用模型生成，
 * 备用通道同样保持「联网作答」体验，而不是退化成纯记忆回答。
 */
async function tryBackupGeneration(
  messages: ChatMsg[],
  opts: ChatOptions,
  needSearch: boolean
): Promise<ChatResult | null> {
  if (!hasBackupChannel()) return null
  let results: string[] = []
  if (needSearch) {
    try {
      const sr: any = await call('/v1/chat/completions', {
        body: {
          model: opts.model || DEFAULT_MODEL,
          messages,
          max_tokens: 16,
          stream: false,
          web_search: false,
          auto_search: opts.autoSearch ?? false,
          search_only: true
        },
        skipCooldown: true
      })
      results = (sr?.results || []) as string[]
    } catch { /* 检索失败也继续：备用模型按自身知识作答 */ }
  }
  const msgs: ChatMsg[] = results.length
    ? [
        {
          role: 'system',
          content:
            `以下是针对用户问题联网检索到的公开资料（可能非最新，请批判性采用，优先采信可交叉验证的事实）：\n` +
            `<search>\n${results.slice(0, 30).join('\n')}\n</search>\n` +
            `要求：优先依据上述资料作答；资料未覆盖处严禁编造具体事实（尤其学校类型 / 分数线 / 就业率 / 学费等），不确定就直说暂无法确认。`
        },
        ...messages
      ]
    : messages
  try {
    const content = await backupChat(msgs, opts.maxTokens ?? 3000)
    if (!content?.trim()) return null
    return { content, degraded: false }
  } catch {
    return null
  }
}

/** OpenAI 兼容 chat/completions，返回正文与检索元数据。 */
export async function agnesChat(
  messages: ChatMsg[],
  opts: ChatOptions = {}
): Promise<ChatResult> {
  let data: any
  try {
    data = await call('/v1/chat/completions', {
      body: {
        model: opts.model || DEFAULT_MODEL,
        messages,
        max_tokens: Math.min(opts.maxTokens ?? 8192, 8192),
        stream: false,
        // 检索层全为免 key 自爬源（Bing/百度/DDG/GNews/HN/维基），零 Agnes 额度消耗；
        // 只有生成那一跳消耗 Agnes 额度。恢复透传，由 agnes-search 编排检索+生成。
        web_search: opts.webSearch ?? false,
        auto_search: opts.autoSearch ?? false,
        search_only: opts.searchOnly ?? false
      },
      signal: opts.signal
    })
  } catch (e: any) {
    const payload = e?.payload
    const s = payload?.search
    // ① 主通道限流/失败 → 先试备用通道（若已配置）：以 search_only 零配额取回资料，交给备用模型生成完整回答
    const backupRes = await tryBackupGeneration(messages, opts, !!(opts.autoSearch || opts.webSearch))
    if (backupRes) return backupRes
    // ② 无备用通道：降级为「展示已检索资料 + 提示重新生成」，而非裸报错
    if (s && ((s.count || 0) > 0 || (s.links || []).length)) {
      const links: LinkInfo[] = s.links || []
      const list = links.length
        ? links.slice(0, 5).map((l, i) => `${i + 1}. ${l.title} — ${l.url}`).join('\n')
        : (s.sources || []).slice(0, 5).map((x: string, i: number) => `${i + 1}. ${x}`).join('\n')
      return {
        content:
          `⏱️ **AI 生成暂时被上游限流**，但已为你检索到 ${s.count || 0} 条公开资料，先参考下方内容；点「重新生成」可再试一次。\n\n` +
          `> 关于「${String(s.query || '').slice(0, 80)}」的参考资料：\n${list}`,
        search: s,
        degraded: true
      }
    }
    throw e
  }
  const content = (data as any)?.choices?.[0]?.message?.content ?? ''
  const search = (data as any)?.search as SearchMeta | undefined
  const results = (data as any)?.results as string[] | undefined
  const reasoning = (data as any)?.reasoning as string | undefined
  const degraded = !!(data as any)?.degraded
  // 服务端降级（生成被上游限流）→ 有备用通道时用它把完整答案补出来
  if (degraded && hasBackupChannel()) {
    const backupRes = await tryBackupGeneration(messages, opts, !!(opts.autoSearch || opts.webSearch))
    if (backupRes) return { ...backupRes, search }
  }
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
    // 检索层全为免 key 自爬源，零 Agnes 额度消耗。恢复透传，由 agnes-search 编排检索+生成。
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
      // 有备用通道时不等待冷却：直接发；若仍 429 就立刻切备用出答案
      if (!hasBackupChannel()) await waitRateLimitWindow()
      const r = await fetch(url, { method: 'POST', headers, body, signal: opts.signal })
      if (r.ok) { res = r; break }
      // 429 限流：等满一个窗口重试一次（实测撞限流后 ~30s 恢复）；
      // 已配置备用通道时不再干等，直接抛出交给备用通道出答案
      if (r.status === 429) {
        markRateLimited()
        lastErr = new Error('HTTP 429')
        if (!hasBackupChannel() && attempt < 1) { await waitRateLimitWindow(); continue }
        throw lastErr
      }
      if (r.status >= 500 && attempt < MAX_ATTEMPTS - 1) {
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
  if (!res) {
    // 主通道不可用（限流/网关异常）→ 试备用通道出答案（非流式，一次性回调给页面）
    const backupRes = await tryBackupGeneration(messages, opts, !!(opts.autoSearch || opts.webSearch))
    if (backupRes) { opts.onDone?.(backupRes); return }
    throw lastErr || new Error('retry exhausted')
  }

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
        } else if (o.choices?.[0]?.delta) {
          // OpenAI 标准流式格式（agnes-proxy 返回的是这种）：choices[0].delta.content / reasoning_content
          const d = o.choices[0].delta
          if (d.reasoning_content) {
            reasoning += d.reasoning_content
            opts.onContent?.(d.reasoning_content)
          }
          if (d.content) {
            content += d.content
            opts.onContent?.(d.content)
          }
        }
      } catch {}
    }
  }
  // 服务端已降级（生成被上游限流，内容里只有检索资料提示）→ 有备用通道时用它把完整答案补出来，用户几乎无感
  if (degraded && hasBackupChannel()) {
    const backupRes = await tryBackupGeneration(messages, opts, !!(opts.autoSearch || opts.webSearch))
    if (backupRes) { opts.onDone?.({ ...backupRes, search }); return }
  }
  opts.onDone?.({ content, reasoning, search, degraded })
}

/** 文生图：走 agnes-proxy 的图片路由（服务端优先火山方舟豆包 Seedream，失败回落 Agnes）。
 *  2K 同步出图，热态 ~20s、冷启动可达 60s，故单独放宽超时。 */
export async function agnesImageGen(
  opts: ImageGenOptions
): Promise<ImageGenResult> {
  try {
    const body: Record<string, any> = {
      model: opts.model || 'agnes-image-2.1-flash',
      prompt: opts.prompt,
      n: opts.n || 1,
      size: opts.size || '1024x1024'
    }
    // 图生图：传递 image + strength
    if (opts.image) {
      body.image = opts.image
      if (opts.strength !== undefined) body.strength = opts.strength
    }
    const data = await call('/v1/images/generations', {
      body,
      signal: opts.signal,
      // 图片走方舟 Seedream（2K），冷启动可达 60s+，超时给到 120s，避免把已经付过费的生成掐掉
      timeoutMs: 120000
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
    const body: Record<string, any> = {
      model: opts.model || 'agnes-video-v2.0',
      prompt: opts.prompt,
      height: opts.height || 768,
      width: opts.width || 1152,
      num_frames: opts.num_frames || 121,
      frame_rate: opts.frame_rate || 24
    }
    // 图生视频：传递 image
    if (opts.image) {
      body.image = opts.image
    }
    const data = await call('/v1/videos', {
      body,
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

// —— 预热（已停用自动调用）——
// 🔴 额度纪律（2026-09-14 实测定论）：Agnes 免费档生成配额极小——30s 窗口仅放 1~2 次请求
// （6s 内连发第二发必 429；静默等 ~30s 探测即恢复 200）。预热本身就会吃掉一次配额，
// 导致用户紧接着的首个真实提问必撞 429（然后要等 26s 冷却 + 重试）。
// 省下这次配额远比省 ~1.5s 冷启动重要；冷启动慢 / 网关 503 由 call() 的 6 次重试兜底。
// 函数保留（以备将来上游配额放宽时手动启用），但不再自动触发。
let __agnesWarmed = false
export function warmupAgnes(force = false): void {
  if (__agnesWarmed) return
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
    max_tokens: 16,
    stream: false,
    auto_search: false
  })
  fetch(`${base}/v1/chat/completions`, { method: 'POST', headers, body }).catch(() => {})
}

// 自动预热已停用（见上方说明）：不要再打开，否则会与用户提问抢配额。
// if (typeof window !== 'undefined') warmupAgnes()
