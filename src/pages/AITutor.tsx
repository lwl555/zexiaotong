import AIChat from '../components/AIChat'
import { PROMPT_AI_TUTOR, PROMPT_EMPHASIS } from '../lib/prompts'

// 学习导师：从「表单提交」改为微信聊天气泡（复用 AIChat，移动端 .wx 绿白气泡）。
// 把分数 / 位次 / 意向交给 AI 在对话里逐步澄清，保持与百事通一致的聊天体验。
export default function AITutor() {
  return (
    <>
      <div className="page-head">
        <h2>学习导师</h2>
        <p>把你的分数、位次、意向城市和 / 或专业告诉 AI，它按冲 / 稳 / 保三档帮你规划院校与专业——只给建议，决定权在你。对话自动保存，可随时接着聊。</p>
      </div>

      <AIChat
        title="学习导师"
        appName="学习导师"
        systemPrompt={`${PROMPT_AI_TUTOR}\n\n${PROMPT_EMPHASIS}`}
        placeholder="如：广东 物理类 580分 位次25000 想报计算机，怎么规划？"
        autoSearch
        theme="school"
        pageKey="ai-tutor"
        channel="tutor"
        exportable
        exportName="学习导师-择校规划"
        exportTitle="学习导师 · 择校规划"
        examples={[
          '广东 物理类 580分 位次25000，意向广州/深圳的计算机，怎么报？',
          '我分数刚过一本线，家里想让我学医，值不值得？',
          '文科 560分，想冲985但怕浪费分数，给个冲稳保方案',
          '浙江赋分制 620分，想学电子信息，推荐哪些学校？'
        ]}
        followups={[
          '这个方案里哪所最稳？录取概率大概多少？',
          '如果我不服从调剂，风险大不大？',
          '这些学校宿舍和食堂条件怎么样？',
          '换成同档次但性价比更高的学校有推荐吗？'
        ]}
      />
    </>
  )
}
