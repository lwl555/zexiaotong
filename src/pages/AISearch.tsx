import { useState, useEffect } from 'react'
import AIChat from '../components/AIChat'
import { PROMPT_AI_SEARCH_SCHOOL, PROMPT_AI_SEARCH_BY_CITY, PROMPT_AI_SEARCH_BY_COMPANY } from '../lib/prompts'
import { consumePendingChannel } from '../lib/history'

const MODES = [
  { key: 'school', label: '查院校', prompt: PROMPT_AI_SEARCH_SCHOOL, placeholder: '输入院校名称，如：某某大学', ph: '指定院校，多维度拆解优缺点', theme: 'school' as const },
  { key: 'by-city', label: '按城市找工作', prompt: PROMPT_AI_SEARCH_BY_CITY, placeholder: '输入城市，如：深圳', ph: '选择城市，列出产业与招聘实况', theme: 'by-city' as const },
  { key: 'by-company', label: '查公司', prompt: PROMPT_AI_SEARCH_BY_COMPANY, placeholder: '输入公司名称，如：某某科技', ph: '指定公司，直说优缺点与坑', theme: 'by-company' as const }
] as const

type ModeKey = (typeof MODES)[number]['key']

export default function AISearch() {
  const [mode, setMode] = useState<ModeKey>('school')
  const cur = MODES.find((m) => m.key === mode)!

  // 从历史「对话记录」点开某会话时，自动切到对应子频道
  useEffect(() => {
    const pc = consumePendingChannel()
    if (pc && MODES.some((m) => m.key === pc)) setMode(pc as ModeKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className="page-head">
        <h2>AI百事通</h2>
        <p>指定院校、城市或公司，AI 多维度拆解真实信息，优点 / 缺点 / 亮点 / 重点 用不同颜色标记，辅助你理性决策。对话会自动保存，可随时接着聊。</p>
      </div>

      <div className="tabs">
        {MODES.map((m) => (
          <button key={m.key} className={m.key === mode ? 'active' : ''} onClick={() => setMode(m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      <AIChat
        title={cur.label}
        systemPrompt={cur.prompt}
        placeholder={cur.placeholder}
        webSearch
        theme={cur.theme}
        pageKey="ai-search"
        channel={mode}
        exportable
        exportName={`AI百事通-${cur.label}`}
        exportTitle={`AI百事通 · ${cur.label}`}
      />
    </>
  )
}
