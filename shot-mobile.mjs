import { chromium } from 'playwright'

const base = 'https://lwl555.github.io/zexiaotong/#'
const shots = [
  ['home', '/'],
  ['mine', '/mine'],
  ['community', '/community'],
  ['wallet', '/wallet'],
  ['settings', '/settings'],
]

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49',
})
const page = await ctx.newPage()

// 预置 localStorage 跳过 splash 守卫
await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.evaluate(() => {
  localStorage.setItem('zex:skipSplash', '1')
  localStorage.setItem('zex:seenSplash', '1')
})

for (const [name, path] of shots) {
  try {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 30000 })
    // 跳过 splash 重定向等待
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `shot-m-${name}.png`, fullPage: false })
    console.log('ok', name, '->', page.url())
  } catch (e) {
    console.log('fail', name, e.message.slice(0, 100))
    try { await page.screenshot({ path: `shot-m-${name}.png` }) } catch {}
  }
}
await browser.close()
console.log('DONE')
