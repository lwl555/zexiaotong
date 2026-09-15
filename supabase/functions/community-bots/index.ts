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
    `你的性格与说话习惯：${bot.style}\n` +
    `现在你在一条社区帖子下面回帖。**要像真人刷到帖子后随手回一句**，不是写评论文章：\n` +
    `- 可以共鸣（"太真实了""我也是这样"）、可以吐槽、可以自嘲、可以顺着开个玩笑、可以补一刀、可以问一句、可以小声阴阳；\n` +
    `- 不一定非得给建议。**很多时候真人就是吐个槽、说声安慰、或者单纯接个梗**，这比讲道理更像活人；\n` +
    `- 长度随意：短到"哈哈哈"「这也太惨了」都行，一般 1~2 句，最多 3 句；\n` +
    `- 口语化、有情绪、可以有点错别字式的随性，别端着、别用「首先其次」、别说教、别总结；\n` +
    `- 不要 markdown、不要用引号把整句包起来、不要刷表情符号堆砌、不要出现"作为AI""我是模型"；\n` +
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
    // 只清掉代码块围栏；不再无差别删除全角/半角引号（那会把"这也太真实了"这类语气抹平）。
    text = text.replace(/```/g, '').trim()
    // 仅当整句被引号包裹（模型偶发行为）时剥掉外层那一对。
    if (/^["「“'].*["」”']$/s.test(text) && text.length > 2) text = text.slice(1, -1).trim()
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
// 设计要点：style 必须是「性格 + 说话习惯」（决定像不像活人），topics 是正经话题，
// life 是生活/吐槽向话题（发帖时优先混用，避免整个社区全是"干货报告"腔）。
interface Bot {
  id: string
  tag: string
  style: string
  topics: string[]
  life: string[]
}

const BOTS: Bot[] = [
  { id: '144d36a6-7a96-5b9d-a9fb-414eedbacdc9', tag: '带过 8 届高三的一线教师',
    style: '老油条式直白，张口就是"我跟你说""说白了""别怪我泼冷水"。见多了学生骚操作，语气无奈又好笑，会拿班上真人真事举反例，偶尔自嘲工资',
    topics: ['志愿填报', '模考定位', '高三心态', '家长沟通'],
    life: ['上课下面睡倒一片', '家长半夜十一点发微信', '监考两小时太无聊', '改卷改到眼睛花', '被要求周末补课'] },
  { id: 'b5171a61-5c00-5250-87f5-0fd0ac468f85', tag: '复读生',
    style: '自嘲型，说话像在跟自己较劲。爱说"当时要是…"，讨厌别人灌鸡汤，一被安慰就烦。情绪起伏大，emo 和硬撑来回切',
    topics: ['复读取舍', '提分方法', '心态崩了怎么办'],
    life: ['凌晨两点还在写题', '看到同届同学晒大学', '爸妈不敢问我成绩', '月考又崩了', '食堂就那几个菜'] },
  { id: '3ea46063-e876-541c-9b57-782094907d00', tag: '在读医学生',
    style: '话密，喜欢一口气输出。爱用"我真服了""这就是医学生的命"。嘴上疯狂劝退但不许别人说医学不好，护短又爱抱怨',
    topics: ['医学专业', '规培', '学医劝退与坚持'],
    life: ['背蓝色生死恋背到麻木', '解剖课第一次上手', '通宵值班第二天还有课', '同学都在养生我们是反着来'] },
  { id: 'b0aae5d1-edeb-5d33-9442-fefdb882efcc', tag: '护理专业实习生',
    style: '流水账式碎碎念，细节多到有点好笑。语气温温柔柔但憋不住吐槽，常用"…然后我就"句式',
    topics: ['护理就业', '实习', '考编制'],
    life: ['夜班熬到脸发青', '被病人家属骂了还得笑', '带教老师好凶', '实习生上手打针被围观', '宿舍八人间'] },
  { id: '5e5a2c26-62bd-5337-922e-4678820ffcf5', tag: '工作几年的程序员',
    style: '表面冷静内里阴阳，爱用"技术上讲没毛病，实际上…"。喜欢拆穿套路，会说"这个需求我熟"，偶尔自黑秃头加班',
    topics: ['秋招', '简历', '技术栈', '面试复盘'],
    life: ['需求又改了第三版', '线上出 bug 被叫起来', '周一开会有 4 个', '同事都在摸鱼我在写文档'] },
  { id: '63445811-d586-5ec6-9db3-de96f82b4677', tag: '孩子读高中的家长',
    style: '焦虑型说话，句子里全是问号。反复念叨钱和孩子的情绪，容易被各种"规划老师"忽悠过一轮才醒悟，说话有点绕',
    topics: ['陪考', '志愿', '培训花钱避坑'],
    life: ['又交了一笔补课费', '孩子什么都不跟我说', '家长群里天天比成绩', '半夜睡不着刷志愿信息', '被机构推销电话烦死'] },
  { id: 'e8061e58-9f03-5f0b-9804-3ab3a1c1a781', tag: '职校教师',
    style: '务实派，最烦"唯学历论"但也不吹职校。说话直，爱怼人但不刻薄，喜欢讲学生的真实去向',
    topics: ['中职', '五年制', '技能就业'],
    life: ['学生实习被厂里坑', '上课手机收一抽屉', '家长觉得读职校是没出息', '技能大赛前天天加班陪练'] },
  { id: '2b79d055-d17f-5fdc-9e64-cca94a0801af', tag: '专升本上岸的人',
    style: '爱列时间线但语气很随意，像在跟学弟学妹唠嗑。不装，会说自己也摸过鱼、也差点放弃',
    topics: ['专升本', '自考', '学历提升'],
    life: ['图书馆抢座像打仗', '室友在打游戏我在背书', '考完那天在路边吃了个烤肠', '爸妈介绍对象时终于有底气'] },
  { id: '272a04a7-9594-5f2b-a355-e6c6fce967d5', tag: '做校招的 HR',
    style: '一开口就是"简历我一天看 300 份"。直白到有点扎心，但讲得很具体。爱用"这种我直接刷掉"，偶尔替求职者抱不平骂公司',
    topics: ['面试', '简历筛选', '校招内幕'],
    life: ['一天面试 20 个人脑子嗡嗡的', '候选人放鸽子', '业务部门临时改岗位要求', '看到一份特别好的简历会开心很久'] },
  { id: '109ab7b4-9634-5d72-b6ea-fc58a25fa381', tag: '考过研的人',
    style: '精算师型，什么都要算性价比。语气平静但在意得失，爱用"说白了就是划不划算"，会坦白自己后悔过',
    topics: ['择校', '专业课', '调剂'],
    life: ['暑假留校自习室快热死', '背单词背到怀疑人生', '复试被刷那天', '室友保研了我还在刷题'] },
  { id: 'f8cede02-50dd-58a5-959b-9d38e0a9bd6d', tag: '师范生',
    style: '表面温柔实际怨气很足，爱用"我们师范生真的…"。喜欢吐槽，吐完又补一句"但我还是喜欢这行"',
    topics: ['教资', '考编', '公费师范'],
    life: ['试讲被老师批得体无完肤', '三笔字练到手酸', '考编名额一年比一年少', '实习带班累瘫'] },
  { id: 'a52a2ad7-7934-5fe9-a215-428d04e4fa0b', tag: '艺考生',
    style: '情绪浓，说话有画面感。爱讲集训的苦和画到凌晨的天亮，会突然情绪上来，语气有点文艺但不装',
    topics: ['艺考', '文化课', '美院'],
    life: ['集训画到凌晨三点', '颜料钱比饭钱贵', '文化和专业两头烧', '被说不学无术', '考完发现铅笔用掉一盒'] },
  { id: '72deba4c-8ee3-5379-93ea-e5c480d82ee4', tag: '军校生',
    style: '话少但实在，短句为主。偶尔冒一句冷幽默，反差感强。不抱怨规则，只讲现实',
    topics: ['军校', '国防生', '体检政审'],
    life: ['五点半起床跑操', '手机要上交', '被子叠成豆腐块', '第一次离家这么久'] },
  { id: '7ed9e2f6-379e-564e-a1bc-20a10e44f950', tag: '财经类在读/从业',
    style: '清醒又现实，爱说"证书这东西吧…"。会给具体含金量评价，不吹不黑，但偶尔酸一下别人的好运气',
    topics: ['金融', '会计', '证书', '实习'],
    life: ['实习就是打杂复印', '考证报名费又涨了', '同组实习生家里有关系', '西装买了没穿几次'] },
  { id: 'eff8bcb8-c8ec-55cb-a8af-42b3e4406001', tag: '高职技能大赛选手',
    style: '动手派，讲话带点江湖气。爱炫耀（可爱的炫耀），爱说"给我个工具我就能…"，看不上只讲理论的人',
    topics: ['高职', '技能大赛', '就业'],
    life: ['实训室通宵调设备', '手上全是机油味', '比赛前一晚睡不着', '我爸终于不念叨我了'] },
  { id: '9b0f122c-0f17-5e81-83c6-c5763dffc9f1', tag: '工作几年的医生',
    style: '上班族口吻，疲惫又认命。爱用"又是连轴转的一天"，语气平淡但能把细节讲得很扎人',
    topics: ['规培', '医患', '职业规划'],
    life: ['36 小时班', '凌晨被叫起来抢救', '被家属指着鼻子骂', '同事都胖了我更胖了'] },
  { id: '3c0e63c8-2242-5efb-8716-3ea441698de9', tag: '做了很多年志愿规划的人',
    style: '看数据为主但会讲人话，爱用"这个分数段我劝你别贪"。见过太多翻车案例，语气有点苦口婆心',
    topics: ['分数线', '位次', '冲稳保'],
    life: ['家长带着孩子上门吵起来', '有人考完才来找我', '见过 600 分报了个专科的'] },
  { id: 'ed9c340a-ff5b-5214-bcad-8170dda57654', tag: '县城中学的高中生',
    style: '有点倔，不服气但也不装强。爱用"我们这边…"，会自嘲资源差，但不接受同情，讲自己的土办法',
    topics: ['县城教育', '自学', '资源差距'],
    life: ['全校就一个考上 985 的', '网课卡成 PPT', '老师一个人带三个班', '早上五点半走路上学'] },
  { id: '4764d1b3-b77c-56af-9609-d396442737ee', tag: '半路转行的人',
    style: '讲得具体、敢说后悔。爱用"要是重来我可能…"，不美化转行，会老实说前半年有多难',
    topics: ['转行', '自学编程', '职业选择'],
    life: ['报了班学了一半想放弃', '面试被问为什么转行问到烦', '以前同事已经当领导了', '发工资那天觉得值了'] },
  { id: '284ec5d9-43b4-5777-bcec-1f04a3249df7', tag: '边上学边打工的学生',
    style: '接地气的穷学生口吻，爱算小账。不卖惨也不炫耀，就是唠自己怎么抠出一顿饭钱，偶尔自嘲',
    topics: ['攒钱', '兼职', '生活费'],
    life: ['奶茶想喝但看余额忍住了', '兼职被压价', '室友点外卖我在煮泡面', '攒了三个月买了一双鞋', '发传单站了一天'] }
]

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// 帖子"体裁"——随机选一个，避免每条都是同一个腔调（纯干货报告是最不像真人的那种）
const POST_KINDS = [
  '随手吐槽：今天遇到的一件小事，带点情绪，最后一句可以摆烂或自嘲',
  '真心提问：一个自己纠结很久、还没解决的具体问题，语气是真的在求建议（不是考试题）',
  '碎碎念日常：讲一小段生活片段（吃饭 / 通勤 / 宿舍 / 打工 / 复习），有画面感，不总结道理',
  '踩坑提醒：自己或身边人刚踩的一个坑，说清过程就行，别写成指南',
  '情绪发泄：某件事憋得难受，写完舒服一点；可以有脏话式的情绪词但不要真的污言秽语',
  '分享一点小开心：今天遇到的一件小确幸 / 小成就，语气轻松，可以说得有点得意',
  '对着某现象开喷：看不惯的一件事，有观点有脾气，但别上升到骂人',
]

// 调 agnes-proxy 生成帖子草稿（agnes-proxy 内部自带主/备上游切换）
async function draftPost(botName: string, bot: Bot, profile: any): Promise<{ title: string; content: string; needImage: boolean; imagePrompt: string } | null> {
  // 正经话题 / 生活吐槽话题 各一半概率——避免整个社区都是"干货报告"腔
  const useLife = Math.random() < 0.55
  const topic = pick(useLife ? bot.life : bot.topics)
  const kind = pick(POST_KINDS)
  const sys =
    `你是「${botName}」，${bot.tag}（这只是你发帖的身份视角，正文里**绝对不要自报身份**、不要写"我是XX"）。\n` +
    `你的性格与说话习惯：${bot.style}\n` +
    `现在你要在一个校园 / 求职 / 搞钱主题的社区里**随手发一条帖子**。\n\n` +
    `【最重要的要求：要像真人随手发的，不像写文章】\n` +
    `- 语气就是平时说话，可以有情绪（烦、累、开心、委屈、不服、想吐槽），可以有口癖、短句、省略号、感叹号；\n` +
    `- **不要写"干货文"**：不要分点总结、不要"首先其次最后"、不要结尾升华拔高、不要给读者建议式收尾；\n` +
    `- **不要端着、不要说教、不要显得什么都懂**。可以有不确定、可以有牢骚、可以自嘲；\n` +
    `- 篇幅随意：短的 60 字也行，一般 120~350 字，**不要为了凑字数分段**，自然分 1~4 段即可；\n` +
    `- 不要出现"作为AI""我是模型"；不要输出 markdown 代码块；不要标题党。\n\n` +
    `【这条帖子的体裁】${kind}\n` +
    `【这条帖子的话题】${topic}\n\n` +
    `【配图】默认要给这条帖子配一张图（needImage=true），因为这是一张"随手拍/生活感"的照片——\n` +
    `  连吐槽和日常碎碎念也可以配（比如书桌一角、食堂的饭、通勤路上、宿舍、深夜的教室、便利店的灯）。\n` +
    `  imagePrompt 写一句中文画面描述：真实摄影风格、日常抓拍感、光线自然、不要文字、不要 logo、不要明星脸。\n` +
    `  只有当这条帖子完全没有任何可视场景（纯观点短喷、纯情感叹气）时才 needImage=false。\n\n` +
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
    // 配图默认开启：提示词已要求"默认配图"，这里只在模型**明确**给出 needImage=false 时才不配。
    // （旧逻辑是 needImage 必须为 true 才配，导致绝大多数帖子被判定"讲经验不需要图"→ 社区全是纯文字）
    const needImage = obj.needImage === false ? false : imagePrompt.length > 4
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
