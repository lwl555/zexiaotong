// community-bots — Supabase Edge Function (Deno)
// 社区智能体：20 个不同人设，自动生成「拟真帖子」（文字 + 配图）发布到校园社区。
//
// 调用：POST /functions/v1/community-bots
//   body: { count?: number }                  默认 post 模式：自动生成帖子
//   body: { mode: 'interact', count?: number } 互动模式：自动给最近帖子/小黑板留言 + 点赞
//   需带 Supabase anon key（Authorization: Bearer <anon>）。
// 安全：发文内置限频——默认 30 分钟内最多产出 4 条，防止被刷爆上游配额；
//       互动模式纯文本生成、无配图，墙钟远低于免费档上限，可叠加到发文计划之外由独立 cron 调度。
//
// Secrets：
//   图片生成两家，主用火山方舟、失败自动回落智谱：
//     ARK_API_KEY / ARK_IMAGE_MODEL   火山方舟 key + 接入点 ID（ep-xxxx，按张计费）
//     ARK_IMAGE_BASE                  可选，默认 https://ark.cn-beijing.volces.com/api/v3
//     BACKUP_KEY（或 IMAGE_API_KEY）  智谱 key，免费兜底（cogview-3-flash）
//   文字生成复用 agnes-proxy（其内部已含 Agnes → 智谱 的自动切换，本函数无需再管）
//
// 部署： supabase functions deploy community-bots --project-ref wcnssyiqitugqfmcbdhe

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CHAT_URL = `${SUPABASE_URL}/functions/v1/agnes-proxy/v1/chat/completions`

// 主：火山方舟（豆包 Seedream）
const ARK_BASE = (Deno.env.get('ARK_IMAGE_BASE') || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, '')
const ARK_KEY = Deno.env.get('ARK_API_KEY') || ''
const ARK_MODEL = Deno.env.get('ARK_IMAGE_MODEL') || ''
// 方舟 Seedream 有「最小像素」硬门槛（实测 3686400），低于门槛会被 400 拒绝
const ARK_MIN_PIXELS = 3686400
const ARK_SIZE = '2048x2048'

// 备：智谱 cogview-3-flash（免费，画质弱一档，仅在方舟失败时兜底）
const IMG_KEY = Deno.env.get('IMAGE_API_KEY') || Deno.env.get('BACKUP_KEY') || ''
const IMG_BASE = (Deno.env.get('IMAGE_API_BASE') || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/+$/, '')
const IMG_MODEL = Deno.env.get('IMAGE_MODEL') || 'cogview-3-flash'

const BUCKET = 'community'

// 限频：窗口内最多产出条数（防被恶意刷爆上游配额）
const COOLDOWN_MIN = 30
const MAX_PER_COOLDOWN = 4
// 单次调用上限。免费档墙钟约 150s，预算 = 并发文案(~30s) + 方舟配图(超时 75s)
// + 智谱兜底(超时 25s)，故一批最多 3 条；更大的量靠调度频率解决（cron 每天 8 批）。
const MAX_PER_CALL = 3

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  })
}

const enc = (s: string) => encodeURIComponent(String(s))

async function pgGet(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` }
  })
  const t = await r.text()
  try { return t ? JSON.parse(t) : [] } catch { return [] }
}

async function pgInsert(table: string, row: unknown) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(row)
  })
  const t = await r.text()
  let data: any = null
  try { data = t ? JSON.parse(t) : null } catch { data = t }
  return { ok: r.ok, data }
}

// 计数器 +1（评论数 / 点赞数等）
async function pgInc(table: string, id: string, col: string) {
  const r = await pgGet(`${table}?select=${col}&id=eq.${enc(id)}`)
  const cur = Array.isArray(r) && r[0] ? Number(r[0][col]) : 0
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${enc(id)}`, {
    method: 'PATCH',
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ [col]: cur + 1 })
  })
}

// 运行日志：记录智能体在平台中的动作（与 db-write 的 logActivity 同语义）
async function logActivity(actor_type: string, actor_id: string, actor_name: string, action: string, target_type = '', target_id = '', detail = '') {
  await pgInsert('activity_logs', { actor_type, actor_id, actor_name, action, target_type, target_id, detail })
}

// 自动评论：给定一个智能体人设，为某条内容生成 1~3 句自然回帖（纯文本，不配图）。
async function draftComment(botName: string, bot: Bot, targetText: string): Promise<string | null> {
  const sys =
    `你是「${botName}」，${bot.tag}（这只是你评论的视角，正文里**不要自报身份**）。\n` +
    `性格与文风：${bot.style}。擅长：${bot.topics.join('、')}。\n` +
    `你要在一条社区帖子下留评论（像真实用户回帖，不是写文章）：\n` +
    `- 1~3 句话，口语化、自然，可认同 / 补充 / 提问 / 讲一点自己的小经历；\n` +
    `- 别端着、别用「首先其次」模板、别出现"作为AI""我是模型"；\n` +
    `- 不要 markdown、不要引号包裹、不要刷表情；\n` +
    `- 直接输出评论正文（不超过 80 字，不要任何前后说明）。\n\n` +
    `原帖内容（仅供参考，不要复述）：\n${targetText.slice(0, 360)}`
  try {
    const r = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: '请就上面的帖子留一条你的真实评论。' }
        ],
        max_tokens: 300,
        stream: false
      })
    })
    if (!r.ok) return null
    const d = await r.json().catch(() => null)
    let text = d?.choices?.[0]?.message?.content || ''
    if (!text) return null
    text = text.replace(/```|"|「|」|“|”/g, '').trim()
    if (text.length < 2 || text.length > 200) return null
    return text
  } catch {
    return null
  }
}

// 自动互动模式：挑最近内容，让智能体以不同人设留言 + 顺手点赞，制造「随处都有活人」的氛围。
// 纯文本生成（无配图），3 条并发文案约 20~30s，远低于免费档 150s 墙钟，可安全叠加到发文计划之外。
async function handleInteract(want: number) {
  const profiles = await pgGet(`profiles?select=id,nickname,avatar&phone=like.bot*`)
  const pMap: Record<string, any> = {}
  for (const p of Array.isArray(profiles) ? profiles : []) pMap[p.id] = p
  const botPool = BOTS.filter((b) => pMap[b.id])
  if (!botPool.length) return json({ ok: true, skipped: true, reason: '无可用 bot 账号', comments: [] })

  // 后端限频：30 分钟内 bot 互动次数达上限则跳过，防前端频繁刷新刷爆评论（与发文限频同窗口/同上限）
  const sinceIso = new Date(Date.now() - COOLDOWN_MIN * 60 * 1000).toISOString()
  const recentLogs = await pgGet(`activity_logs?select=id&actor_type=eq.bot&action=eq.comment&created_at=gte.${sinceIso}`)
  const recentCount = Array.isArray(recentLogs) ? recentLogs.length : 0
  if (recentCount >= MAX_PER_COOLDOWN) {
    return json({ ok: true, skipped: true, reason: `限频：${COOLDOWN_MIN} 分钟内 bot 已互动 ${recentCount} 次`, comments: [] })
  }

  const posts = await pgGet(`posts?select=id,author_id,title,content,comments&order=created_at.desc&limit=40`)
  const bullets = await pgGet(`bulletins?select=id,author_id,content,comments&order=created_at.desc&limit=20`)
  const targets: { type: string; id: string; author_id: string; text: string }[] = []
  for (const p of Array.isArray(posts) ? posts : []) targets.push({ type: 'post', id: p.id, author_id: p.author_id, text: `${p.title || ''} ${p.content || ''}` })
  for (const b of Array.isArray(bullets) ? bullets : []) targets.push({ type: 'bulletin', id: b.id, author_id: b.author_id, text: b.content || '' })
  if (!targets.length) return json({ ok: true, skipped: true, reason: '暂无可互动内容', comments: [] })

  // 偏向评论少的目标，避免对已成热帖反复叠加
  targets.sort((a, b) => (Number(a.comments) || 0) - (Number(b.comments) || 0))
  const pool = targets.slice(0, Math.min(targets.length, 14)).sort(() => Math.random() - 0.5).slice(0, want)

  const comments = await Promise.all(pool.map(async (tgt) => {
    const cands = botPool.filter((b) => b.id !== tgt.author_id)
    const bot = cands[Math.floor(Math.random() * cands.length)] || botPool[0]
    const prof = pMap[bot.id]
    if (!prof) return null
    const botName = prof.nickname || '社区网友'
    const comment = await draftComment(botName, bot, tgt.text)
    if (!comment) return null
    const ins = await pgInsert('comments', {
      id: crypto.randomUUID(),
      target_type: tgt.type,
      target_id: tgt.id,
      author_id: bot.id,
      author_name: botName,
      author_avatar: prof.avatar || '',
      content: comment
    })
    if (!ins.ok) return { ok: false, err: String(ins.data) }
    await pgInc(tgt.type, tgt.id, 'comments')
    await logActivity('bot', bot.id, botName, 'comment', tgt.type, tgt.id, comment.slice(0, 60))
    return { target: tgt.type, author: botName, content: comment.slice(0, 40) }
  }))

  const made = comments.filter(Boolean)
  // 顺手给前两个目标点赞，更像真人
  for (const tgt of pool.slice(0, Math.min(2, pool.length))) {
    await pgInc(tgt.type, tgt.id, 'likes')
  }
  return json({ ok: true, mode: 'interact', comments: made })
}

// 每个智能体的「人设」——昵称/头像来自 profiles（本函数只带 id 与人设描述）
interface Bot {
  id: string
  tag: string
  style: string
  topics: string[]
}

const BOTS: Bot[] = [
  { id: '144d36a6-7a96-5b9d-a9fb-414eedbacdc9', tag: '一线教师', style: '带过 8 届高三，说话直接、爱举真实案例，会给家长泼冷水但讲道理', topics: ['志愿填报', '模考定位', '高三心态', '家长沟通'] },
  { id: 'b5171a61-5c00-5250-87f5-0fd0ac468f85', tag: '复读生', style: '先讲自己踩过的坑，语气自嘲但不丧，讨厌鸡汤', topics: ['复读取舍', '提分方法', '心态崩了怎么办'] },
  { id: '3ea46063-e876-541c-9b57-782094907d00', tag: '医学生', style: '讲实话，会说学医的苦，也会说值得的地方', topics: ['医学专业', '规培', '学医劝退与坚持'] },
  { id: 'b0aae5d1-edeb-5d33-9442-fefdb882efcc', tag: '护理', style: '实习日常流水账式分享，细节多、接地气', topics: ['护理就业', '实习', '考编制'] },
  { id: '5e5a2c26-62bd-5337-922e-4678820ffcf5', tag: '程序员', style: '技术干货+简历细节，喜欢拆解具体做法', topics: ['秋招', '简历', '技术栈', '面试复盘'] },
  { id: '63445811-d586-5ec6-9db3-de96f82b4677', tag: '家长', style: '站在家长角度，关心钱和孩子的情绪', topics: ['陪考', '志愿', '培训花钱避坑'] },
  { id: 'e8061e58-9f03-5f0b-9804-3ab3a1c1a781', tag: '职校教师', style: '讲中职/职校的真实出路，反对唯学历论但也不吹', topics: ['中职', '五年制', '技能就业'] },
  { id: '2b79d055-d17f-5fdc-9e64-cca94a0801af', tag: '专升本', style: '时间线清晰，讲自己怎么安排的', topics: ['专升本', '自考', '学历提升'] },
  { id: '272a04a7-9594-5f2b-a355-e6c6fce967d5', tag: 'HR', style: '从筛简历的一侧说话，直说哪些写法会被刷', topics: ['面试', '简历筛选', '校招内幕'] },
  { id: '109ab7b4-9634-5d72-b6ea-fc58a25fa381', tag: '考研', style: '择校和专业课讲得细，会算性价比', topics: ['择校', '专业课', '调剂'] },
  { id: 'f8cede02-50dd-58a5-959b-9d38e0a9bd6d', tag: '师范生', style: '备考节奏+心态，偶尔吐槽', topics: ['教资', '考编', '公费师范'] },
  { id: 'a52a2ad7-7934-5fe9-a215-428d04e4fa0b', tag: '艺考生', style: '讲集训和文化课两头烧的真实感受', topics: ['艺考', '文化课', '美院'] },
  { id: '72deba4c-8ee3-5379-93ea-e5c480d82ee4', tag: '军校', style: '纪律性强，回答偏务实', topics: ['军校', '国防生', '体检政审'] },
  { id: '7ed9e2f6-379e-564e-a1bc-20a10e44f950', tag: '财经', style: '讲考证和实习的真实含金量', topics: ['金融', '会计', '证书', '实习'] },
  { id: 'eff8bcb8-c8ec-55cb-a8af-42b3e4406001', tag: '高职', style: '技能大赛经历多，讲实操', topics: ['高职', '技能大赛', '就业'] },
  { id: '9b0f122c-0f17-5e81-83c6-c5763dffc9f1', tag: '医生', style: '上班族口吻，讲排班和心态', topics: ['规培', '医患', '职业规划'] },
  { id: '3c0e63c8-2242-5efb-8716-3ea441698de9', tag: '志愿规划', style: '讲分数位次和冲稳保，用数据说话', topics: ['分数线', '位次', '冲稳保'] },
  { id: 'ed9c340a-ff5b-5214-bcad-8170dda57654', tag: '高中生', style: '讲资源差距和自己的自学办法', topics: ['县城教育', '自学', '资源差距'] },
  { id: '4764d1b3-b77c-56af-9609-d396442737ee', tag: '转行', style: '转行路径讲得具体，会说自己后悔的地方', topics: ['转行', '自学编程', '职业选择'] },
  { id: '284ec5d9-43b4-5777-bcec-1f04a3249df7', tag: '打工人', style: '讲挣钱的真实感受，不卖惨也不炫耀', topics: ['攒钱', '兼职', '生活费'] }
]

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// 调 agnes-proxy 生成帖子草稿（agnes-proxy 内部自带主/备上游切换）
async function draftPost(botName: string, bot: Bot, profile: any): Promise<{ title: string; content: string; needImage: boolean; imagePrompt: string } | null> {
  const topic = pick(bot.topics)
  const sys =
    `你是「${botName}」，${bot.tag}（这只是你发帖的视角，正文里**不要自报身份**、不要写"我是XX"）。\n` +
    `文风与性格：${bot.style}。擅长话题：${bot.topics.join('、')}。\n` +
    `现在你要在一个「择校 / 求职 / 搞钱」主题的社区里发一条帖子（就是真人发帖，不是写文章）：\n` +
    `- 语气自然口语化，可以带个人经历、具体数字、吐槽或提醒；别端着、别说教、别用「首先其次最后」这种模板；\n` +
    `- **内容要实在、有信息量**：正文 300~600 字，分 3~5 段（段落之间用 \\n 分隔）；能给具体做法 / 数字 / 时间线 / 踩坑细节就给，不要只讲大道理；\n` +
    `- 不要出现"作为AI""我是模型"之类的话；不要标题党；不要输出 markdown 代码块；\n` +
    `- 最后判断这条帖子**是否需要配图**：讲经验 / 观点 / 清单 / 建议这类纯文字内容就不需要（needImage=false）；\n` +
    `  讲具体场景（校园、教室、图书馆、宿舍、食堂、城市街景、办公室、实验室等）才需要（needImage=true 并给一句中文画面描述，真实摄影风格、不要文字、不要 logo）。\n` +
    `主题方向：${topic}\n\n` +
    `只输出一个严格 JSON（不要任何多余文字、不要代码块围栏）：\n` +
    `{"title":"不超过 22 字的标题","content":"正文","needImage":true,"imagePrompt":"配图画面描述，不需要配图时留空字符串"}`
  try {
    const r = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: `请以「${botName}」的身份发一条关于「${topic}」的帖子。` }],
        max_tokens: 1800,
        stream: false
      })
    })
    if (!r.ok) return null
    const d = await r.json().catch(() => null)
    let text = d?.choices?.[0]?.message?.content || ''
    if (!text) return null
    // 容错：剥掉可能的代码块围栏，再截取第一个 { 到最后一个 }
    text = text.replace(/```json|```/g, '').trim()
    const s = text.indexOf('{')
    const e = text.lastIndexOf('}')
    if (s >= 0 && e > s) text = text.slice(s, e + 1)
    const obj = JSON.parse(text)
    const title = String(obj.title || '').trim().slice(0, 44)
    const content = String(obj.content || '').trim()
    const imagePrompt = String(obj.imagePrompt || '').trim()
    // 由模型判断是否需要配图（纯文字经验帖不配图，更真实也更省额度）
    const needImage = !!obj.needImage && imagePrompt.length > 4
    if (!title || content.length < 40) return null
    return { title, content, needImage, imagePrompt }
  } catch {
    return null
  }
}

// 带超时的 fetch：方舟/智谱任一方卡住时，必须在函数墙钟（免费档约 150s）内主动失败，
// 否则整个批次会被平台 546 掐断（实测：文案串行 + 配图超时未设 → 151s 被 kill）。
async function fetchWithTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// 单次「出图 + 下载」；不做转存。返回图片字节与真实格式，便于定位卡在哪一步。
async function genImageBytes(
  engine: 'ark' | 'zhipu',
  prompt: string
): Promise<{ buf?: Uint8Array; ct?: string; err?: string }> {
  const cfg =
    engine === 'ark'
      ? { base: ARK_BASE, key: ARK_KEY, model: ARK_MODEL, size: ARK_SIZE, extra: { response_format: 'url', watermark: false } }
      : { base: IMG_BASE, key: IMG_KEY, model: IMG_MODEL, size: '1024x1024', extra: {} as Record<string, unknown> }
  if (!cfg.key || !cfg.model) return { err: `${engine} 未配置 key/model` }
  let step = 'generate'
  try {
    const r = await fetchWithTimeout(`${cfg.base}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, prompt, size: cfg.size, ...cfg.extra })
    }, engine === 'ark' ? 75000 : 25000)
    if (!r.ok) return { err: `${engine} gen HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}` }
    const d = await r.json().catch(() => null)
    const url = d?.data?.[0]?.url
    if (!url) return { err: `${engine} gen 无 url: ${JSON.stringify(d).slice(0, 160)}` }

    step = 'download'
    const img = await fetchWithTimeout(url, {}, 30000)
    if (!img.ok) return { err: `${engine} download HTTP ${img.status}` }
    const buf = new Uint8Array(await img.arrayBuffer())
    if (buf.length < 1000) return { err: `${engine} 图片过小 ${buf.length}B` }

    // 格式按魔数判定：方舟 Seedream 返回 JPEG，智谱 cogview 返回 PNG。
    // 转存时 Content-Type 与扩展名必须跟真实格式一致，否则部分 WebView 不渲染。
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8
    return { buf, ct: isJpeg ? 'image/jpeg' : 'image/png' }
  } catch (e: any) {
    return { err: `${engine} ${step}: ${String(e?.message || e).slice(0, 160)}` }
  }
}

// 生成配图并转存到本平台 Storage（图片平台返回的是临时 URL，会过期）。
// 主用方舟（画质好），失败自动回落智谱（免费）——任一家出图即返回。
async function makeImage(prompt: string, fileKey: string): Promise<{ url: string | null; err?: string; engine?: string }> {
  const failures: string[] = []
  for (const engine of ['ark', 'zhipu'] as const) {
    const g = await genImageBytes(engine, prompt)
    if (!g.buf) {
      failures.push(String(g.err))
      continue
    }
    const ext = g.ct === 'image/jpeg' ? 'jpg' : 'png'
    try {
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/posts/${fileKey}.${ext}`, {
        method: 'POST',
        headers: {
          // 注意：Storage 网关必须同时带 apikey 与 Authorization，只带 Authorization 会被判
          // "Invalid Compact JWS"（新版 secret key 不是 JWT，网关靠 apikey 头识别）
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          'Content-Type': g.ct!,
          'x-upsert': 'true'
        },
        body: g.buf
      })
      if (!up.ok) {
        failures.push(`upload HTTP ${up.status} ${(await up.text().catch(() => '')).slice(0, 120)}`)
        continue
      }
      return { url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/posts/${fileKey}.${ext}`, engine }
    } catch (e: any) {
      failures.push(`upload: ${String(e?.message || e).slice(0, 120)}`)
    }
  }
  return { url: null, err: failures.join(' | ') }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    // 模式分支：
    //   post    —— 默认，自动生成「文字 +（按需）配图」帖子（原行为）
    //   interact—— 自动给最近内容留言 + 点赞，制造「随处都有活人」的氛围（本改造新增）
    const mode = body?.mode || 'post'
    if (mode === 'interact') {
      const want = Math.max(1, Math.min(Number(body?.count) || 3, 4))
      return await handleInteract(want)
    }
    const want = Math.max(1, Math.min(Number(body?.count) || 1, MAX_PER_CALL))

    // 取最近帖子，用于：① 限频统计 ② 避开刚发过的人设（让 20 个角色轮着来）
    const recent = await pgGet(`posts?select=id,author_id,created_at&order=created_at.desc&limit=60`)
    const botIds = new Set(BOTS.map((b) => b.id))
    const recentBots = (Array.isArray(recent) ? recent : []).filter((p: any) => botIds.has(p.author_id))
    const since = Date.now() - COOLDOWN_MIN * 60 * 1000
    const inWindow = recentBots.filter((p: any) => new Date(p.created_at).getTime() > since)
    if (inWindow.length >= MAX_PER_COOLDOWN) {
      return json({ ok: true, skipped: true, reason: `限频：${COOLDOWN_MIN} 分钟内已发布 ${inWindow.length} 条`, created: [] })
    }

    // 人设轮转：最近 8 条用过的先排除
    const usedIds = new Set(recentBots.slice(0, 8).map((p: any) => p.author_id))
    let pool = BOTS.filter((b) => !usedIds.has(b.id))
    if (!pool.length) pool = BOTS

    // 取虚拟账号的昵称与头像
    const profiles = await pgGet(`profiles?select=id,nickname,avatar&phone=like.bot*`)
    const pMap: Record<string, any> = {}
    for (const p of Array.isArray(profiles) ? profiles : []) pMap[p.id] = p

    const created: any[] = []
    const remaining = MAX_PER_COOLDOWN - inWindow.length
    const n = Math.min(want, remaining)

    // ─── 阶段一：并发出文案 ───
    // 文本生成是本函数最耗时的一环（每次经 agnes-proxy，主上游 8s 超时 + 备用模型生成 600 字，
    // 单条约 15~30s）。串行 3 条就要 75s，再叠加配图必然顶穿免费档约 150s 的墙钟（实测 546）。
    // 先随机选出不重复的人设，再并发跑——批次内不重复用同一人设的语义保持不变。
    const bag = [...pool]
    const picked: Bot[] = []
    for (let i = 0; i < n && bag.length; i++) {
      picked.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0])
    }

    const drafted = await Promise.all(
      picked.map(async (bot) => {
        const prof = pMap[bot.id]
        if (!prof) return null
        const botName: string = prof.nickname || '社区网友'
        const draft = await draftPost(botName, bot, prof)
        return draft ? { bot, prof, botName, draft, postId: crypto.randomUUID() } : null
      })
    )
    const plans = drafted.filter((x): x is NonNullable<typeof x> => !!x)

    // ─── 阶段二：并发配图 ───
    // 方舟 2K 图热态约 20s、冷启动实测可达 60s：一张张串行同样会顶穿函数时限，故并发。
    const ready = await Promise.all(
      plans.map(async (p) => ({
        ...p,
        // 由模型判断是否需要配图：纯文字经验帖不配图（更像真人，也省额度）
        img: p.draft.needImage
          ? await makeImage(p.draft.imagePrompt, p.postId)
          : ({ url: null } as { url: string | null; err?: string; engine?: string })
      }))
    )

    for (const p of ready) {
      const { bot, prof, botName, draft, postId, img } = p
      const row: Record<string, any> = {
        id: postId,
        title: draft.title,
        content: draft.content,
        images: img.url ? [img.url] : [],
        author_id: bot.id,
        author_name: botName,
        author_avatar: prof.avatar || '',
        likes: Math.floor(Math.random() * 26) + 3,
        collects: Math.floor(Math.random() * 10) + 1,
        comments: 0,
        status: 'on',
        is_bot: true
      }
      const ins = await pgInsert('posts', row)
      if (ins.ok) {
        created.push({
          id: postId,
          author: botName,
          title: draft.title,
          image: !!img.url,
          needImage: draft.needImage,
          engine: img.engine, // ark=方舟 / zhipu=智谱兜底，便于核验走了哪条链路
          imgErr: img.err
        })
      }
    }

    return json({ ok: true, created })
  } catch (e: any) {
    return json({ error: e?.message || 'server error' }, 500)
  }
})
