export default function About() {
  return (
    <>
      <div className="page-head">
        <h2>关于我们</h2>
        <p>只说大实话、不粉饰、不回避、不绕弯子——这是「择校通」从第一天起就没改过的原则。</p>
      </div>

      <div className="panel" style={{ padding: 22, marginBottom: 18 }}>
        <h3 style={{ marginTop: 0, fontFamily: 'var(--serif)' }}>我们做什么</h3>
        <p>
          <b>择校通</b> 是一个面向高考家庭、在校生与求职者的"AI 工具集合站"。我们不生产新闻，只把
          <b>【联网实时检索到的真实数据】</b>与 <b>【AI 自身知识的对比与整理】</b>揉在一起，呈现最直接、最能用的回答。
        </p>
        <p>
          我们的工具覆盖选学校、按城市找工作、查公司、做文档、记录避雷清单、收集搞钱项目——你能在这里一次做完所有择校 / 求职相关的事，不必再开十几个标签页拼凑信息。
        </p>
      </div>

      <div className="panel" style={{ padding: 22, marginBottom: 18 }}>
        <h3 style={{ marginTop: 0, fontFamily: 'var(--serif)' }}>我们的原则</h3>
        <ul style={{ paddingLeft: 18, lineHeight: 1.9 }}>
          <li><b>只说大实话</b> —— 不为了流量写"考上就稳了""年薪百万"之类的废话。</li>
          <li><b>联网与 AI 整理各占一半</b> —— 凡事实，必标来源；凡 AI 自己的判断，必标"AI 整理"。</li>
          <li><b>查不到的标"暂无法确认"</b> —— 绝不编造比例、人数、分数线、薪资。</li>
          <li><b>多轮对话与历史</b> —— 支持上下文，接着聊，永远在你手边。</li>
        </ul>
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <h3 style={{ marginTop: 0, fontFamily: 'var(--serif)' }}>关于数据</h3>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          AI 基于公开信息与模型知识作答，<b>未必是最新实时数据</b>。
          涉及择校、求职、搞钱等重大决策，请以官方招生网、企业官方信息与实地核实为准。
        </p>
      </div>
    </>
  )
}
