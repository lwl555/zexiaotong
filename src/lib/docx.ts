import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'

// 极简 Markdown → Word 转换（够用即可）：
// 支持 #/##/### 标题、-/* 无序列表、===字段名=== 分隔标记（当作二级标题）、空行分段。
function markdownToDocx(content: string): Paragraph[] {
  const lines = content.split('\n')
  const out: Paragraph[] = []

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) continue

    // ===字段名===
    const fieldMatch = line.match(/^===?\s*(.+?)\s*===?$/)
    if (fieldMatch) {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: fieldMatch[1], bold: true })]
        })
      )
      continue
    }

    if (line.startsWith('### ')) {
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(line.slice(4))] }))
      continue
    }
    if (line.startsWith('## ')) {
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(line.slice(3))] }))
      continue
    }
    if (line.startsWith('# ')) {
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(line.slice(2))] }))
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      out.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun(line.replace(/^[-*]\s+/, ''))]
        })
      )
      continue
    }

    out.push(new Paragraph({ children: [new TextRun(line)] }))
  }
  return out
}

/** 生成并下载 Word 文档。 */
export async function exportDocx(filename: string, title: string, markdown: string): Promise<void> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title, bold: true })] }),
          ...markdownToDocx(markdown)
        ]
      }
    ]
  })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
