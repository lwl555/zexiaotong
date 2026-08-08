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

function renderInline(text: string): ReactNode[] {
  if (!text) return []
  // 解析 **关键短语** → 红色加粗（重要信息自动标红）。其余按原样渲染。
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  const out: ReactNode[] = []
  parts.forEach((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/)
    if (m) out.push(<strong key={i} className="hot">{m[1]}</strong>)
    else if (p) out.push(<span key={i}>{p}</span>)
  })
  return out
}

// ---------- markdown 表格解析 ----------
// 识别形如：
//   | 维度 | 眉山 | 绵阳 |
//   |------|------|------|
//   | 本科 | 1 所 | 3 所 |
// 连续多行（中间空行打断），第二行必须是「分隔行」|---|---|。

function isTableRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith('|') && t.endsWith('|') && t.length > 1
}

function isTableSepRow(line: string): boolean {
  const t = line.trim()
  if (!isTableRow(t)) return false
  const cells = t.slice(1, -1).split('|')
  // 分隔行各列只允许 - = : 和空白，且至少有一个 - 或 =
  return cells.length > 0 && cells.every((c) => /^[\s:=-]+$/.test(c)) && cells.some((c) => /[-=]/.test(c))
}

function splitTableRow(line: string): string[] {
  // 去首尾 | 后按 | 切，trim 每格
  const t = line.trim()
  return t.slice(1, -1).split('|').map((c) => c.trim())
}

function tryParseTable(rows: string[]): { headers: string[]; body: string[][] } | null {
  if (rows.length < 2) return null
  if (!isTableRow(rows[0]) || !isTableSepRow(rows[1])) return null
  const headers = splitTableRow(rows[0])
  if (headers.length === 0) return null
  const body: string[][] = []
  for (let i = 2; i < rows.length; i++) {
    if (!isTableRow(rows[i])) break
    body.push(splitTableRow(rows[i]))
  }
  // 至少要有表头 + 分隔行（>=0 行数据也允许空表，但太罕见，要求 ≥1 行数据更稳）
  // 这里允许 0 行数据，保持宽容
  return { headers, body }
}

function renderTable(parsed: { headers: string[]; body: string[][] }, key: string): ReactNode {
  return (
    <div key={key} className="rep-table-wrap">
      <table className="rep-table">
        <thead>
          <tr>
            {parsed.headers.map((h, i) => (
              <th key={i}>{renderInline(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsed.body.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>{renderInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 把一组行处理为「段落 + 表格」混排的 ReactNode 数组（不含子标题/列表）。
// 用于 renderReport 的 lead 段（intro 区域）。
function renderMixedParaAndTable(lines: string[], keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  let para: string[] = []
  let tblBuf: string[] = []
  const flushPara = () => {
    if (para.length) {
      out.push(
        <p key={`${keyPrefix}-p-${out.length}`} className="rep-lead">
          {renderInline(para.join('\n'))}
        </p>
      )
      para = []
    }
  }
  const flushTable = () => {
    if (!tblBuf.length) return
    const parsed = tryParseTable(tblBuf)
    if (parsed) {
      out.push(renderTable(parsed, `${keyPrefix}-tbl-${out.length}`))
    } else {
      // 不像合法表格（如只有 1 行 |...|），降级为段落
      out.push(
        <p key={`${keyPrefix}-pf-${out.length}`} className="rep-lead">
          {renderInline(tblBuf.join('\n'))}
        </p>
      )
    }
    tblBuf = []
  }
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '').trim()
    if (!line) {
      flushPara()
      flushTable()
      continue
    }
    if (isTableRow(line)) {
      flushPara()
      tblBuf.push(line)
      continue
    }
    flushTable()
    para.push(line)
  }
  flushPara()
  flushTable()
  return out
}

function renderBody(body: string[], si: number): ReactNode {
  const out: ReactNode[] = []
  let para: string[] = []
  let tblBuf: string[] = []
  const flushPara = (k: number) => {
    if (para.length) {
      out.push(
        <p key={`p${si}-${k}`} className="rep-p">
          {renderInline(para.join('\n'))}
        </p>
      )
      para = []
    }
  }
  const flushTable = (k: number) => {
    if (!tblBuf.length) return
    const parsed = tryParseTable(tblBuf)
    if (parsed) {
      out.push(renderTable(parsed, `tbl${si}-${k}`))
    } else {
      // 降级：把累积的 | 行当段落原样输出
      out.push(
        <p key={`pf${si}-${k}`} className="rep-p">
          {renderInline(tblBuf.join('\n'))}
        </p>
      )
    }
    tblBuf = []
  }
  body.forEach((raw, i) => {
    const line = raw.replace(/\r$/, '').trim()
    if (!line) {
      flushPara(i)
      flushTable(i)
      return
    }
    // 表格行优先识别（必须在 ### 子标题、- 列表之前，避免被截胡）
    if (isTableRow(line)) {
      flushPara(i)
      tblBuf.push(line)
      return
    }
    // 表格块结束，flush
    flushTable(i)
    const h = line.match(/^(#{1,3})\s+(.+)$/)
    if (h) {
      flushPara(i)
      out.push(
        <div key={`h${si}-${i}`} className="rep-sub">
          {renderInline(h[2])}
        </div>
      )
      return
    }
    const b = line.match(/^[-*]\s+(.*)$/)
    if (b) {
      flushPara(i)
      const item = b[1]
      const cat = classifyItem(item)
      const showCat = cat && cat !== 'neutral' ? cat : null
      out.push(
        <div key={`i${si}-${i}`} className={`rep-item${showCat ? ' cat-' + showCat : ''}`}>
          {showCat && <span className={`rep-chip cat-${showCat}`}>{CAT_LABEL[showCat]}</span>}
          <span className="rep-item-text">{renderInline(stripTag(item))}</span>
        </div>
      )
      return
    }
    para.push(line)
  })
  flushPara(body.length)
  flushTable(body.length)
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

  // lead 段（intro）：支持表格 + 段落混排
  const leadBlocks = renderMixedParaAndTable(lead, 'lead')
  blocks.push(...leadBlocks)

  sections.forEach((s, si) => {
    blocks.push(
      <section key={`s${si}`} className={`rep-section cat-${s.cat}`}>
        <div className="rep-section-title">{renderInline(s.title)}</div>
        <div className="rep-section-body">{renderBody(s.body, si)}</div>
      </section>
    )
  })

  return <div className={`report theme-${theme}`}>{blocks}</div>
}