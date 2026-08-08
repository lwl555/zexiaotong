// agnes-proxy — Supabase Edge Function (Deno)
// 转发 chat/completions 到上游模型（默认 DeepSeek），并支持「服务端联网搜索」。
//
// 部署：
//   supabase functions deploy agnes-proxy --project-ref wcnssyiqitugqfmcbdhe
// Secrets（在 Supabase 后台 Functions → agnes-proxy → Add secret）：
//   DEEPSEEK_KEY   必填，上游模型 key
//   UPSTREAM_BASE  可选，默认 https://api.deepseek.com
//   SERPER_API_KEY 可选，配置了就用 Serper 做真·搜索；没配则 DuckDuckGo HTML 兜底
//
// 前端调用：POST {VITE_AGNES_BASE}/v1/chat/completions
//   请求体：{ model, messages, max_tokens, web_search? }
//   鉴权：Supabase 匿名 key（Authorization: Bearer <anon>）—— 仅用于鉴权「能否调用本函数」

const UPSTREAM_BASE = Deno.env.get('UPSTREAM_BASE') || 'https://api.deepseek.com'
const UPSTREAM_KEY = Deno.env.get('DEEPSEEK_KEY') || ''
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
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const model = body.model || 'deepseek-v4-flash'
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

  const upstream = await fetch(`${UPSTREAM_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTREAM_KEY}` },
    body: JSON.stringify({
      model,
      messages: [...sysMessages, ...otherMessages],
      max_tokens: maxTokens,
      stream: false
    })
  })

  const data = await upstream.json().catch(() => ({}))
  return json(data, upstream.status)
})
