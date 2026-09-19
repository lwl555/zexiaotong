// 极简 Markdown → Word 转换（够用即可）：
// 支持 #/##/### 标题、-/* 无序列表、===字段名=== 分隔标记（当作二级标题）、空行分段。
//
// ⚠️ 性能约束：`docx` 是 ~500KB 的重库。这里**必须**用动态 import：
//   - 若在模块顶层 `import { Document } from 'docx'`，则任何引入本文件的页面
//     （AI 聊天 / 文档工坊 / 避雷清单 / 搞钱项目）都会被动把 docx 打进自己的
//     路由 chunk，首屏平白多下 500KB，实测白屏 5–8 秒。
//   - 改成 `await import('docx')` 后，只有用户真正点「导出 Word」时才会去拉这个
//     独立 chunk，首屏零成本。
type DocxModule = typeof import('docx')

let _docx: DocxModule | null = null
async function loadDocx(): Promise<DocxModule> {
  if (!_docx) _docx = await import('docx')
  return _docx
}

function markdownToDocx(m: DocxModule, content: string): InstanceType<DocxModule['Paragraph']>[] {
  const { Paragraph, HeadingLevel, TextRun } = m
  const lines = content.split('\n')
  const out: InstanceType<DocxModule['Paragraph']>[] = []

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

/** 生成并下载 Word 文档。首次调用时才下载 docx 库。 */
export async function exportDocx(filename: string, title: string, markdown: string): Promise<void> {
  const m = await loadDocx()
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = m
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title, bold: true })] }),
          ...markdownToDocx(m, markdown)
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
