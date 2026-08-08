import { ReactNode } from 'react'

// 三种业务主题色：查院校=靛蓝，按城市找工作=蓝，查公司=紫。
export type ThemeKey = 'school' | 'by-city' | 'by-company'

type Cat = 'adv' | 'dis' | 'hl' | 'key' | 'neutral'

const CAT_LABEL: Record<Exclude<Cat, 'neutral'>, string> = {
  adv: '优点',
  dis: '缺点',
  hl: '亮点',
  key: '重点'
}

// 按板块标题的语义归到颜色分类
function classifySection(title: string): Cat {
  if (/优点|优势|长处|利好|加分|值得/.test(title)) return 'adv'
  if (/缺点|劣势|不足|坑|雷|避雷/.test(title)) return 'dis'
  if (/亮点|好点|推荐/.test(title)) return 'hl'
  if (/重点|关键|提醒|注意|警告|务必/.test(title)) return 'key'
  return 'neutral'
}

// 按列表项句首标签归到颜色分类（支持【优点】与 优点：两种写法）
function classifyItem(line: string): Cat | null {
  if (/^(【)?(优点|优势|长处|利好|加分|值得)(】)?[：:]/.test(line)) return 'adv'
  if (/^(【)?(缺点|劣势|不足|坑|雷|避雷)(】)?[：:]/.test(line)) return 'dis'
  if (/^(【)?(亮点|好点|推荐)(】)?[：:]/.test(line)) return 'hl'
  if (/^(【)?(重点|关键|提醒|注意|警告|务必)(】)?[：:]/.test(line)) return 'key'
  return null
}

function stripTag(line: string): string {
  return line.replace(/^(【)?(优点|优势|长处|利好|加分|值得|缺点|劣势|不足|坑|雷|避雷|亮点|好点|推荐|重点|关键|提醒|注意|警告|务必)(】)?[：:]\s*/, '')
}

function renderBody(body: string[], si: number): ReactNode {
  const out: ReactNode[] = []
  let para: string[] = []
  const flush = (k: number) => {
    if (para.length) {
      out.push(
        <p key={`p${si}-${k}`} className="rep-p">
          {para.join('\n')}
        </p>
      )
      para = []
    }
  }
  body.forEach((raw, i) => {
    const line = raw.replace(/\r$/, '').trim()
    if (!line) {
      flush(i)
      return
    }
    const h = line.match(/^(#{1,3})\s+(.+)$/)
    if (h) {
      flush(i)
      out.push(
        <div key={`h${si}-${i}`} className="rep-sub">
          {h[2]}
        </div>
      )
      return
    }
    const b = line.match(/^[-*]\s+(.*)$/)
    if (b) {
      flush(i)
      const item = b[1]
      const cat = classifyItem(item)
      const showCat = cat && cat !== 'neutral' ? cat : null
      out.push(
        <div key={`i${si}-${i}`} className={`rep-item${showCat ? ' cat-' + showCat : ''}`}>
          {showCat && <span className={`rep-chip cat-${showCat}`}>{CAT_LABEL[showCat]}</span>}
          <span className="rep-item-text">{stripTag(item)}</span>
        </div>
      )
      return
    }
    para.push(line)
  })
  flush(body.length)
  return out
}

export function renderReport(text: string, theme: ThemeKey = 'school'): ReactNode {
  const lines = text.split('\n')
  const sections: { title: string; cat: Cat; body: string[] }[] = []
  let cur: { title: string; cat: Cat; body: string[] } | null = null
  const lead: string[] = []

  const pushCur = () => {
    if (cur && (cur.body.length || cur.title)) sections.push(cur)
  }

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    const f = line.match(/^===?\s*(.+?)\s*===?$/)
    if (f) {
      pushCur()
      const title = f[1].trim()
      cur = { title, cat: classifySection(title), body: [] }
      continue
    }
    if (!cur) {
      lead.push(line)
      continue
    }
    cur.body.push(line)
  }
  pushCur()

  const blocks: ReactNode[] = []
  const leadText = lead.join('\n').trim()
  if (leadText) {
    blocks.push(
      <p key="lead" className="rep-lead">
        {leadText}
      </p>
    )
  }

  sections.forEach((s, si) => {
    blocks.push(
      <section key={`s${si}`} className={`rep-section cat-${s.cat}`}>
        <div className="rep-section-title">{s.title}</div>
        <div className="rep-section-body">{renderBody(s.body, si)}</div>
      </section>
    )
  })

  return <div className={`report theme-${theme}`}>{blocks}</div>
}
