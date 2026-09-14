// community-bots — Supabase Edge Function (Deno)
// 社区智能体：20 个不同人设，自动生成「拟真帖子」（文字 + 配图）发布到校园社区。
//
// 调用：POST /functions/v1/community-bots      body: { count?: number }
//   需带 Supabase anon key（Authorization: Bearer <anon>）。
// 安全：内置限频——默认 30 分钟内最多产出 4 条，防止被刷爆上游配额。
//
// Secrets：
//   BACKUP_KEY / IMAGE_API_KEY   图片生成平台 key（默认智谱 cogview-3-flash，免费）
//   IMAGE_API_BASE / IMAGE_MODEL 可选覆盖图片平台
//   文字生成复用 agnes-proxy（其内部已含 Agnes → 智谱 的自动切换，本函数无需再管）
//
// 部署： supabase functions deploy community-bots --project-ref wcnssyiqitugqfmcbdhe

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CHAT_URL = `${SUPABASE_URL}/functions/v1/agnes-proxy/v1/chat/completions`
const IMG_KEY = Deno.env.get('IMAGE_API_KEY') || Deno.env.get('BACKUP_KEY') || ''
const IMG_BASE = (Deno.env.get('IMAGE_API_BASE') || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/+$/, '')
const IMG_MODEL = Deno.env.get('IMAGE_MODEL') || 'cogview-3-flash'
const BUCKET = 'community'

// 限频：窗口内最多产出条数（防被恶意刷爆上游配额）
// 单条要跑一次文字生成（可能再跑一次配图），4 条约 1~2 分钟，仍在函数时限内。
const COOLDOWN_MIN = 30
const MAX_PER_COOLDOWN = 4

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

// 生成配图并转存到本平台 Storage（图片平台返回的是临时 URL，会过期）
// 返回诊断信息，便于定位「配图失败」卡在哪一步
async function makeImage(prompt: string, fileKey: string): Promise<{ url: string | null; err?: string }> {
  if (!IMG_KEY) return { url: null, err: 'IMG_KEY 未配置' }
  let step = 'generate'
  try {
    const r = await fetch(`${IMG_BASE}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${IMG_KEY}` },
      body: JSON.stringify({ model: IMG_MODEL, prompt, size: '1024x1024' })
    })
    if (!r.ok) return { url: null, err: `gen HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}` }
    const d = await r.json().catch(() => null)
    const url = d?.data?.[0]?.url
    if (!url) return { url: null, err: 'gen 无 url: ' + JSON.stringify(d).slice(0, 160) }

    step = 'download'
    const img = await fetch(url)
    if (!img.ok) return { url: null, err: `download HTTP ${img.status}` }
    const buf = new Uint8Array(await img.arrayBuffer())
    if (buf.length < 1000) return { url: null, err: `图片过小 ${buf.length}B` }

    step = 'upload'
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/posts/${fileKey}.png`, {
      method: 'POST',
      headers: {
        // 注意：Storage 网关必须同时带 apikey 与 Authorization，只带 Authorization 会被判
        // "Invalid Compact JWS"（新版 secret key 不是 JWT，网关靠 apikey 头识别）
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true'
      },
      body: buf
    })
    if (!up.ok) return { url: null, err: `upload HTTP ${up.status} ${(await up.text().catch(() => '')).slice(0, 160)}` }
    return { url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/posts/${fileKey}.png` }
  } catch (e: any) {
    return { url: null, err: `${step}: ${String(e?.message || e).slice(0, 160)}` }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const want = Math.max(1, Math.min(Number(body?.count) || 1, MAX_PER_COOLDOWN))

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

    for (let i = 0; i < n; i++) {
      const bot = pool[Math.floor(Math.random() * pool.length)]
      const prof = pMap[bot.id]
      if (!prof) continue
      const botName: string = prof.nickname || '社区网友'

      const draft = await draftPost(botName, bot, prof)
      if (!draft) continue

      const postId = crypto.randomUUID()
      // 由模型判断是否需要配图：纯文字经验帖不配图（更像真人，也省上游额度）
      const img = draft.needImage ? await makeImage(draft.imagePrompt, postId) : { url: null as string | null }

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
        created.push({ id: postId, author: botName, title: draft.title, image: !!img.url, needImage: draft.needImage, imgErr: img.err })
      }
      // 同一批次不重复用同一人设
      pool = pool.filter((b) => b.id !== bot.id)
      if (!pool.length) pool = BOTS
    }

    return json({ ok: true, created })
  } catch (e: any) {
    return json({ error: e?.message || 'server error' }, 500)
  }
})
