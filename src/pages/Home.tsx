import { Link } from 'react-router-dom'
import { Search, Building2, MapPin, Radio, FileText, AlertTriangle, Coins, Info, BookOpen, Compass } from 'lucide-react'

const toolCards = [
  { to: '/ai-search?tab=school', ic: Search, title: '查院校', desc: '多维度拆解：数据、食堂、住宿、就业、优缺点 全摊开。' },
  { to: '/ai-search?tab=by-company', ic: Building2, title: '查公司', desc: '薪资结构、加班、福利、坑点 直接说不编。' },
  { to: '/ai-search?tab=by-city', ic: MapPin, title: '按城市找工作', desc: '产业 / 薪资 / 房价 / 机会 一站说清。' },
  { to: '/ai-tutor', ic: Radio, title: '实时资讯台', desc: '填分数和位次，AI 按冲稳保三档给具体推荐。' },
  { to: '/document-workshop', ic: FileText, title: '文档工坊', desc: 'AI 一键生成报告 / 简历 / 避雷清单，导出 Word。' },
  { to: '/warnings', ic: AlertTriangle, title: '避雷清单', desc: '记下学校 / 公司的真实缺点，公共看板，人人可加。' },
  { to: '/money', ic: Coins, title: '搞钱项目', desc: '兼职 / 副业 / 创业 项目聚合，发现身边真实机会。' },
  { to: '/about', ic: Info, title: '关于我们', desc: '原则、数据来源、决策边界，一次说清。' }
]

const marqueeItems = [
  '联网实时检索', 'AI 综合整理与对比', '事实 / AI 整理 双标注', '多轮上下文 + 历史',
  '导出 Word', '优 / 缺 / 亮 / 重 分类着色', '匿名可用', '完全免费'
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

const scenes = [
  { ic: null, t: '高考家庭', d: '分数、位次、兴趣、城市——填进来，AI 按冲稳保给出可比较的院校清单，每条都说为什么。' },
  { ic: Building2, t: '即将入职 / 跳槽', d: '查公司值不值得去：薪资结构、五险一金、加班、部门差异，一次说清而不是套话。' },
  { ic: MapPin, t: '换城市找工作', d: '看一个城市的产业、薪资、生活成本、机会点，并和 2-3 个对标城市横向比。' },
  { ic: BookOpen, t: '在校生选课 / 转专业', d: '了解学校的真实口碑、食宿、保研与就业去向——哪些数字是注水、哪些是含金量。' },
  { ic: null, t: '做报告 / 写文档', d: '把零散的 AI 输出和联网事实直接生成一份可下载 Word 的报告或简历。' },
  { ic: AlertTriangle, t: '记录避雷', d: '把自己的踩坑 / 同学的吐槽一条条加到避雷清单，公共看板累积价值。' }
]

export default function Home() {
  return (
    <>
      {/* 编辑式 Hero：左文右图，非对称 */}
      <section className="hero">
        <div className="hero-text">
          <div className="hero-eyebrow">择校通 · 高校与职业决策工具</div>
          <h1>选学校、挑公司，<br />我们把<span className="em">实话</span>摊在桌面上。</h1>
          <p className="hero-lead">
            不粉饰、不绕弯、不回避。关于分数、食堂、薪资、加班这些硬事实，
            一半来自联网检索的真实资料，一半来自 AI 的整理与对比——每条都标明白，哪句是事实、哪句是判断。
          </p>
          <div className="hero-cta">
            <Link to="/ai-search?tab=school" className="cta primary"><Compass size={16} strokeWidth={2} /> 开始一次查询</Link>
            <Link to="/ai-tutor" className="cta ghost">试试实时资讯台</Link>
          </div>
        </div>
        <figure className="hero-figure">
          <img
            src="https://images.pexels.com/photos/267885/pexels-photo-267885.jpeg?auto=compress&cs=tinysrgb&w=1200"
            alt="毕业生抛起学士帽"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              // Pexels 万一被 hotlink 限流，自动切到内联 SVG 占位（绝对不破图）
              const img = e.currentTarget as HTMLImageElement
              const fig = img.parentElement
              if (!fig || fig.dataset.fallback === '1') return
              fig.dataset.fallback = '1'
              img.style.display = 'none'
              fig.insertAdjacentHTML(
                'afterbegin',
                '<svg class="hero-fallback" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
                  '<defs>' +
                    '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
                      '<stop offset="0" stop-color="#7a2e0a"/>' +
                      '<stop offset="1" stop-color="#3a1606"/>' +
                    '</linearGradient>' +
                  '</defs>' +
                  '<rect width="800" height="600" fill="url(#g)"/>' +
                  // 远景楼群
                  '<g fill="#1a0a04" opacity="0.55">' +
                    '<rect x="40" y="280" width="120" height="220"/>' +
                    '<rect x="170" y="240" width="90" height="260"/>' +
                    '<rect x="270" y="260" width="100" height="240"/>' +
                    '<rect x="380" y="220" width="110" height="280"/>' +
                    '<rect x="500" y="250" width="90" height="250"/>' +
                    '<rect x="600" y="270" width="120" height="230"/>' +
                    '<rect x="730" y="240" width="70" height="260"/>' +
                  '</g>' +
                  // 楼群窗户（暖黄点光）
                  '<g fill="#f5c481" opacity="0.6">' +
                    '<rect x="55" y="310" width="6" height="6"/><rect x="70" y="310" width="6" height="6"/><rect x="85" y="310" width="6" height="6"/><rect x="100" y="310" width="6" height="6"/><rect x="115" y="310" width="6" height="6"/><rect x="130" y="310" width="6" height="6"/>' +
                    '<rect x="55" y="340" width="6" height="6"/><rect x="70" y="340" width="6" height="6"/><rect x="85" y="340" width="6" height="6"/><rect x="115" y="340" width="6" height="6"/><rect x="130" y="340" width="6" height="6"/>' +
                    '<rect x="190" y="280" width="6" height="6"/><rect x="205" y="280" width="6" height="6"/><rect x="220" y="280" width="6" height="6"/><rect x="235" y="280" width="6" height="6"/>' +
                    '<rect x="190" y="320" width="6" height="6"/><rect x="220" y="320" width="6" height="6"/><rect x="235" y="320" width="6" height="6"/>' +
                    '<rect x="395" y="260" width="6" height="6"/><rect x="410" y="260" width="6" height="6"/><rect x="440" y="260" width="6" height="6"/><rect x="455" y="260" width="6" height="6"/>' +
                    '<rect x="410" y="300" width="6" height="6"/><rect x="440" y="300" width="6" height="6"/><rect x="470" y="300" width="6" height="6"/>' +
                    '<rect x="410" y="340" width="6" height="6"/><rect x="440" y="340" width="6" height="6"/>' +
                    '<rect x="525" y="290" width="6" height="6"/><rect x="540" y="290" width="6" height="6"/><rect x="570" y="290" width="6" height="6"/>' +
                    '<rect x="540" y="330" width="6" height="6"/><rect x="570" y="330" width="6" height="6"/>' +
                    '<rect x="620" y="310" width="6" height="6"/><rect x="635" y="310" width="6" height="6"/><rect x="650" y="310" width="6" height="6"/><rect x="680" y="310" width="6" height="6"/><rect x="695" y="310" width="6" height="6"/><rect x="710" y="310" width="6" height="6"/>' +
                    '<rect x="620" y="345" width="6" height="6"/><rect x="650" y="345" width="6" height="6"/><rect x="680" y="345" width="6" height="6"/><rect x="710" y="345" width="6" height="6"/>' +
                  '</g>' +
                  // 抛起的小方块（学士帽抽象）
                  '<g fill="#f5e9d6">' +
                    '<rect x="280" y="140" width="22" height="6" rx="1" transform="rotate(15 291 143)"/>' +
                    '<rect x="420" y="100" width="22" height="6" rx="1" transform="rotate(-22 431 103)"/>' +
                    '<rect x="540" y="155" width="22" height="6" rx="1" transform="rotate(8 551 158)"/>' +
                    '<rect x="350" y="195" width="22" height="6" rx="1" transform="rotate(-12 361 198)"/>' +
                    '<rect x="500" y="210" width="22" height="6" rx="1" transform="rotate(28 511 213)"/>' +
                    '<rect x="620" y="190" width="22" height="6" rx="1" transform="rotate(-8 631 193)"/>' +
                  '</g>' +
                  // 流苏
                  '<g stroke="#e8d4a8" stroke-width="1.2" opacity="0.85">' +
                    '<line x1="295" y1="146" x2="297" y2="166"/><line x1="435" y1="106" x2="437" y2="126"/><line x1="555" y1="161" x2="557" y2="181"/><line x1="365" y1="201" x2="367" y2="221"/><line x1="515" y1="216" x2="517" y2="236"/><line x1="635" y1="196" x2="637" y2="216"/>' +
                  '</g>' +
                  // 太阳/光源
                  '<circle cx="680" cy="80" r="42" fill="#f3a25a" opacity="0.55"/>' +
                '</svg>'
              )
            }}
          />
          <figcaption>毕业季 · 每一个选择都值得被认真对待</figcaption>
        </figure>
      </section>

      {/* 跑马灯能力条（克制滚动，替代紫渐变条） */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {marqueeItems.map((m, i) => (
            <span key={`a${i}`}>{m}</span>
          ))}
          {marqueeItems.map((m, i) => (
            <span key={`b${i}`}>{m}</span>
          ))}
        </div>
      </div>

      {/* 实时数据条 */}
      <div className="stats">
        <div className="stat"><div className="n">8<span className="u">+</span></div><div className="lbl">在线工具</div></div>
        <div className="stat"><div className="n">100<span className="u">%</span></div><div className="lbl">联网检索事实底座 · +50% AI 整理</div></div>
        <div className="stat"><div className="n">5</div><div className="lbl">检索数据源</div></div>
        <div className="stat"><div className="n">7×24</div><div className="lbl">免登录可用</div></div>
      </div>

      {/* 工具索引（杂志式编号列表） */}
      <h2 className="section-title">
        <span className="eyebrow">Index</span>工具索引
        <span className="sub">点开即用 · 全部免费</span>
      </h2>
      <div className="tools-index">
        {toolCards.map((c, i) => (
          <Link key={c.title} to={c.to} className="tool-row">
            <span className="num">{String(i + 1).padStart(2, '0')}</span>
            <div className="tool-ico">{c.ic ? <c.ic size={20} strokeWidth={1.9} /> : null}</div>
            <div>
              <h3>{c.title}</h3>
              <p className="desc">{c.desc}</p>
            </div>
            <span className="go">进入 →</span>
          </Link>
        ))}
      </div>

      {/* 横向对比表 */}
      <h2 className="section-title">
        <span className="eyebrow">Compare</span>能力对比
        <span className="sub">本站 vs 普通 AI vs 普通搜索</span>
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
        <span className="eyebrow">Who</span>谁在用
        <span className="sub">覆盖不同人群的真实场景</span>
      </h2>
      <div className="scene-grid">
        {scenes.map((s) => (
          <div className="scene" key={s.t}>
            <h4>{s.ic ? <s.ic size={16} strokeWidth={1.9} style={{ marginRight: 6, verticalAlign: 'middle' }} /> : null} {s.t}</h4>
            <p>{s.d}</p>
          </div>
        ))}
      </div>

      {/* 免责声明 */}
      <div className="disclaimer">
        <b>关于数据：</b>答案 = <b>联网检索到的真实事实（事实底座 100% 来自检索）</b> + <b>AI 自身知识的组织与对比（约 50% 附加值，标【AI 整理】）</b>。
        凡事实均标注来源，凡 AI 自己的判断均标注"AI 整理"，查不到的标"暂无法确认"，绝不编造。
        涉及择校、求职、搞钱等重大决策，请以官方招生网、企业官方信息与实地核实为准。
      </div>
    </>
  )
}
