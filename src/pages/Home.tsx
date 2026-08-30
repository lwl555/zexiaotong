import { Link } from 'react-router-dom'
import { Search, Building2, MapPin, Radio, FileText, AlertTriangle, Coins, Info, BookOpen, Compass } from 'lucide-react'
import {
  PageHeader,
  SectionLabel,
  IndexGrid,
  HardCard,
  SoftCard,
  Stat,
  Tag,
  INK,
  PAPER,
  MUTED,
  ACCENT,
  ACCENT_SOFT,
  HAIR,
  FONT,
  MONO,
  hard,
} from '../components/Editorial'

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
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader
        eyebrow="ZEXIAOTONG · 高校与职业决策工具"
        title="选学校、挑公司，我们把实话摊在桌面上。"
        desc="不粉饰、不绕弯、不回避。关于分数、食堂、薪资、加班这些硬事实，一半来自联网检索的真实资料，一半来自 AI 的整理与对比——每条都标明白，哪句是事实、哪句是判断。"
        right={
          <Link
            to="/ai-search?tab=school"
            style={{ ...hard({ padding: '9px 16px', fontSize: 14, fontWeight: 700, color: PAPER, background: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }) }}
          >
            <Compass size={15} strokeWidth={2} /> 开始一次查询
          </Link>
        }
      />

      {/* 编辑式 Hero：左文右图，非对称 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
          gap: 22,
          alignItems: 'stretch',
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 3, color: ACCENT, marginBottom: 10 }}>
            REAL TALK, ON THE TABLE
          </div>
          <h1 style={{ fontFamily: FONT, fontSize: 34, fontWeight: 800, color: INK, letterSpacing: '-0.02em', lineHeight: 1.12, margin: 0 }}>
            选学校、挑公司，<br />
            我们把<span style={{ color: ACCENT }}>实话</span>摊在桌面上。
          </h1>
          <p style={{ fontFamily: FONT, fontSize: 14, color: MUTED, marginTop: 14, marginBottom: 0, lineHeight: 1.65, maxWidth: 520 }}>
            不粉饰、不绕弯、不回避。关于分数、食堂、薪资、加班这些硬事实，一半来自联网检索的真实资料，一半来自 AI 的整理与对比——每条都标明白，哪句是事实、哪句是判断。
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <Link
              to="/ai-search?tab=school"
              style={{ ...hard({ padding: '9px 16px', fontSize: 14, fontWeight: 700, color: PAPER, background: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }) }}
            >
              <Compass size={15} strokeWidth={2} /> 开始一次查询
            </Link>
            <Link
              to="/ai-tutor"
              style={{ ...hard({ padding: '8px 15px', fontSize: 14, fontWeight: 600, color: INK, background: PAPER, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' })}}
            >
              试试实时资讯台
            </Link>
          </div>
        </div>

        <HardCard style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <figure style={{ margin: 0, position: 'relative', flex: 1, minHeight: 260 }}>
            <img
              src="https://images.pexels.com/photos/267885/pexels-photo-267885.jpeg?auto=compress&cs=tinysrgb&w=1200"
              alt="毕业生抛起学士帽"
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 260 }}
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
            <figcaption
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                fontFamily: MONO,
                fontSize: 10.5,
                letterSpacing: 1.5,
                color: '#fff',
                background: 'rgba(17,17,17,0.62)',
                padding: '8px 12px',
              }}
            >
              毕业季 · 每一个选择都值得被认真对待
            </figcaption>
          </figure>
        </HardCard>
      </div>

      {/* 能力条：等宽标签 + 发丝线 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          borderTop: `1px solid ${HAIR}`,
          borderBottom: `1px solid ${HAIR}`,
          padding: '12px 0',
          marginBottom: 18,
        }}
      >
        {marqueeItems.map((m, i) => (
          <Tag key={`m${i}`}>{m}</Tag>
        ))}
      </div>

      {/* 实时数据条 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
          marginBottom: 26,
        }}
      >
        <Stat label="在线工具" value="8+" />
        <Stat label="联网检索事实底座 + AI 整理" value="100%" />
        <Stat label="检索数据源" value="5" />
        <Stat label="免登录可用" value="7×24" />
      </div>

      {/* 工具索引（杂志式编号列表） */}
      <SectionLabel index="01" label="Index · 工具索引" />
      <p style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginTop: 0, marginBottom: 14 }}>点开即用 · 全部免费</p>
      <IndexGrid min={260}>
        {toolCards.map((c, i) => (
          <Link key={c.title} to={c.to} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <HardCard style={{ display: 'flex', flexDirection: 'column', height: '100%', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ width: 40, height: 40, border: `2px solid ${INK}`, borderRadius: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
                  {c.ic ? <c.ic size={20} strokeWidth={1.9} /> : null}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: ACCENT }}>{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: INK, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{c.title}</h3>
              <p style={{ fontFamily: FONT, fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.55 }}>{c.desc}</p>
              <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: INK }}>进入 →</div>
            </HardCard>
          </Link>
        ))}
      </IndexGrid>

      {/* 横向对比表 */}
      <div style={{ marginTop: 30 }}>
        <SectionLabel index="02" label="Compare · 能力对比" />
        <p style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginTop: 0, marginBottom: 14 }}>本站 vs 普通 AI vs 普通搜索</p>
        <div style={{ ...hard(), background: PAPER, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT }}>
            <thead>
              <tr>
                {['能力', '本站 · 择校通', '普通 AI', '普通搜索'].map((h, idx) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      fontFamily: MONO,
                      fontSize: 11,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      color: idx === 1 ? ACCENT : INK,
                      padding: '12px 14px',
                      borderBottom: `2px solid ${INK}`,
                      background: ACCENT_SOFT,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.f} style={{ borderBottom: `1px solid ${HAIR}` }}>
                  <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 600, color: INK }}>{f.f}</td>
                  <td style={{ padding: '12px 14px', fontSize: 14, color: INK }}>
                    {f.yt === '是' ? <Tag tone="accent">✓ 已支持</Tag>
                      : f.yt === '部分' ? <Tag>部分支持</Tag>
                      : <span style={{ fontSize: 14 }}>{f.yt}</span>}
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{f.sd}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 14, color: MUTED }}>
                    {f.ab === '是' ? <Tag>部分</Tag>
                      : f.ab === '—' ? '—'
                      : <span style={{ color: ACCENT, fontSize: 13 }}>✗ 不支持</span>}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ color: ACCENT, fontSize: 13 }}>✗ 不支持</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 场景说明 */}
      <div style={{ marginTop: 30 }}>
        <SectionLabel index="03" label="Who · 谁在用" />
        <p style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginTop: 0, marginBottom: 14 }}>覆盖不同人群的真实场景</p>
        <IndexGrid min={300}>
          {scenes.map((s) => (
            <SoftCard key={s.t} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT, fontSize: 16, fontWeight: 700, color: INK }}>
                {s.ic ? <s.ic size={16} strokeWidth={1.9} style={{ color: ACCENT }} /> : <span style={{ width: 8, height: 8, background: ACCENT, borderRadius: 2, display: 'inline-block' }} />}
                {s.t}
              </div>
              <p style={{ fontFamily: FONT, fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6 }}>{s.d}</p>
            </SoftCard>
          ))}
        </IndexGrid>
      </div>

      {/* 免责声明 */}
      <div style={{ marginTop: 26 }}>
        <SoftCard style={{ border: `1px solid ${HAIR}`, background: '#fcfbf9' }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 2, color: ACCENT, textTransform: 'uppercase', marginBottom: 8 }}>Disclaimer</div>
          <p style={{ fontFamily: FONT, fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.7 }}>
            <b style={{ color: INK }}>关于数据：</b>答案 = <b style={{ color: INK }}>联网检索到的真实事实（事实底座 100% 来自检索）</b> + <b style={{ color: INK }}>AI 自身知识的组织与对比（约 50% 附加值，标【AI 整理】）</b>。
            凡事实均标注来源，凡 AI 自己的判断均标注“AI 整理”，查不到的标“暂无法确认”，绝不编造。
            涉及择校、求职、搞钱等重大决策，请以官方招生网、企业官方信息与实地核实为准。
          </p>
        </SoftCard>
      </div>
    </div>
  )
}
