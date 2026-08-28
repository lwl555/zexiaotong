// 移动端全量测试：性能 + 数据通信链路（真实 supabase 请求抓取）
// 用法: BASE_URL=https://lwl555.github.io/zexiaotong/ node qa/full.cjs <before|after>
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = (process.env.BASE_URL || 'https://lwl555.github.io/zexiaotong/').replace(/\/$/, '') + '/'
const LABEL = process.argv[2] || 'after'
const OUT = path.join(__dirname, 'shots')
fs.mkdirSync(OUT, { recursive: true })

const ROUTES = [
  ['home', '#/'], ['splash', '#/splash'], ['login', '#/login'],
  ['community', '#/community'], ['goods', '#/goods'], ['publish', '#/publish'],
  ['messages', '#/messages'], ['notifications', '#/notifications'],
  ['mine', '#/mine'], ['wallet', '#/wallet'], ['my-tasks', '#/my-tasks'],
  ['ai-search', '#/ai-search'], ['ai-tangdou', '#/ai-tangdou'], ['news', '#/news'],
  ['money', '#/money'], ['about', '#/about'], ['ai-history', '#/ai-history'],
]

const isApi = u => /supabase\.(co|in)/.test(u) || u.includes('functions.supabase.co')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  })
  const page = await ctx.newPage()
  await page.addInitScript(() => { try { localStorage.setItem('zex:skipSplash', '1') } catch (e) {} })

  const results = []
  for (const [name, hash] of ROUTES) {
    const consoleErrors = [], pageErrors = [], failed = []
    const net = [] // {url, method, status, dur}
    const reqStart = new Map()
    const onConsole = m => { if (m.type() === 'error') consoleErrors.push(m.text()) }
    const onPageErr = e => pageErrors.push(e.message)
    const onReq = r => { if (isApi(r.url())) reqStart.set(r, Date.now()) }
    const onResp = r => {
      const u = r.url()
      if (!isApi(u)) { if (r.status() >= 400) failed.push(`${r.status()} ${u.slice(0, 80)}`); return }
      const s = reqStart.get(r.request()) || Date.now()
      net.push({ url: u.replace(/^https?:\/\//, '').slice(0, 90), method: r.request().method(), status: r.status(), dur: Date.now() - s })
    }
    const onReqFail = r => { if (isApi(r.url())) net.push({ url: r.url().replace(/^https?:\/\//, '').slice(0, 90), method: r.request().method(), status: 0, dur: -1, fail: r.failure()?.errorText }); else failed.push(`FAIL ${r.url().slice(0, 80)} :: ${r.failure()?.errorText}`) }
    page.on('console', onConsole); page.on('pageerror', onPageErr)
    page.on('request', onReq); page.on('response', onResp); page.on('requestfailed', onReqFail)

    const t0 = Date.now()
    let navOk = true, navErr = ''
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => { navOk = false; navErr = e.message })
    let ready = 'timeout'
    try { await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 8, { timeout: 15000 }); ready = 'ok' } catch {}
    const domReady = Date.now() - t0
    await page.waitForTimeout(1500)
    const fullTime = Date.now() - t0
    const bodyLen = await page.evaluate(() => document.body ? document.body.innerText.trim().length : 0).catch(() => 0)
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false }).catch(() => {})

    const totalErr = consoleErrors.length + pageErrors.length
    const netFail = net.filter(n => n.status >= 400 || n.status === 0).length
    results.push({ name, hash, navOk, navErr: navErr.slice(0, 100), ready, domReadyMs: domReady, fullTimeMs: fullTime, bodyLen, consoleErrors: consoleErrors.length, consoleErrSamples: consoleErrors.slice(0, 3), pageErrors: pageErrors.length, pageErrSamples: pageErrors.slice(0, 3), failedReq: failed.length, failedSamples: failed.slice(0, 5), netReqs: net.length, netFail, netSamples: net.slice(0, 8) })
    page.off('console', onConsole); page.off('pageerror', onPageErr); page.off('request', onReq); page.off('response', onResp); page.off('requestfailed', onReqFail)
    console.log(`[${name}] ready=${ready} dom=${domReady}ms body=${bodyLen}ch err=${totalErr} netFail=${netFail}(${net.length}) fail=${failed.length}`)
  }

  await browser.close()
  const file = path.join(__dirname, `full-${LABEL}.json`)
  fs.writeFileSync(file, JSON.stringify(results, null, 2))
  const sumErr = results.reduce((s, r) => s + r.consoleErrors + r.pageErrors, 0)
  const sumFail = results.reduce((s, r) => s + r.failedReq, 0)
  const sumNetFail = results.reduce((s, r) => s + r.netFail, 0)
  const sumNet = results.reduce((s, r) => s + r.netReqs, 0)
  console.log(`\n=== SUMMARY @${LABEL} ===`)
  console.log(`routes=${results.length} console+pageErr=${sumErr} nonApiFailedReq=${sumFail} supabaseReqs=${sumNet} supabaseFailed=${sumNetFail}`)
  console.log(`report -> ${file}`)
})().catch(e => { console.error('FATAL', e); process.exit(1) })
