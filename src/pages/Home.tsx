import { Link } from 'react-router-dom'

const features = [
  {
    to: '/ai-search',
    ic: '🔍',
    title: 'AI百事通',
    desc: '指定任意院校/城市/公司，多维度拆解真实信息，优缺点用颜色标记，绝不粉饰。'
  },
  {
    to: '/ai-tutor',
    ic: '🎯',
    title: 'AI择校导师',
    desc: '填分数、位次、意向，AI 帮你分层推荐「冲稳保」院校与专业。'
  },
  {
    to: '/document-workshop',
    ic: '📄',
    title: '文档工坊',
    desc: 'AI 对话生成院校分析报告、求职简历、避雷清单，一键导出 Word。'
  },
  {
    to: '/warnings',
    ic: '⚠️',
    title: '避雷清单',
    desc: '记录学校/公司的真实缺点与坑，随时导出 Word 备份。'
  },
  {
    to: '/money',
    ic: '💰',
    title: '搞钱项目',
    desc: '兼职、副业、创业项目信息聚合，发现身边真实的搞钱机会。'
  },
  {
    to: '/ai-search',
    ic: '💼',
    title: '找工作',
    desc: '查实习 / 应届 / 社招，AI 分析薪资、住宿、转正率等真实情报。'
  }
]

export default function Home() {
  return (
    <>
      <section className="hero">
        <span className="tag">真实 · 直接 · 不客气</span>
        <h1>
          选学校、找工作、搞钱，
          <br />
          <span className="accent">AI 只说大实话</span>
        </h1>
        <p>不管是择校还是求职，AI 不粉饰、不回避、不绕弯子——把真实信息摊开给你看。</p>
      </section>

      <div className="grid">
        {features.map((f) => (
          <Link key={f.title} to={f.to} className="card">
            <div className="ic">{f.ic}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
            <span className="go">进入 →</span>
          </Link>
        ))}
      </div>

      <div className="disclaimer">
        <b>关于数据：</b>AI 基于公开信息与模型知识作答，未必是最新实时数据。涉及择校、求职、搞钱等重大决策，请以官方招生网、企业官方信息与实地核实为准。
      </div>
    </>
  )
}
