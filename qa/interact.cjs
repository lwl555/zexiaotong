// 移动端业务功能交互测试（登录→充值→发任务/帖/商品→AI对话）
// 用法: BASE_URL=https://lwl555.github.io/zexiaotong/ node qa/interact.cjs
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = (process.env.BASE_URL || 'https://lwl555.github.io/zexiaotong/').replace(/\/$/, '') + '/'
const OUT = path.join(__dirname, 'shots')
fs.mkdirSync(OUT, { recursive: true })

const QQ = '289' + String(Math.floor(Math.random() * 10000000)).padStart(7, '0')
const PWD = 'Qa123456'
const SUFFIX = 'QA' + Date.now().toString().slice(-5)
const TASK_TITLE = '自动测试任务' + SUFFIX
const POST_TITLE = '自动测试帖子' + SUFFIX
const GOODS_TITLE = '自动测试商品' + SUFFIX
const TOMORROW = (() => { const d = new Date(Date.now() + 86400000); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T12:00` })()

const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  })
  const page = await ctx.newPage()
  await page.addInitScript(() => { try { localStorage.setItem('zex:skipSplash', '1') } catch (e) {} })

  const consoleErrors = [], pageErrors = []
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', e => pageErrors.push(e.message))

  const results = []
  async function step(name, fn) {
    const t0 = Date.now()
    let ok = true, note = ''
    try { await fn() } catch (e) { ok = false; note = (e && e.message || String(e)).slice(0, 200) }
    const ms = Date.now() - t0
    results.push({ name, ok, ms, note })
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} (${ms}ms)${note ? ' :: ' + note : ''}`)
    await page.screenshot({ path: path.join(OUT, `step-${name.replace(/[^\w]/g, '_')}.png`), fullPage: false }).catch(() => {})
  }
  const bodyHas = txt => page.evaluate(t => document.body && document.body.innerText.includes(t), txt)
  const clickBtn = name => page.getByRole('button', { name, exact: true }).first().click()
  const fillPh = (ph, val) => page.getByPlaceholder(ph, { exact: true }).first().fill(val)

  // 1) 注册
  await step('register', async () => {
    await page.goto(BASE + '#/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(800)
    await clickBtn('注册')
    await fillPh('请输入QQ号', QQ)
    await fillPh('6-20 位，含字母和数字', PWD)
    await fillPh('再次输入密码', PWD)
    await clickBtn('注册并登录')
    await page.waitForFunction(() => { try { return !!localStorage.getItem('zex:user_id') } catch { return false } }, { timeout: 15000 })
    const uid = await page.evaluate(() => localStorage.getItem('zex:user_id'))
    fs.writeFileSync(path.join(__dirname, 'testuser.json'), JSON.stringify({ qq: QQ, id: uid, pwd: PWD }))
    // 关键：register 完成后做一次 hard reload，让 App 完整跑 init()、从 DB 拉 me 与数据，
    // 避免后续 hash-change 到受保护页面时 me 尚未就绪导致 .balance.toFixed() 之类的渲染崩溃。
    await page.reload({ waitUntil: 'load' })
    await page.waitForFunction(() => document.body && document.body.innerText.length > 50, { timeout: 15000 })
    await page.waitForTimeout(1500)
  })

  // 2) 钱包充值
  await step('wallet_recharge', async () => {
    await page.goto(BASE + '#/wallet', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(() => document.body && document.body.innerText.includes('我的钱包'), { timeout: 20000 })
    await fillPh('充值金额', '100')
    await clickBtn('充值')
    await page.waitForFunction(() => document.body && document.body.innerText.includes('¥100.00'), { timeout: 15000 })
  })

  // 3) 发布任务
  await step('publish_task', async () => {
    await page.goto(BASE + '#/publish', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(() => document.body && document.body.innerText.includes('发布悬赏任务'), { timeout: 20000 })
    await fillPh('例如：代取快递到宿舍楼下', TASK_TITLE)
    await fillPh('0.00', '10')
    await page.locator('input[type=datetime-local]').first().fill(TOMORROW)
    await clickBtn('发布并冻结金额')
    await page.waitForFunction(() => location.hash === '#/', { timeout: 15000 })
  })

  // 4) 我发布的任务可见
  await step('my_tasks_visible', async () => {
    await page.goto(BASE + '#/my-tasks', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(1500)
    if (!(await bodyHas(TASK_TITLE))) throw new Error('任务未出现在我发布的列表')
  })

  // 5) 发帖
  await step('publish_post', async () => {
    await page.goto(BASE + '#/publish-post', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(() => document.body && document.body.innerText.includes('发布帖子'), { timeout: 20000 })
    await fillPh('一句话说清你想聊的', POST_TITLE)
    await fillPh('分享你的想法、求助、吐槽…', '自动化测试正文内容')
    await clickBtn('发布帖子')
    await page.waitForFunction(() => location.hash === '#/community', { timeout: 15000 })
    await page.waitForTimeout(1500)
    if (!(await bodyHas(POST_TITLE))) throw new Error('帖子未出现在社区')
  })

  // 6) 发布二手商品
  await step('publish_goods', async () => {
    await page.goto(BASE + '#/publish-goods', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(() => document.body && document.body.innerText.includes('发布二手商品'), { timeout: 20000 })
    await fillPh('例如：九成新 iPad Air', GOODS_TITLE)
    await fillPh('0', '50')
    await clickBtn('发布商品')
    await page.waitForFunction(() => location.hash === '#/goods', { timeout: 15000 })
    await page.waitForTimeout(1500)
    if (!(await bodyHas(GOODS_TITLE))) throw new Error('商品未出现在二手市场')
  })

  // 7) AI 对话（数据链路）
  await step('ai_chat', async () => {
    await page.goto(BASE + '#/ai-search', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(() => document.querySelector('.chat-input input'), { timeout: 20000 })
    const t0 = Date.now()
    await page.fill('.chat-input input', '简单介绍一下浙江大学')
    await clickBtn('发送')
    // 等待出现非空的 AI 气泡
    await page.waitForFunction(() => {
      const b = document.querySelector('.msg.ai .bubble')
      return b && b.innerText.trim().length > 30 && !document.querySelector('.thinking-status')
    }, { timeout: 90000 })
    const dt = Date.now() - t0
    const meta = await page.evaluate(() => {
      const m = document.querySelector('.panel-head .meta')
      return m ? m.innerText.trim() : ''
    })
    results[results.length - 1].chatMs = dt
    results[results.length - 1].searchMeta = meta
    console.log(`   AI 首答耗时=${dt}ms meta="${meta}"`)
  })

  await browser.close()
  fs.writeFileSync(path.join(__dirname, 'interact-report.json'), JSON.stringify({ qq: QQ, results, consoleErrors: consoleErrors.slice(0, 20), pageErrors: pageErrors.slice(0, 20) }, null, 2))
  const fail = results.filter(r => !r.ok).length
  console.log(`\n=== INTERACT DONE === pass=${results.length - fail} fail=${fail} consoleErr=${consoleErrors.length} pageErr=${pageErrors.length}`)
  console.log('report -> qa/interact-report.json | testuser -> qa/testuser.json')
})().catch(e => { console.error('FATAL', e); process.exit(1) })
