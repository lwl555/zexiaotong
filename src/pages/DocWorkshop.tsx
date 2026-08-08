import { useState } from 'react'
import { agnesChat } from '../lib/agnes'
import { PROMPT_DOC_WORKSHOP, PROMPT_EMPHASIS } from '../lib/prompts'
import { renderReport } from '../components/Report'
import { exportDocx } from '../lib/docx'
import { addQuery, newId } from '../lib/history'

export default function DocWorkshop() {
  const [req, setReq] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [title, setTitle] = useState('')

  async function generate() {
    if (!req.trim() || loading) return
    setError('')
    setLoading(true)
    setResult('')
    try {
      const { content: reply } = await agnesChat(
        [
          { role: 'system', content: PROMPT_DOC_WORKSHOP + '\n\n' + PROMPT_EMPHASIS },
          { role: 'user', content: req }
        ],
        { maxTokens: 4096, webSearch: true }
      )
      setResult(reply)
      addQuery({
        id: newId(),
        pageKey: 'document-workshop',
        channel: 'doc',
        pageLabel: '文档工坊',
        question: req,
        answer: reply,
        search: null,
        image: null,
        createdAt: Date.now()
      })
      // 尝试从首行 # 标题取文档名
      const firstHeading = reply.match(/^#\s+(.+)$/m)
      setTitle(firstHeading ? firstHeading[1] : '文档工坊导出')
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  async function exportWord() {
    if (!result) return
    await exportDocx(title || '文档工坊导出', title || '文档工坊导出', result)
  }

  return (
    <>
      <div className="page-head">
        <h2>文档工坊</h2>
        <p>告诉 AI 你要什么文档（院校分析报告 / 求职简历 / 避雷清单），它生成内容，你一键导出 Word——无需安装 Office。</p>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-body">
          <div className="field" style={{ marginBottom: 12 }}>
            <label>你要生成什么文档？附上关键信息</label>
            <textarea
              value={req}
              style={{ minHeight: 120 }}
              placeholder={'例如：帮我写一份「某某大学」的院校分析报告，我是广东物理类考生580分，意向计算机专业；\n或者：帮我写一份求职简历，姓名张三，计算机专业应届生，会 React/Python，有一段实习。'}
              onChange={(e) => setReq(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={loading || !req.trim()}>
            {loading ? '生成中…' : 'AI 生成文档'}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="who">生成结果</span>
          {loading && <span className="meta">· 生成中…</span>}
        </div>
        <div className="panel-body">
          {!result && !loading && !error && (
            <div className="note">在上方描述需求，AI 生成后这里显示，可直接「导出 Word」。</div>
          )}
          {loading && (
            <div className="loading">
              <span className="spinner" /> 正在撰写…
            </div>
          )}
          {error && <div className="err">出错了：{error}</div>}
          {result && (
            <>
              <div className="report theme-school">{renderReport(result, 'school')}</div>
              <div className="toolbar">
                <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(result).catch(() => {})}>
                  复制
                </button>
                <button className="btn btn-primary btn-sm" onClick={exportWord}>
                  导出 Word
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
