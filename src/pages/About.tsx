import {
  PageHeader,
  SectionLabel,
  HardCard,
  INK,
  MUTED,
  ACCENT,
  HAIR,
  FONT,
} from '../components/Editorial'

export default function About() {
  return (
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader
        eyebrow="About"
        title="关于我们"
        desc="只说大实话、不粉饰、不回避、不绕弯子——这是「择校通」从第一天起就没改过的原则。"
      />

      <HardCard style={{ marginBottom: 18 }}>
        <SectionLabel label="我们做什么" />
        <p style={{ fontFamily: FONT, fontSize: 15, color: INK, lineHeight: 1.75, margin: '0 0 12px' }}>
          <b>择校通</b> 是一个面向高考家庭、在校生与求职者的“AI 工具集合站”。我们不生产新闻，只把
          <b style={{ color: ACCENT }}>【联网实时检索到的真实数据】</b>与 <b style={{ color: ACCENT }}>【AI 自身知识的对比与整理】</b>揉在一起，呈现最直接、最能用的回答。
        </p>
        <p style={{ fontFamily: FONT, fontSize: 15, color: INK, lineHeight: 1.75, margin: 0 }}>
          我们的工具覆盖选学校、按城市找工作、查公司、做文档、记录避雷清单、收集搞钱项目——你能在这里一次做完所有择校 / 求职相关的事，不必再开十几个标签页拼凑信息。
        </p>
      </HardCard>

      <HardCard style={{ marginBottom: 18 }}>
        <SectionLabel label="我们的原则" />
        <ul style={{ paddingLeft: 18, lineHeight: 1.95, fontFamily: FONT, fontSize: 15, color: INK, margin: 0 }}>
          <li><b style={{ color: ACCENT }}>只说大实话</b> —— 不为了流量写“考上就稳了”“年薪百万”之类的废话。</li>
          <li><b style={{ color: ACCENT }}>事实底座 100% 来自联网检索，AI 仅做组织与对比（约 50% 附加值）</b> —— 凡事实，必标来源；凡 AI 自己的判断，必标“AI 整理”。</li>
          <li><b style={{ color: ACCENT }}>查不到的标“暂无法确认”</b> —— 绝不编造比例、人数、分数线、薪资。</li>
          <li><b style={{ color: ACCENT }}>多轮对话与历史</b> —— 支持上下文，接着聊，永远在你手边。</li>
        </ul>
      </HardCard>

      <HardCard style={{ borderColor: HAIR, boxShadow: 'none' }}>
        <SectionLabel label="关于数据" />
        <p style={{ fontFamily: FONT, fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.75 }}>
          AI 基于公开信息与模型知识作答，<b style={{ color: INK }}>未必是最新实时数据</b>。
          涉及择校、求职、搞钱等重大决策，请以官方招生网、企业官方信息与实地核实为准。
        </p>
      </HardCard>
    </div>
  )
}
