/**
 * 共享 Markdown 渲染（轻量版）
 * - 支持 ```代码块```、| 表格 |、# 标题、- 列表
 * - 行内 **加粗** 与 http(s) 图片链接
 * - 用于在聊天气泡中安全渲染后端模型输出
 */
import type { JSX } from 'react'

export function renderMarkdown(text: string): JSX.Element[] {
  if (!text) return []
  const lines = text.split('\n')
  const elements: JSX.Element[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].replace(/\r$/, '')

    if (!line.trim()) { i++; continue }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]); i++
      }
      i++
      elements.push(
        <div key={`c-${i}`} className="md-codeblock">
          {lang && <div className="md-codeblock-lang">{lang}</div>}
          <pre className="md-codeblock-pre"><code>{buf.join('\n')}</code></pre>
        </div>
      )
      continue
    }

    if (line.trim().startsWith('|')) {
      const tableRows: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableRows.push(lines[i].trim()); i++
      }
      if (tableRows.length >= 2) {
        const headerRow = tableRows[0]
        const bodyRows = tableRows.slice(2)
        const parseRow = (r: string) => r.split('|').filter(c => c.trim() !== '').map(c => c.trim())
        const headers = parseRow(headerRow)
        elements.push(
          <div key={`t-${i}`} className="md-table-wrap">
            <table className="md-table">
              <thead>
                <tr>
                  {headers.map((h, j) => <th key={j}>{inlineRender(h)}</th>)}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => {
                  const cells = parseRow(row)
                  return (
                    <tr key={ri}>
                      {cells.map((c, ci) => <td key={ci}>{inlineRender(c)}</td>)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
        continue
      }
    }

    const hMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (hMatch) {
      const level = hMatch[1].length
      const Tag = `h${level}` as keyof JSX.IntrinsicElements
      const size = level === 1 ? 17 : level === 2 ? 15 : 14
      elements.push(<Tag key={`h-${i}`} className="md-h" style={{ fontSize: size }}>{inlineRender(hMatch[2])}</Tag>)
      i++
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, '')); i++
      }
      elements.push(
        <ul key={`u-${i}`} className="md-ul">
          {items.map((item, j) => <li key={j}>{inlineRender(item)}</li>)}
        </ul>
      )
      continue
    }

    elements.push(<p key={`p-${i}`} className="md-p">{inlineRender(line)}</p>)
    i++
  }
  return elements
}

export function inlineRender(text: string): JSX.Element[] {
  if (!text) return [<span key="0"></span>]
  // 先按 **xx** 切分
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/)
    if (m) return <strong key={i} className="md-strong">{m[1]}</strong>
    if (!p) return null
    // 检测内联图片 URL
    const urlMatch = p.match(/(https?:\/\/[^\s]+\.(?:jpe?g|png|webp|gif)(?:\?[^\s]*)?)/i)
    if (urlMatch) {
      const before = p.slice(0, urlMatch.index)
      const after = p.slice((urlMatch.index || 0) + urlMatch[0].length)
      return <span key={i}>
        {before}
        <img
          src={urlMatch[1]}
          alt=""
          className="md-img"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
        {after}
      </span>
    }
    return <span key={i}>{p}</span>
  }).filter(Boolean) as JSX.Element[]
}

/** 纯文本预览（前 60 字，用于会话列表预览） */
export function previewText(text: string, max = 60): string {
  return text.replace(/\s+/g, ' ').slice(0, max)
}
