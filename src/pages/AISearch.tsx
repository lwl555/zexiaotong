import { useState, useEffect } from 'react'
import AIChat from '../components/AIChat'
import { PROMPT_AI_SEARCH_SCHOOL, PROMPT_AI_SEARCH_BY_CITY, PROMPT_AI_SEARCH_BY_COMPANY } from '../lib/prompts'
import { consumePendingChannel } from '../lib/history'

const MODES = [
  {
    key: 'school',
    label: '查院校',
    prompt: PROMPT_AI_SEARCH_SCHOOL,
    placeholder: '输入院校名称，如：某某大学',
    ph: '指定院校，多维度拆解优缺点',
    theme: 'school' as const,
    examples: ['清华大学', '四川大学', '深圳大学', '杭州电子科技大学'],
    followups: [
      '它的保研率和就业率到底多高？',
      '宿舍和食堂条件怎么样？',
      '和同档次院校比优势在哪？',
      '这个分数段报它稳不稳？'
    ]
  },
  {
    key: 'by-city',
    label: '按城市找工作',
    prompt: PROMPT_AI_SEARCH_BY_CITY,
    placeholder: '输入城市，如：深圳',
    ph: '选择城市，列出产业与招聘实况',
    theme: 'by-city' as const,
    examples: ['深圳', '成都', '杭州', '苏州'],
    followups: [
      '这个城市哪些行业在招人？',
      '普通本科毕业大概能拿多少薪资？',
      '租房和生活成本具体多少？',
      '应届生落户难不难？'
    ]
  },
  {
    key: 'by-company',
    label: '查公司',
    prompt: PROMPT_AI_SEARCH_BY_COMPANY,
    placeholder: '输入公司名称，如：某某科技',
    ph: '指定公司，直说优缺点与坑',
    theme: 'by-company' as const,
    examples: ['字节跳动', '比亚迪', '宁德时代', '美团'],
    followups: [
      '这家公司加班和作息真实情况？',
      '校招待遇和股票期权如何？',
      '哪个部门坑最多要避开？',
      '和同体量公司比值得去吗？'
    ]
  }
] as const

type ModeKey = (typeof MODES)[number]['key']

export default function AISearch() {
  const [mode, setMode] = useState<ModeKey>('school')
  const cur = MODES.find((m) => m.key === mode)!

  // 从 URL ?tab= 或「聊天大厅 / 历史」pending channel 自动切到对应子频道
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab && MODES.some((m) => m.key === tab)) {
      setMode(tab as ModeKey)
      return
    }
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
        examples={cur.examples}
        followups={cur.followups}
      />
    </>
  )
}
