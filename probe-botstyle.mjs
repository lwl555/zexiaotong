// 提示词试跑器：从 community-bots 源码里抽出真实的 LANG_RULES / POST_KINDS，
// 拼出与线上完全一致的 system prompt，直接调 agnes-proxy 生成样例。
// 不写数据库、不占发文限频，用来快速判断「语感对不对」。
import fs from 'fs'

const SRC = fs.readFileSync('supabase/functions/community-bots/index.ts', 'utf8')

// 抽 LANG_RULES 的模板字符串正文
const langM = SRC.match(/const LANG_RULES = `([\s\S]*?)`\.trim\(\)/)
if (!langM) { console.error('未能抽取 LANG_RULES'); process.exit(1) }
const LANG_RULES = langM[1]

// 抽 POST_KINDS 数组里的字符串字面量
const kindsM = SRC.match(/const POST_KINDS = \[([\s\S]*?)\n\]/)
const POST_KINDS = kindsM ? [...kindsM[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : []

console.log('LANG_RULES 长度:', LANG_RULES.length, '| POST_KINDS:', POST_KINDS.length)

// 抽若干人设（tag/style/voice），从源码里正则取，保证与线上一致
function extractBot(id) {
  const m = SRC.match(new RegExp("id: '" + id + "'[\\s\\S]*?\\n  \\}"))
  if (!m) return null
  const blk = m[0]
  const tag = (blk.match(/tag: '([^']*)'/) || [])[1]
  const style = (blk.match(/style: '([^']*)'/) || [])[1]
  const voice = (blk.match(/voice: '([^']*)'/) || [])[1]
  return { id, tag, style, voice }
}

const TEST_BOTS = [
  ['144d36a6-7a96-5b9d-a9fb-414eedbacdc9', '老张不补课'],
  ['b0aae5d1-edeb-5d33-9442-fefdb882efcc', 'May要早睡'],
  ['284ec5d9-43b4-5777-bcec-1f04a3249df7', '龙飞在路上'],
  ['3ea46063-e876-541c-9b57-782094907d00', '斯远在看书'],
  ['ed9c340a-ff5b-5214-bcad-8170dda57654', '赵晨'],
]

const BASE = 'https://wcnssyiqitugqfmcbdhe.functions.supabase.co/agnes-proxy/v1/chat/completions'
const ANON = fs.readFileSync('.anon', 'utf8').trim()

const pick = a => a[Math.floor(Math.random() * a.length)]

function buildSys(botName, bot, kind, topic) {
  return `你是「${botName}」，${bot.tag}（这只是你发帖的身份视角，正文里**绝对不要自报身份**、不要写"我是XX"）。\n` +
    `你的性格与说话习惯：${bot.style}\n` +
    `你的声音指纹（必须自然带出来，别硬塞、别每句都挂口头禅）：\n${bot.voice}\n` +
    `⚠️ 上面「语气参考」里的句子只是让你感受语气，**绝对不许原样照抄**；正文必须是你自己现写的话。\n\n` +
    LANG_RULES + `\n\n` +
    `【你看过的同类帖子长这样（只感受语感，别照抄内容）】\n` +
    `例1｜标题：早八人已经死了只是还没埋\n` +
    `正文：今天第一节早八，我坐第三排，眼睛睁着，人已经走了。老师问谁来回答，我抬头，他看我，我看他，\n` +
    `对视三秒，他略过了我。谢谢老师，你是个好人。（配图：天没亮的教室后排）\n\n` +
    `例2｜标题：我妈问我什么时候找对象，我说先找到工作\n` +
    `正文：她沉默五秒，说"那你抓紧"。不是，妈，你这话里有话啊。\n\n` +
    `例3｜标题：栓Q了，图书馆抢座抢到怀疑人生\n` +
    `正文：六点半到的，前面排了二十多人，全是背单词的。我站那想了半天：我一个来睡觉的，凭什么跟人家卷。\n` +
    `行，我回宿舍睡，宿舍的床也很香（自我安慰）。\n\n` +
    `现在你要在一个校园 / 求职 / 搞钱主题的社区里**随手发一条帖子**。\n\n` +
    `【最重要的要求：要像真人随手发的，不像写文章】\n` +
    `- 【必须带上你这个身份才有的细节】——医学生就写背书/解剖/值班那种细节，师范生就写试讲/三笔字，打工的学生就写时薪/被压价。**不要写成放之四海皆准的通用感慨**（"生活不易""要好好爱自己"那种一律不算）；\n` +
    `- 【这条必须好笑或者有梗】——哪怕是丧，也要丧得好笑（自嘲、夸张、反差、突然转折、一本正经地胡说八道）。\n` +
    `  **平铺直叙把事说完就结束的帖子算不合格**；\n` +
    `- 语气就是平时说话，可以有情绪（烦、累、开心、委屈、不服、想吐槽），可以有口癖、短句、省略号、感叹号；\n` +
    `- **不要写"干货文"、不要当"热心答主"**：不要分点总结、不要"首先其次最后"、不要结尾升华拔高、\n` +
    `  不要给读者建议式收尾、不要"客观地说其实两面都有道理"——真人发帖经常偏激、绝对化、只看自己那点破事，这反而更真；\n` +
    `- **敢写有脾气的内容**：可以怼一种现象、可以晒自己的惨/爽、可以放一句招人反驳的狠话，\n` +
    `  别追求"政治正确"和"滴水不漏"，那是最不像活人的地方；\n` +
    `- **不要端着、不要说教、不要显得什么都懂**。可以有不确定、可以有牢骚、可以自嘲、可以写完自己都觉得有点离谱；\n` +
    `- 篇幅随意：短的 60 字也行，一般 120~350 字，**不要为了凑字数分段**，自然分 1~4 段即可；\n` +
    `- 不要出现"作为AI""我是模型"；不要输出 markdown 代码块；不要标题党；标题别写成"关于XX的思考"那种论文味。\n` +
    `  **标题本身最好就好笑，或者像个真人随手敲出来的句子**（例：早八人已经死了只是还没埋 / 我真的会谢 / 主打一个活着 / 这种室友还能退货吗）；\n\n` +
    `【这条帖子的体裁】${kind}\n` +
    `【这条帖子的话题】${topic}\n\n` +
    `【配图】默认要给这条帖子配一张图（needImage=true），因为这是一张"随手拍/生活感"的照片——\n` +
    `  连吐槽和日常碎碎念也可以配（比如书桌一角、食堂的饭、通勤路上、宿舍、深夜的教室、便利店的灯）。\n` +
    `  imagePrompt 写一句中文画面描述：真实摄影风格、日常抓拍感、光线自然、不要文字、不要 logo、不要明星脸。\n` +
    `  只有当这条帖子完全没有任何可视场景（纯观点短喷、纯情感叹气）时才 needImage=false。\n\n` +
    `只输出一个严格 JSON（不要任何多余文字、不要代码块围栏）：\n` +
    `{"title":"不超过 22 字的标题","content":"正文","needImage":true,"imagePrompt":"配图画面描述，不需要配图时留空字符串"}`
}

const TOPICS = ['大学生活', '早八与作息', '食堂', '宿舍', '兼职攒钱', '考研还是就业', '图书馆', '外卖与钱包']

async function gen(botName, bot) {
  const kind = pick(POST_KINDS)
  const topic = pick(TOPICS)
  const t0 = Date.now()
  const r = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({
      model: 'agnes-2.0-flash',
      messages: [
        { role: 'system', content: buildSys(botName, bot, kind, topic) },
        { role: 'user', content: `请以「${botName}」的身份发一条关于「${topic}」的帖子。` }
      ],
      max_tokens: 1800, stream: false,
      // 抑制复读：模型偶尔会把某句口头禅无限重复（实测「…然后我就」连写 40 遍）。
      // 先在这里验证上游是否接受该参数，再决定是否加进正式函数。
      frequency_penalty: 0.5,
      presence_penalty: 0.3
    })
  })
  const ms = Date.now() - t0
  if (!r.ok) return { err: 'HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200) }
  const d = await r.json().catch(() => null)
  let text = d?.choices?.[0]?.message?.content || ''
  text = text.replace(/```json|```/g, '').trim()
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s >= 0 && e > s) text = text.slice(s, e + 1)
  try {
    const o = JSON.parse(text)
    return { ms, kind: kind.split('：')[0], title: o.title, content: o.content }
  } catch {
    return { ms, raw: text.slice(0, 300) }
  }
}

const results = []
for (const [id, name] of TEST_BOTS) {
  const bot = extractBot(id)
  if (!bot) { console.log('!! 未能抽取人设', name); continue }
  const g = await gen(name, bot)
  results.push({ name, ...g })
  console.log('\n════════ ' + name + '  [' + (g.kind || '-') + ']  ' + (g.ms ? g.ms + 'ms' : '') + ' ════════')
  if (g.err) console.log('ERR:', g.err)
  else if (g.raw) console.log('解析失败，原文：', g.raw)
  else {
    console.log('标题：' + g.title)
    console.log('正文：' + g.content)
  }
}

// 简单统计：命中网络用语/梗的词数 + 是否踩到 AI 说教词 + 是否照抄了人设示例
const MEME = ['谁懂', '绷不住', '裂开', '破防', '已老实', '笑死', '乐', '啊这', '这很难评', '主打一个', '属于是', '逆天', '抽象', '救命', '鼠鼠', '吗喽', '牛马', '早八', '班味', '搭子', '嘴替', '无语住', '尊嘟假嘟', '栓Q', 'xswl', 'yyds', '绝了', '离谱', '笑不活', '已阵亡']
const BANNED = ['首先', '其次', '综上所述', '总的来说', '希望对你有帮助', '作为过来人', '保持积极心态', '一切都会好起来', '客观来讲', '人生就是', '共勉', '值得深思', '自己开心最重要', '避风港', '小确幸', '岁月静好']

// 从人设 voice 的「语气参考」里取出示例句，检测输出有没有整句照抄
function sampleSentences(voice) {
  const seg = (voice.split('语气参考')[1] || '').replace(/^[^—]*——/, '')
  return seg.split('、').map(s => s.replace(/[“”"]/g, '').trim()).filter(s => s.length >= 8)
}

console.log('\n\n===== 质检汇总 =====')
for (const r of results) {
  const body = (r.title || '') + (r.content || '')
  const hits = MEME.filter(m => body.includes(m))
  const bad = BANNED.filter(b => body.includes(b))
  const bot = TEST_BOTS.find(b => b[1] === r.name)
  const ex = bot ? sampleSentences(extractBot(bot[0])?.voice || '') : []
  const copied = ex.filter(s => body.includes(s.slice(0, 8)))
  console.log(`${r.name}: 标题空=${!r.title} 梗命中 ${hits.length} [${hits.join(',')}]  违规词 ${bad.length ? '❌' + bad.join(',') : '✅'}  照抄示例 ${copied.length ? '❌×' + copied.length : '✅无'}`)
}
