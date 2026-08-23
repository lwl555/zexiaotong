// agnes-proxy — Supabase Edge Function (Deno)
// 转发 chat/completions 到上游 Agnes 平台（agnes-2.0-flash），并支持「流式透传」（用于深度思考实时流出）。
// 同时转发图片生成（/v1/images/generations）和视频生成（/v1/videos + /agnesapi 轮询）到上游 Agnes 平台。
//
// 部署：
//   supabase functions deploy agnes-proxy --project-ref wcnssyiqitugqfmcbdhe
// Secrets（在 Supabase 后台 Functions → agnes-proxy → Add secret）：
//   AGNES_KEY / AGNES_API_KEY   必填，上游 Agnes 平台 key（真实值已配置在 Secret 中，本仓库示例值无效）
//   UPSTREAM_BASE               可选，默认 https://api.agnes-ai.cn/v1
//   SERPER_API_KEY              可选，配置了就用 Serper 做真·搜索；没配则 DuckDuckGo HTML 兜底
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
    if (!UPSTREAM_KEY) return json({ error: 'UPSTREAM_KEY 未配置' }, 500)

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

  const upstream = await fetch(`${UPSTREAM_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTREAM_KEY}` },
    body: JSON.stringify({
      model,
      messages: [...sysMessages, ...otherMessages],
      max_tokens: maxTokens,
      stream: useStream
    })
  })

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
