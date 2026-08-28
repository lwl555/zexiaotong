// 聚焦诊断：访问 wallet/publish，捕获完整 pageerror+URL+body
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = 'http://127.0.0.1:4173/zexiaotong/'
const TEST = JSON.parse(fs.readFileSync(path.join(__dirname, 'testuser.json'), 'utf8'))

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  })
  const page = await ctx.newPage()
  await page.addInitScript((u) => {
    try { localStorage.setItem('zex:skipSplash', '1'); localStorage.setItem('zex:user_id', u) } catch (e) {}
  }, TEST.id)

  const dump = async (label) => {
    const info = await page.evaluate(() => ({
      href: location.href,
      hash: location.hash,
      body: (document.body ? document.body.innerText : '').slice(0, 400),
    })).catch(e => ({ err: e.message }))
    console.log(`\n--- ${label} ---`)
    console.log(JSON.stringify(info, null, 2))
  }

  page.on('pageerror', e => {
    console.log(`[PAGEERROR] name=${e.name} msg="${e.message}" stack=${(e.stack||'').slice(0, 600)}`)
  })
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`[CONSOLE ${m.type()}] ${m.text().slice(0, 220)}`)
  })

  await page.goto(BASE + '#/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('home goto err', e.message))
  await page.waitForTimeout(3000)
  await dump('after-home')

  await page.goto(BASE + '#/wallet', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('wallet goto err', e.message))
  await page.waitForTimeout(3000)
  await dump('after-wallet')
  await page.screenshot({ path: path.join(__dirname, 'shots', 'diag-wallet.png') })

  await page.goto(BASE + '#/publish', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('publish goto err', e.message))
  await page.waitForTimeout(3000)
  await dump('after-publish')
  await page.screenshot({ path: path.join(__dirname, 'shots', 'diag-publish.png') })

  await browser.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })