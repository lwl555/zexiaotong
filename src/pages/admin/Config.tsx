import { useEffect, useState } from 'react'
import { Save, Megaphone, Percent, Pin, CheckCircle, Loader2, Send, Wallet, Upload } from 'lucide-react'
import { useStore } from '../../store/store'
import { PageHeader } from './ui'
import { uploadRechargeFile } from '../../lib/db'
import type { PlatformConfig } from '../../lib/types'

export default function Config() {
  const config = useStore(s => s.config)
  const setConfig = useStore(s => s.setConfig)
  const adminSendAnnounce = useStore(s => s.adminSendAnnounce)
  // 用默认值兜底：config 还在加载（null）时不挂；config 到位后再用真实数据
  const [draft, setDraft] = useState<PlatformConfig>({
    commission_rate: 0.10,
    top_price: { d1: 2, d3: 5, d7: 10 },
    announce: '',
    points_per_yuan: 100,
    alipay_qr_url: '',
    alipay_account: ''
  })
  const [qrBusy, setQrBusy] = useState(false)
  const [qrErr, setQrErr] = useState('')
  const [saved, setSaved] = useState(false)
  const [pushTitle, setPushTitle] = useState('')
  const [pushContent, setPushContent] = useState('')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushDone, setPushDone] = useState(false)

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

  // 上传支付宝收款码到 uploads 桶（经 db-write 写入，返回公开 URL）
  const onPickQr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setQrErr(''); setQrBusy(true)
    try {
      const url = await uploadRechargeFile(f, 'alipay-qr')
      setDraft(d => ({ ...d, alipay_qr_url: url }))
    } catch (err: any) {
      setQrErr(err?.message || '上传失败')
    } finally { setQrBusy(false) }
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
                <span className="text-gray-400 text-sm">积分</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 font-bold text-ink mb-4"><Pin size={18} className="text-clay" /> 积分换算比例</div>
          <label className="text-sm text-gray-600">多少积分等于 1 元（充值 / 提现换算用）</label>
          <input type="number" min="1" className="input mt-2" value={draft.points_per_yuan}
            onChange={e => setDraft({ ...draft, points_per_yuan: Number(e.target.value) })} />
          <div className="text-xs text-gray-400 mt-1">当前：{draft.points_per_yuan} 积分 = 1 元</div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 font-bold text-ink mb-4"><Wallet size={18} className="text-brand-600" /> 支付宝收款设置</div>
          <p className="text-sm text-gray-500 mb-3">用户充值时展示此收款码与账号，扫码转账后上传截图，管理员审核通过后积分到账。</p>
          <div className="flex items-start gap-4 flex-wrap">
            <div>
              <label className="text-sm text-gray-600">收款二维码</label>
              <div className="mt-2 flex flex-col items-center" style={{ width: 180 }}>
                {draft.alipay_qr_url ? (
                  <img src={draft.alipay_qr_url} alt="收款码" className="w-[160px] h-[160px] object-contain border border-gray-200 rounded" />
                ) : (
                  <div className="w-[160px] h-[160px] flex items-center justify-center border border-dashed border-gray-300 rounded text-gray-300 text-xs text-center">未上传</div>
                )}
                <label className="btn-ghost mt-2 inline-flex items-center gap-1 cursor-pointer" style={{ fontSize: 13 }}>
                  <Upload size={14} /> {qrBusy ? '上传中…' : '选择/更换二维码'}
                  <input type="file" accept="image/*" onChange={onPickQr} disabled={qrBusy} style={{ display: 'none' }} />
                </label>
                {qrErr && <div className="text-xs text-red-500 mt-1">{qrErr}</div>}
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-gray-600">支付宝收款账号 / 姓名（展示用，便于用户核对）</label>
              <input className="input mt-2" value={draft.alipay_account}
                onChange={e => setDraft({ ...draft, alipay_account: e.target.value })}
                placeholder="如：138xxxx8888 或 张三" />
              <div className="text-xs text-gray-400 mt-2">
                修改后点击右上角「保存配置」才会生效（与抽佣、置顶价等一起保存）。
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 font-bold text-ink mb-4"><Megaphone size={18} className="text-brand-600" /> 全站公告与推送</div>
          <label className="text-sm text-gray-600">常驻公告（展示在前台公告位）</label>
          <textarea className="input h-20 resize-none mt-2" value={draft.announce}
            onChange={e => setDraft({ ...draft, announce: e.target.value })} placeholder="发布全站公告…" />
          <div className="border-t border-gray-100 my-4" />
          <label className="text-sm text-gray-600">立即推送全站通知（写入每个用户的消息中心）</label>
          <input className="input mt-2" value={pushTitle} onChange={e => setPushTitle(e.target.value)} placeholder="通知标题，如：系统升级通知" />
          <textarea className="input h-20 resize-none mt-2" value={pushContent} onChange={e => setPushContent(e.target.value)} placeholder="通知内容…" />
          <button className="btn-primary mt-3 inline-flex items-center gap-1" disabled={pushBusy || !pushTitle || !pushContent}
            onClick={async () => {
              setPushBusy(true); setPushDone(false)
              try { await adminSendAnnounce(pushTitle, pushContent); setPushDone(true); setPushTitle(''); setPushContent(''); setTimeout(() => setPushDone(false), 2500) }
              catch (e: any) { alert(e?.message || '推送失败') }
              finally { setPushBusy(false) }
            }}>
            {pushBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} 推送全站通知
          </button>
          {pushDone && <span className="text-xs text-green-600 ml-3 inline-flex items-center gap-1"><CheckCircle size={14} /> 已推送</span>}
        </div>
      </div>
    </div>
  )
}
