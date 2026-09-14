// agnes-proxy — Supabase Edge Function (Deno)
// 转发 chat/completions 到上游 Agnes 平台（agnes-2.0-flash），并支持「流式透传」（用于深度思考实时流出）。
// 图片生成（/v1/images/generations）优先走火山方舟豆包 Seedream，失败回落 Agnes；
// 视频生成（/v1/videos + /agnesapi 轮询）转发到上游 Agnes 平台。
//
// 部署：
//   supabase functions deploy agnes-proxy --project-ref wcnssyiqitugqfmcbdhe
// Secrets（在 Supabase 后台 Functions → agnes-proxy → Add secret）：
//   AGNES_KEY / AGNES_API_KEY   必填，上游 Agnes 平台 key（真实值已配置在 Secret 中，本仓库示例值无效）
//   UPSTREAM_BASE               可选，默认 https://api.agnes-ai.cn/v1
//   SERPER_API_KEY              可选，配置了就用 Serper 做真·搜索；没配则 DuckDuckGo HTML 兜底
//   ARK_API_KEY / ARK_IMAGE_MODEL  可选（推荐），火山方舟图片生成 key + 接入点 ID（ep-xxxx）
//   ARK_IMAGE_BASE              可选，默认 https://ark.cn-beijing.volces.com/api/v3
//   BACKUP_KEY / BACKUP_BASE / BACKUP_MODEL  可选，文本主上游失败时的备用模型（默认智谱 glm-4-flash）
//
// 前端调用：
//   POST {VITE_AGNES_BASE}/v1/chat/completions   → 文本/流式对话
//   POST {VITE_AGNES_BASE}/v1/images/generations → 文生图（同步，~10s，返回图片 URL）
//   POST {VITE_AGNES_BASE}/v1/videos             → 文生视频（异步，返回 video_id）
//   GET  {VITE_AGNES_BASE}/agnesapi?video_id=xxx → 轮询视频生成结果
//   鉴权：Supabase 匿名 key（Authorization: Bearer <anon>）—— 仅用于鉴权「能否调用本函数」

const UPSTREAM_BASE = Deno.env.get('UPSTREAM_BASE') || 'https://api.agnes-ai.cn/v1'
const UPSTREAM_KEY = Deno.env.get('AGNES_KEY') || Deno.env.get('AGNES_API_KEY') || ''
const SERPER_KEY = Deno.env.get('SERPER_API_KEY') || ''

// ─── 备用上游（主上游 Agnes 限流/故障时自动接管）───
// 默认智谱 GLM-4-Flash：免费额度宽松、OpenAI 兼容、CORS 友好。
// key 只存服务端 secret（BACKUP_KEY），前端永不接触。
// 配置（Supabase 后台 Functions → agnes-proxy → Secrets）：
//   BACKUP_KEY    必填，备用平台 API key（配置后才启用备用逻辑；未配置则整条备用链跳过）
//   BACKUP_BASE   可选，默认 https://open.bigmodel.cn/api/paas/v4
//   BACKUP_MODEL  可选，默认 glm-4-flash
const BACKUP_BASE = (Deno.env.get('BACKUP_BASE') || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/+$/, '')
const BACKUP_KEY = Deno.env.get('BACKUP_KEY') || ''
const BACKUP_MODEL = Deno.env.get('BACKUP_MODEL') || 'glm-4-flash'

// ─── 图片生成上游：火山方舟（豆包 Seedream）───
// 用户自带方舟账号，按张计费（约 0.22 元/张），质量明显优于免费档。
// key 只存服务端 secret，前端永不接触；未配置或调用失败时自动回落到 Agnes 图片上游。
// 配置（Supabase 后台 Functions → agnes-proxy → Secrets）：
//   ARK_API_KEY     必填，方舟 API key（ark-xxxx）
//   ARK_IMAGE_MODEL 必填，方舟「接入点」ID（ep-xxxx，非模型名）
//   ARK_IMAGE_BASE  可选，默认 https://ark.cn-beijing.volces.com/api/v3
const ARK_BASE = (Deno.env.get('ARK_IMAGE_BASE') || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, '')
const ARK_KEY = Deno.env.get('ARK_API_KEY') || ''
const ARK_MODEL = Deno.env.get('ARK_IMAGE_MODEL') || ''

// 方舟 Seedream 有「最小像素」硬门槛（实测 3686400，1024² 会被 400 拒绝）。
// 前端传的是 1024x1024（沿用 Agnes 尺寸），这里统一抬到 2048²；已达标的一律原样透传。
const ARK_MIN_PIXELS = 3686400
const ARK_FALLBACK_SIZE = '2048x2048'
function arkSize(size: unknown): string {
  const m = /^(\d+)\s*x\s*(\d+)$/i.exec(String(size ?? '').trim())
  if (!m) return ARK_FALLBACK_SIZE
  const w = Number(m[1])
  const h = Number(m[2])
  if (!w || !h || w * h < ARK_MIN_PIXELS) return ARK_FALLBACK_SIZE
  return `${w}x${h}`
}

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
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

// 带超时的 fetch：Agnes 免费档偶发「请求被路由到卡死实例」——连接不断但长时间无响应，
// 若不设超时，请求会一直挂到上层超时（用户干等 40s+ 才看到降级）。超时后即视为失败，交给备用上游接管。
async function fetchWithTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// 服务端联网搜索：有 Serper key 走 Serper（可靠），否则 DuckDuckGo HTML 兜底（零成本，可能不稳）。
async function search(query: string): Promise<string> {
  try {
    if (SERPER_KEY) {
      const r = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, gl: 'cn', hl: 'zh-cn' })
      })
      const j = await r.json()
      const items = (j.organic || []).slice(0, 5).map((x: any) => `- ${x.title}: ${x.snippet}`).join('\n')
      return items
    }
    // DuckDuckGo HTML 兜底
    const r = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; agnes-proxy/1.0)' }
    })
    const html = await r.text()
    const snippets: string[] = []
    const re = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
    let m: RegExpExecArray | null
    let i = 0
    while ((m = re.exec(html)) !== null && i < 5) {
      const txt = stripHtml(m[1])
      if (txt) snippets.push('- ' + txt)
      i++
    }
    return snippets.join('\n')
  } catch {
    return '' // 搜索失败则优雅降级：不注入上下文，模型按自身知识作答
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(req.url)
  const path = url.pathname

  // ─── 图片生成：/v1/images/generations ───
  if (path.endsWith('/v1/images/generations') && req.method === 'POST') {
    let body: any
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

    // 主：火山方舟（豆包 Seedream）。失败/未配置 → 继续走下面的 Agnes 图片上游。
    if (ARK_KEY && ARK_MODEL) {
      const arkBody: Record<string, any> = {
        model: ARK_MODEL,
        prompt: body.prompt || '',
        size: arkSize(body.size),
        response_format: 'url',
        watermark: false // 配图不要平台水印
      }
      // 图生图：方舟同样用 image 字段（支持公网 URL / base64 data URI）
      if (body.image) arkBody.image = body.image
      try {
        // 冷启动实测可达 60s（热态约 20s），超时必须留够，否则会白花一次生成费
        const r = await fetchWithTimeout(
          `${ARK_BASE}/images/generations`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ARK_KEY}` },
            body: JSON.stringify(arkBody)
          },
          120000
        )
        if (r.ok) {
          const d = await r.json().catch(() => null)
          if (d?.data?.[0]?.url) return json(d, 200)
        }
        // 未成功：静默回落（不把方舟的原始错误抛给前端，用户无感）
      } catch { /* 超时 / 网络异常 → 回落 */ }
    }

    if (!UPSTREAM_KEY) return json({ error: 'UPSTREAM_KEY 未配置且方舟未启用' }, 500)

    const reqBody: Record<string, any> = {
      model: body.model || 'agnes-image-2.1-flash',
      prompt: body.prompt || '',
      n: body.n || 1,
      size: body.size || '1024x1024'
    }
    // 图生图：透传输入图片 + 变化强度
    if (body.image) {
      reqBody.image = body.image
      if (body.strength !== undefined) reqBody.strength = body.strength
    }
    const upstream = await fetch(`${UPSTREAM_BASE}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTREAM_KEY}` },
      body: JSON.stringify(reqBody)
    })
    const data = await upstream.json().catch(() => ({}))
    return json(data, upstream.status)
  }

  // ─── 视频生成（异步提交）：/v1/videos ───
  if (path.endsWith('/v1/videos') && req.method === 'POST') {
    let body: any
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }
    if (!UPSTREAM_KEY) return json({ error: 'UPSTREAM_KEY 未配置' }, 500)

    const reqBody: Record<string, any> = {
      model: body.model || 'agnes-video-v2.0',
      prompt: body.prompt || '',
      height: body.height || 768,
      width: body.width || 1152,
      num_frames: body.num_frames || 121,
      frame_rate: body.frame_rate || 24
    }
    // 图生视频：透传输入图片（作为首帧）
    if (body.image) {
      reqBody.image = body.image
    }
    const upstream = await fetch(`${UPSTREAM_BASE}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTREAM_KEY}` },
      body: JSON.stringify(reqBody)
    })
    const data = await upstream.json().catch(() => ({}))
    return json(data, upstream.status)
  }

  // ─── 视频轮询：/agnesapi?video_id=xxx ───
  if (path.endsWith('/agnesapi') && req.method === 'GET') {
    if (!UPSTREAM_KEY) return json({ error: 'UPSTREAM_KEY 未配置' }, 500)
    const videoId = url.searchParams.get('video_id') || ''
    if (!videoId) return json({ error: 'video_id required' }, 400)

    const upstream = await fetch(`${UPSTREAM_BASE}/agnesapi?video_id=${encodeURIComponent(videoId)}`, {
      headers: { Authorization: `Bearer ${UPSTREAM_KEY}` }
    })
    const data = await upstream.json().catch(() => ({}))
    return json(data, upstream.status)
  }

  // ─── 文本对话：/v1/chat/completions ───
  if (!path.endsWith('/v1/chat/completions') || req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405)
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const model = body.model || 'agnes-2.0-flash'
  const messages: any[] = body.messages || []
  const maxTokens = Math.min(body.max_tokens ?? 4096, 8192)
  const webSearch = !!body.web_search

  const sysMessages = messages.filter((m) => m.role === 'system')
  const otherMessages = messages.filter((m) => m.role !== 'system')

  if (webSearch) {
    const query = lastUserText(otherMessages)
    if (query) {
      const ctx = await search(query)
      if (ctx) {
        sysMessages.push({
          role: 'system',
          content: `以下是联网检索到的相关资料（可能非最新，请批判性使用，并优先相信确切事实）：\n<search>\n${ctx}\n</search>`
        })
      }
    }
  }

  if (!UPSTREAM_KEY) return json({ error: 'UPSTREAM_KEY (DEEPSEEK_KEY) 未配置' }, 500)

  const useStream = !!body.stream
  const chatMessages = [...sysMessages, ...otherMessages]

  let upstream: Response
  // 主上游超时 8s：**必须足够短**。下游 agnes-search 的整条生成预算只有 40s
  // （检索约 8s 后剩 ~32s），预算要同时容纳「等主上游 + 备用生成含 20+ 条检索资料的长 prompt」。
  // 实测 15s 会挤压备用生成 → 频繁 degraded（只有资料没答案）。压到 8s 后备用有 ~24s 完成生成。
  // 代价：Agnes 偶发 >8s 的慢响应会切到备用模型（答案依然完整，仅模型不同）。
  try {
    upstream = await fetchWithTimeout(
      `${UPSTREAM_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTREAM_KEY}` },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          max_tokens: maxTokens,
          stream: useStream
        })
      },
      8000
    )
  } catch {
    upstream = new Response('{"error":"upstream timeout"}', {
      status: 504,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // ─── 备用上游自动接管 ───
  // 主上游（Agnes 免费档）速率配额极小，实测 30s 窗口仅放 1~2 次，对外表现为 429。
  // 命中限流/5xx 时自动切到备用上游（默认智谱 GLM-4-Flash，免费额度宽松）。
  // 关键：备用 key 只存服务端 secret（Deno.env BACKUP_KEY），前端永不接触、不暴露。
  if (!upstream.ok && BACKUP_KEY && (upstream.status === 429 || upstream.status >= 500)) {
    const failStatus = upstream.status
    const failText = await upstream.text().catch(() => '')
    const restoreFail = () =>
      new Response(failText || '{"error":"upstream failed"}', {
        status: failStatus,
        headers: { 'Content-Type': 'application/json' }
      })
    try {
      // 备用上游的 prompt 精简：agnes-search 注入的检索资料可长达 1.5 万字符（20~30 条），
      // 免费模型处理长 prompt 明显更慢，会把下游 agnes-search 的生成预算耗尽 → 用户只能看到降级资料。
      // 这里把注入的 <search> system 段截断，换取更快的备用生成（预算内完成率显著提升）。
      const backupMessages = chatMessages.map((m: any) => {
        if (m?.role === 'system' && typeof m.content === 'string' && m.content.includes('<search>')) {
          const c = m.content
          return {
            ...m,
            content: c.length > 9000 ? c.slice(0, 9000) + '\n（资料过长已截断，请基于以上内容作答）' : c
          }
        }
        return m
      })
      const backupRes = await fetch(`${BACKUP_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BACKUP_KEY}` },
        body: JSON.stringify({
          model: BACKUP_MODEL,
          messages: backupMessages,
          max_tokens: Math.min(maxTokens, 3000),
          stream: useStream,
          temperature: body.temperature ?? 0.7
        })
      })
      // 备用返回 OpenAI 兼容结构（含流式 SSE），与主上游同形，下游 agnes-search / 前端无需改动
      upstream = backupRes.ok ? backupRes : restoreFail()
    } catch {
      // 备用也失败 → 还原主上游的失败响应（下游仍能读到原始错误信息）
      upstream = restoreFail()
    }
  }

  // 流式：直接把上游 SSE 透传给调用方（agnes-search 再转发给前端），实现「思考过程实时流出」
  if (useStream) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        ...CORS
      }
    })
  }

  const data = await upstream.json().catch(() => ({}))
  return json(data, upstream.status)
})
