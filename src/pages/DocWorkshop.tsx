import { useState } from 'react'
import AIChat from '../components/AIChat'
import { type ThemeKey } from '../components/Report'

// 文档工坊 → 实时资讯台：从「表单 + 结果面板」改为微信聊天气泡（复用 AIChat）。
// 四个视角（学校/就业/生活学习/各省通知）作为子频道 channel 切换，会话按 channel 隔离、可分别接着聊。
const INFO_PROMPT = `你是择校通实时资讯助手。用户给出一个关键词（学校 / 专业 / 行业 / 城市 / 省份通知等）。请基于已检索到的最新公开资料，用清晰、有颗粒度的中文输出该视角下的关键信息摘要。
要求：
① 优先采信检索资料中的具体数字、时间、政策原文，并在关键事实后用【资料·来源·时间】标注；
② 用 ===板块名=== 分板块（如「核心信息」「最新动态」「数据明细」「重点提醒」），板块之间不漏；
③ 最关键的数字 / 结论 / 风险点用 **双星号** 包裹（前端自动加粗标红）；
④ 凡无法从检索或自身知识确认的事实写「暂无法确认」，绝不编造；
⑤ 语调直接、接地气，像过来人给建议。`

const MODES = [
  {
    key: 'school',
    label: '学校信息',
    theme: 'school' as ThemeKey,
    prompt: '请侧重「院校/专业」视角：办学层次、排名、招生与录取、保研就业、食宿生活等关键信息。',
    placeholder: '输入学校或专业，如：清华大学 / 计算机',
    examples: ['清华大学', '四川大学', '计算机专业', '深圳大学']
  },
  {
    key: 'job',
    label: '就业信息',
    theme: 'by-city' as ThemeKey,
    prompt: '请侧重「就业/求职」视角：行业前景、薪资行情、招聘规模、代表企业、入行门槛与避雷点。',
    placeholder: '输入行业或岗位，如：人工智能 / 程序员',
    examples: ['人工智能行业', '新能源汽车', '成都程序员薪资', '教师编制']
  },
  {
    key: 'life',
    label: '生活学习',
    theme: 'by-city' as ThemeKey,
    prompt: '请侧重「生活与学习」视角：城市生活成本、租房物价、校园食宿、学习环境与通勤等真实细节。',
    placeholder: '输入城市或话题，如：成都生活成本',
    examples: ['北京生活成本', '大学宿舍条件', '广州租房', '考研自习环境']
  },
  {
    key: 'notice',
    label: '各省通知',
    theme: 'school' as ThemeKey,
    prompt: '请侧重「各省招生/政策通知」视角：高考安排、志愿填报时间、招生计划、分数线公布、政策变动等，并标注发布时间与来源。',
    placeholder: '输入省份+年份，如：广东省2026高考',
    examples: ['广东省2026高考通知', '河南省志愿填报时间', '江苏省招生计划', '浙江省分数线']
  }
] as const

type ModeKey = (typeof MODES)[number]['key']

export default function DocWorkshop() {
  const [mode, setMode] = useState<ModeKey>('school')
  const cur = MODES.find((m) => m.key === mode)!

  return (
    <>
      <div className="page-head">
        <h2>文档工坊</h2>
        <p>输入学校 / 就业 / 生活学习 / 各省通知相关关键词，平台实时检索最新公开资料并由 AI 整理成清晰信息——查动态、政策与真实资料，辅助你做决策。</p>
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
        appName="文档工坊"
        systemPrompt={`${INFO_PROMPT}\n\n视角要求：${cur.prompt}`}
        placeholder={cur.placeholder}
        autoSearch
        theme={cur.theme}
        pageKey="document-workshop"
        channel={mode}
        exportable
        exportName={`文档工坊-${cur.label}`}
        exportTitle={`文档工坊 · ${cur.label}`}
        examples={cur.examples}
        followups={[
          '这些信息的来源和发布时间是？',
          '还有哪些同类学校 / 城市值得对比？',
          '最新的政策变动对我有什么影响？'
        ]}
      />
    </>
  )
}
