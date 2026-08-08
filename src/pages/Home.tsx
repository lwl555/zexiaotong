import { Link } from 'react-router-dom'

const toolCards = [
  { to: '/ai-search?tab=school', cls: 'school', ic: '🔍', title: '查院校', desc: '多维度拆解：数据、食堂、住宿、就业、优缺点 全摊开。' },
  { to: '/ai-search?tab=by-company', cls: 'by-company', ic: '🏢', title: '查公司', desc: '薪资结构、加班、福利、坑点 直接说不编。' },
  { to: '/ai-search?tab=by-city', cls: 'by-city', ic: '🌆', title: '按城市找工作', desc: '产业 / 薪资 / 房价 / 机会 一站说清。' },
  { to: '/ai-tutor', cls: 'tutor', ic: '🎯', title: 'AI择校导师', desc: '填分数和位次，AI 按冲稳保三档给具体推荐。' },
  { to: '/document-workshop', cls: 'workshop', ic: '📝', title: '文档工坊', desc: 'AI 一键生成报告 / 简历 / 避雷清单，导出 Word。' },
  { to: '/warnings', cls: 'warnings', ic: '⚠️', title: '避雷清单', desc: '记下学校 / 公司的真实缺点，公共看板，人人可加。' },
  { to: '/money', cls: 'money', ic: '💰', title: '搞钱项目', desc: '兼职 / 副业 / 创业 项目聚合，发现身边真实机会。' },
  { to: '/about', cls: 'about', ic: 'ℹ️', title: '关于我们', desc: '原则、数据来源、决策边界，一次说清。' }
]

const tags = [
  'AI百事通', '联网实时检索', '直白说优缺点',
  '查实习', '应届生求职', '社招跳槽',
  '按城市找工作', '真实案例', '避雷清单'
]

const scenes = [
  { ic: '🎓', t: '高考家庭', d: '分数、位次、兴趣、城市——填进来，AI 按冲稳保给出可比较的院校清单，每条都说为什么。' },
  { ic: '🏢', t: '即将入职 / 跳槽', d: '查公司值不值得去：薪资结构、五险一金、加班、部门差异，一次说清而不是套话。' },
  { ic: '🌆', t: '换城市找工作', d: '看一个城市的产业、薪资、生活成本、机会点，并和 2-3 个对标城市横向比。' },
  { ic: '📚', t: '在校生选课 / 转专业', d: '了解学校的真实口碑、食宿、保研与就业去向——哪些数字是注水、哪些是含金量。' },
  { ic: '📝', t: '做报告 / 写文档', d: '把零散的 AI 输出和联网事实直接生成一份可下载 Word 的报告或简历。' },
  { ic: '⚠️', t: '记录避雷', d: '把自己的踩坑 / 同学的吐槽一条条加到避雷清单，公共看板累积价值。' }
]

const features = [
  { f: '联网实时检索', yt: '是', sd: '网页 / 新闻 / 维基 / Tavily', ab: '是' },
  { f: 'AI 综合整理与对比', yt: '是', sd: '横向对比 + 同档定位', ab: '是' },
  { f: '标注"事实 / AI 整理"', yt: '是', sd: '每条结论分明', ab: '是' },
  { f: '多轮上下文 + 历史', yt: '是', sd: '接着聊，不重问', ab: '是' },
  { f: '导出 Word', yt: '部分', sd: '报告 / 简历 / 清单', ab: '—' },
  { f: '标签 / 分类', yt: '优/缺/亮/重', sd: '颜色自动着色', ab: '是' },
  { f: '匿名可用', yt: '是', sd: '不需要登录', ab: '是' },
  { f: '免费', yt: '是', sd: 'Supabase 免费档', ab: '是' }
]

export default function Home() {
  return (
    <>
      {/* 深紫 Hero */}
      <section className="hero">
        <span className="deco d1" />
        <span className="deco d2" />
        <span className="deco d3" />
        <span className="deco d4" />
        <span className="deco d5" />

        <span className="badge">
          <span className="bolt">⚡</span>
          全面改版 · 新版本
        </span>
        <h1>高校选择工具集</h1>
        <div className="subt">
          <span className="item">AI百事通</span>
          <span className="item">AI择校导师</span>
          <span className="item">文档工坊</span>
          <span className="item">搞钱项目</span>
        </div>
        <p>
          所有高校选择与摘钱相关工具一目了然。选学校、问导师、做文档、找项目，点一下立刻使用。
        </p>
      </section>

      {/* 紫色功能标签条 */}
      <div className="feature-bar">
        {tags.map((t) => (
          <span className="ic" key={t}>{t}</span>
        ))}
      </div>

      {/* 实时数据条 */}
      <div className="stats" style={{ marginTop: 28 }}>
        <div className="stat"><div className="n">8+</div><div className="lbl">在线 AI 工具</div></div>
        <div className="stat"><div className="n">50%</div><div className="lbl">联网事实 / 50% AI 整理</div></div>
        <div className="stat"><div className="n">5</div><div className="lbl">检索数据源</div></div>
        <div className="stat"><div className="n">7×24</div><div className="lbl">免登录可用</div></div>
      </div>

      {/* 工具卡片网格 */}
      <h2 className="section-title">
        工具一栏 <span className="sub">点开即用 · 所有工具免费</span>
      </h2>
      <div className="tool-grid">
        {toolCards.map((c) => (
          <Link key={c.title} to={c.to} className={`tool-card ${c.cls}`}>
            <div className="ic">{c.ic}</div>
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
            <span className="arrow">进入 →</span>
          </Link>
        ))}
      </div>

      {/* 横向对比表 */}
      <h2 className="section-title">
        工具能力 <span className="sub">本站 vs 普通 AI vs 普通搜索</span>
      </h2>
      <div className="compare">
        <table>
          <thead>
            <tr>
              <th>能力</th>
              <th>本站 · 择校通</th>
              <th>普通 AI</th>
              <th>普通搜索</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.f}>
                <td>{f.f}</td>
                <td>
                  {f.yt === '是' ? <span className="pill-yes">✓ 已支持</span>
                  : f.yt === '部分' ? <span className="pill-mid">部分支持</span>
                  : f.yt}
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{f.sd}</div>
                </td>
                <td>
                  {f.ab === '是' ? <span className="pill-mid">部分</span>
                  : f.ab === '—' ? '—'
                  : <span className="pill-no">✗ 不支持</span>}
                </td>
                <td>
                  <span className="pill-no">✗ 不支持</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 场景说明 */}
      <h2 className="section-title">
        谁在用 <span className="sub">覆盖不同人群的真实场景</span>
      </h2>
      <div className="scene-grid">
        {scenes.map((s) => (
          <div className="scene" key={s.t}>
            <h4>{s.ic} {s.t}</h4>
            <p>{s.d}</p>
          </div>
        ))}
      </div>

      {/* 免责声明 */}
      <div className="disclaimer">
        <b>关于数据：</b>答案 = <b>联网检索到的真实事实（约 50%）</b> + <b>AI 自身知识的整理与对比（约 50%）</b>。
        凡事实均标注来源，凡 AI 自己的判断均标注"AI 整理"，查不到的标"暂无法确认"，绝不编造。
        涉及择校、求职、搞钱等重大决策，请以官方招生网、企业官方信息与实地核实为准。
      </div>
    </>
  )
}
