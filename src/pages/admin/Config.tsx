import { useEffect, useState } from 'react'
import { Save, Megaphone, Percent, Pin, CheckCircle, Loader2 } from 'lucide-react'
import { useStore } from '../../store/store'
import { PageHeader } from './ui'
import type { PlatformConfig } from '../../lib/types'

export default function Config() {
  const config = useStore(s => s.config)
  const setConfig = useStore(s => s.setConfig)
  // 用默认值兜底：config 还在加载（null）时不挂；config 到位后再用真实数据
  const [draft, setDraft] = useState<PlatformConfig>({
    commission_rate: 0.10,
    top_price: { d1: 2, d3: 5, d7: 10 },
    announce: ''
  })
  const [saved, setSaved] = useState(false)

  // config 加载完成后同步到 draft；加载中的 draft 用兜底值，避免渲染时 .commission_rate 崩溃
  useEffect(() => {
    if (config) setDraft(config)
  }, [config])

  // 配置还没拉回来：给个轻提示而不是直接 blank（也不要 `draft.xxx` 解构 null）
  if (!config) {
    return (
      <div>
        <PageHeader title="运营配置" desc="设置平台抽佣、置顶价格与全局公告" />
        <div className="card p-10 flex flex-col items-center justify-center text-gray-400">
          <Loader2 size={28} className="animate-spin mb-2" />
          <div className="text-sm">配置加载中…</div>
        </div>
      </div>
    )
  }

  const save = () => {
    const rate = Math.min(0.3, Math.max(0.01, Number(draft.commission_rate)))
    setConfig({ ...draft, commission_rate: rate })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <PageHeader title="运营配置" desc="设置平台抽佣、置顶价格与全局公告">
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={14} /> 已保存</span>}
          <button className="btn-primary" onClick={save}><Save size={16} /> 保存配置</button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 font-bold text-ink mb-4"><Percent size={18} className="text-brand-600" /> 平台抽佣比例</div>
          <label className="text-sm text-gray-600">任务完成时平台抽佣（%）</label>
          <input type="number" step="0.5" min="1" max="30" className="input mt-2" value={(draft.commission_rate * 100).toFixed(1)}
            onChange={e => setDraft({ ...draft, commission_rate: Number(e.target.value) / 100 })} />
          <div className="text-xs text-gray-400 mt-1">范围 1% – 30%，当前 {(draft.commission_rate * 100).toFixed(0)}%</div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 font-bold text-ink mb-4"><Pin size={18} className="text-clay" /> 付费置顶价格</div>
          <div className="space-y-3">
            {(['d1', 'd3', 'd7'] as const).map((k, i) => (
              <div key={k} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-20">{['1 天', '3 天', '7 天'][i]}</span>
                <input type="number" min="0" className="input" value={draft.top_price[k]}
                  onChange={e => setDraft({ ...draft, top_price: { ...draft.top_price, [k]: Number(e.target.value) } })} />
                <span className="text-gray-400 text-sm">元</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 font-bold text-ink mb-4"><Megaphone size={18} className="text-brand-600" /> 全局公告</div>
          <textarea className="input h-28 resize-none" value={draft.announce}
            onChange={e => setDraft({ ...draft, announce: e.target.value })} placeholder="发布全站公告…" />
        </div>
      </div>
    </div>
  )
}
