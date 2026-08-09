import { useState } from 'react'
import { agnesChat } from '../lib/agnes'
import { PROMPT_AI_TUTOR, PROMPT_EMPHASIS, SYSTEM_IDENTITY } from '../lib/prompts'
import { renderReport } from '../components/Report'
import { exportDocx } from '../lib/docx'
import { addQuery, newId } from '../lib/history'

const provinces = ['北京', '上海', '广东', '江苏', '浙江', '山东', '河南', '河北', '四川', '湖北', '湖南', '福建', '其他']
const kl = ['理科', '文科', '物理类', '历史类', '综合改革']
const factors = ['学校层次/名气', '专业就业前景', '城市位置', '录取概率(稳)', '深造/考研', '性价比']
const batches = ['本科一批', '本科二批', '特控线（强基/综评）', '专科批', '不分批次（新高考）']
const adjusts = ['服从调剂', '不服从调剂', '视情况而定']

export default function AITutor() {
  const [form, setForm] = useState({
    province: '广东',
    kl: '物理类',
    score: '',
    rank: '',
    batch: '本科一批',
    adjust: '服从调剂',
    cities: '',
    majors: '',
    factor: '专业就业前景',
    extra: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit() {
    if (!form.score.trim() || loading) return
    setError('')
    setLoading(true)
    setResult('')
    const user = `省份：${form.province}\n科类：${form.kl}\n高考分数：${form.score}\n全省位次：${form.rank || '未知'}\n填报批次：${form.batch}\n是否服从调剂：${form.adjust}\n意向城市：${form.cities || '不限'}\n意向专业方向：${form.majors || '不限'}\n优先考虑因素：${form.factor}\n补充说明：${form.extra || '无'}`
    try {
      const { content: reply, search } = await agnesChat(
        [
          { role: 'system', content: `${SYSTEM_IDENTITY}\n\n${PROMPT_AI_TUTOR}\n\n${PROMPT_EMPHASIS}` },
          { role: 'user', content: user }
        ],
        { maxTokens: 8000, autoSearch: true }
      )
      setResult(reply)
      addQuery({
        id: newId(),
        pageKey: 'ai-tutor',
        channel: 'tutor',
        pageLabel: '择校导师',
        question: `高考评估：${form.province} ${form.kl} ${form.score}分（位次${form.rank || '未知'}）意向${form.cities || '不限'}/${form.majors || '不限'}`,
        answer: reply,
        search: search ?? null,
        image: null,
        createdAt: Date.now()
      })
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <h2>AI择校导师</h2>
        <p>告诉我你的分数、位次和意向，AI 帮你分析全省排名、匹配院校、推荐专业——只做推荐，选择权在你。</p>
      </div>

      <div className="split">
        <div className="panel" style={{ padding: 18 }}>
          <div className="field">
            <label>高考省份</label>
            <select value={form.province} onChange={(e) => set('province', e.target.value)}>
              {provinces.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>科类</label>
            <select value={form.kl} onChange={(e) => set('kl', e.target.value)}>
              {kl.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="row">
            <div className="field">
              <label>高考分数 *</label>
              <input value={form.score} inputMode="numeric" placeholder="如 580" onChange={(e) => set('score', e.target.value)} />
            </div>
            <div className="field">
              <label>全省位次/排名</label>
              <input value={form.rank} inputMode="numeric" placeholder="如 25000" onChange={(e) => set('rank', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>意向城市（逗号分隔）</label>
            <input value={form.cities} placeholder="如 广州,深圳" onChange={(e) => set('cities', e.target.value)} />
          </div>
          <div className="field">
            <label>意向专业方向（逗号分隔）</label>
            <input value={form.majors} placeholder="如 计算机,电子信息" onChange={(e) => set('majors', e.target.value)} />
          </div>
          <div className="row">
            <div className="field">
              <label>填报批次</label>
              <select value={form.batch} onChange={(e) => set('batch', e.target.value)}>
                {batches.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>是否服从调剂</label>
              <select value={form.adjust} onChange={(e) => set('adjust', e.target.value)}>
                {adjusts.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>优先考虑因素</label>
            <select value={form.factor} onChange={(e) => set('factor', e.target.value)}>
              {factors.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>其他特殊要求或补充说明</label>
            <textarea value={form.extra} placeholder="如 想离家近、不学医、接受调剂…" onChange={(e) => set('extra', e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={submit} disabled={loading || !form.score.trim()}>
            {loading ? '评估中…' : '开始评估 & 获取推荐'}
          </button>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="who">冲稳保推荐</span>
            {loading && <span className="meta">· 思考中…</span>}
          </div>
          <div className="panel-body">
            {!result && !loading && !error && (
              <div className="note">填左边表单，点「开始评估」，AI 会按冲 / 稳 / 保三档给院校与专业推荐。</div>
            )}
            {loading && (
              <div className="loading">
                <span className="spinner" /> 正在分析位次与匹配院校…
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
                  <button className="btn btn-primary btn-sm" onClick={() => exportDocx('择校方案', '择校导师推荐', result)}>
                    导出 Word
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={submit} disabled={loading || !form.score.trim()}>
                    换一批推荐
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
