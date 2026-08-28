// 移动端全量冒烟 + 性能基线测试
// 用法: BASE_URL=https://lwl555.github.io/zexiaotong/ node qa/smoke.cjs
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = (process.env.BASE_URL || 'https://lwl555.github.io/zexiaotong/').replace(/\/$/, '') + '/'
const OUT = path.join(__dirname, 'shots')
fs.mkdirSync(OUT, { recursive: true })

const ROUTES = [
  ['home', '#/'],
  ['splash', '#/splash'],
  ['login', '#/login'],
  ['community', '#/community'],
  ['goods', '#/goods'],
  ['publish', '#/publish'],
  ['messages', '#/messages'],
  ['notifications', '#/notifications'],
  ['mine', '#/mine'],
  ['wallet', '#/wallet'],
  ['my-tasks', '#/my-tasks'],
  ['ai-search', '#/ai-search'],
  ['ai-tangdou', '#/ai-tangdou'],
  ['news', '#/news'],
  ['money', '#/money'],
  ['about', '#/about'],
  ['ai-history', '#/ai-history'],
]

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  await page.addInitScript(() => { try { localStorage.setItem('zex:skipSplash', '1') } catch (e) {} })

  const results = []
  for (const [name, hash] of ROUTES) {
    const consoleErrors = []
    const pageErrors = []
    const failed = []
    let respBytes = 0, respCount = 0
    const onConsole = m => { if (m.type() === 'error') consoleErrors.push(m.text()) }
    const onPageErr = e => pageErrors.push(e.message)
    const onResp = r => { respCount++; const len = parseInt(r.headers()['content-length'] || '0', 10) || 0; respBytes += len; if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(0, 80)}`) }
    const onReqFail = r => failed.push(`FAIL ${r.url().slice(0, 80)} :: ${r.failure()?.errorText}`)
    page.on('console', onConsole)
    page.on('pageerror', onPageErr)
    page.on('response', onResp)
    page.on('requestfailed', onReqFail)

    const t0 = Date.now()
    let navOk = true, navErr = ''
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => { navOk = false; navErr = e.message })
    let ready = 'timeout'
    try { await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 30, { timeout: 20000 }); ready = 'ok' } catch {}
    const domReady = Date.now() - t0
    // 额外等待让数据/图片加载
    await page.waitForTimeout(1500)
    const fullTime = Date.now() - t0
    const title = await page.title().catch(() => '')
    const bodyLen = await page.evaluate(() => document.body ? document.body.innerText.trim().length : 0).catch(() => 0)
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false }).catch(() => {})

    results.push({
      name, hash, navOk, navErr: navErr.slice(0, 120), ready,
      domReadyMs: domReady, fullTimeMs: fullTime, bodyLen,
      consoleErrors: consoleErrors.length, consoleErrSamples: consoleErrors.slice(0, 3),
      pageErrors: pageErrors.length, pageErrSamples: pageErrors.slice(0, 3),
      failedReq: failed.length, failedSamples: failed.slice(0, 5),
      respCount, respKb: +(respBytes / 1024).toFixed(1),
    })
    page.off('console', onConsole); page.off('pageerror', onPageErr); page.off('response', onResp); page.off('requestfailed', onReqFail)
    console.log(`[${name}] ready=${ready} dom=${domReady}ms body=${bodyLen}ch err=${consoleErrors.length + pageErrors.length} fail=${failed.length} kb=${results[results.length-1].respKb}`)
  }

  await browser.close()
  fs.writeFileSync(path.join(__dirname, 'smoke-report.json'), JSON.stringify(results, null, 2))
  console.log('\n=== SUMMARY ===')
  const totalErr = results.reduce((s, r) => s + r.consoleErrors + r.pageErrors, 0)
  const totalFail = results.reduce((s, r) => s + r.failedReq, 0)
  console.log('routes:', results.length, '| totalConsole+PageErrors:', totalErr, '| totalFailedReq:', totalFail)
  console.log('report -> qa/smoke-report.json')
})().catch(e => { console.error('FATAL', e); process.exit(1) })
