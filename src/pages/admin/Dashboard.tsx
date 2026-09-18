import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import { fetchPointsHealth, type PointsHealth } from '../../lib/db'
import { PageHeader, StatCard, StatusBadge, Empty } from './ui'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const TASK_TONE: any = {
  open: 'brand', accepted: 'blue', doing: 'amber', review: 'amber',
  done: 'green', arbitration: 'red', closed: 'gray'
}
const TASK_TEXT: any = {
  open: '待接单', accepted: '已接单', doing: '进行中', review: '待验收',
  done: '已完成', arbitration: '仲裁中', closed: '已关闭'
}

export default function Dashboard() {
  const me = useMe()
  const users = useStore(s => s.users)
  const tasks = useStore(s => s.tasks)
  const withdrawals = useStore(s => s.withdrawals)
  const arbitrations = useStore(s => s.arbitrations)
  const goods = useStore(s => s.goods)
  const posts = useStore(s => s.posts)
  const bulletins = useStore(s => s.bulletins)

  // 资金对账（余额 − 流水 − 冻结）与余额异常告警
  const [health, setHealth] = useState<PointsHealth | null>(null)
  const [healthErr, setHealthErr] = useState('')
  const loadHealth = useCallback(async () => {
    setHealthErr('')
    try {
      setHealth(await fetchPointsHealth(me.id))
    } catch (e: any) {
      setHealthErr(e?.message || '对账请求失败')
    }
  }, [me.id])
  useEffect(() => { loadHealth() }, [loadHealth])

  const userTotal = users.length
  const banned = users.filter(u => u.status === 'banned').length
  const activeTasks = tasks.filter(t => ['open', 'accepted', 'doing', 'review', 'arbitration'].includes(t.status)).length
  // GMV / 订单数：从真实「已完成」任务推导（store 无独立 orders 表）
  const doneTasks = tasks.filter(t => t.status === 'done')
  const gmv = doneTasks.reduce((s, t) => s + (t.amount || 0), 0)
  const pendingWd = withdrawals.filter(w => w.status === 'pending').length
  const openArb = arbitrations.filter(a => a.status === 'open').length
  const totalBalance = users.reduce((s, u) => s + u.balance, 0)

  // 任务状态分布
  const statusCounts: any = {}
  tasks.forEach(t => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1 })
  const pieData = Object.keys(TASK_TONE).map(k => ({ name: TASK_TEXT[k], value: statusCounts[k] || 0 }))
  // 图表配色：沿用全站色板（陶土为唯一强调 + 墨黑/中性灰阶 + 一个绿表示正向）
  const PIE_COLORS = ['#c2410c', '#1c1814', '#6b6b6b', '#d4581d', '#9a9a9a', '#15803d', '#e0e0e0']

  // 近 7 日成交额（来自已完成任务）
  const gmvByDay: any = {}
  doneTasks.forEach((t: any) => {
    const d = (t.created_at || '').slice(5, 10)
    if (d) gmvByDay[d] = (gmvByDay[d] || 0) + (t.amount || 0)
  })
  const days = Array.from({ length: 7 }).map((_, i) => {
    const dt = new Date(Date.now() - (6 - i) * 86400000)
    const key = (dt.getMonth() + 1) + '/' + dt.getDate()
    return { day: key, gmv: Math.round(gmvByDay[key] || 0) }
  })
  // 订单稀疏时填充演示基数，避免图表全 0 难看（明确标注演示）
  const hasOrder = doneTasks.length > 0
  const barData = days.map(d => ({ day: d.day, gmv: hasOrder ? d.gmv : [12, 28, 19, 35, 22, 46, 38][days.indexOf(d)] }))

  return (
    <div>
      <PageHeader title="数据看板" desc="平台运营总览（数据来自本地演示仓库，提现/仲裁为待处理队列）" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="注册用户" value={userTotal} sub={`封禁 ${banned} 人`} tone="brand" />
        <StatCard label="进行中任务" value={activeTasks} sub={`共 ${tasks.length} 个`} tone="amber" />
        <StatCard label="累计成交额" value={gmv.toLocaleString() + ' 积分'} sub={`已完成 ${doneTasks.length} 单`} tone="green" />
        <StatCard label="用户钱包总额" value={totalBalance.toLocaleString() + ' 积分'} sub="冻结计入余额" tone="ink" />
        <StatCard label="待审提现" value={pendingWd} sub={`${withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0).toLocaleString()} 积分`} tone="clay" />
        <StatCard label="仲裁中" value={openArb} sub={`共 ${arbitrations.length} 起`} tone="red" />
        <StatCard label="在售二手" value={goods.filter(g => g.status === 'on').length} sub={`共 ${goods.length}`} tone="brand" />
        <StatCard label="社区帖子" value={posts.filter(p => p.status === 'on').length} sub={`共 ${posts.length}`} tone="green" />
        <StatCard label="小黑板" value={bulletins.filter(b => b.status === 'on').length} sub={`共 ${bulletins.length}`} tone="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-ink">近 7 日成交额（积分）</h2>
            {!hasOrder && <span className="text-[11px] text-gray-400">演示数据</span>}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="gmv" fill="#c2410c" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <h2 className="font-bold text-ink mb-3">任务状态分布</h2>
          {tasks.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={85} label>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
        <div className="card p-4">
          <h2 className="font-bold text-ink mb-3">最新任务</h2>
          <div className="space-y-2">
            {tasks.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div className="min-w-0">
                  <div className="text-sm truncate">{t.title}</div>
                  <div className="text-xs text-gray-400">{t.amount} 积分 · {t.poster_name}</div>
                </div>
                <StatusBadge text={TASK_TEXT[t.status]} tone={TASK_TONE[t.status]} />
              </div>
            ))}
            {tasks.length === 0 && <Empty />}
          </div>
        </div>
        <div className="card p-4">
          <h2 className="font-bold text-ink mb-3">待处理队列</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-600">待审提现</span>
              <span className="font-bold text-clay">{pendingWd} 笔</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-600">仲裁中</span>
              <span className="font-bold text-red-500">{openArb} 起</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-600">封禁用户</span>
              <span className="font-bold">{banned} 人</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">下架商品/帖子</span>
              <span className="font-bold">{goods.filter(g => g.status === 'removed').length + posts.filter(p => p.status === 'removed').length} 条</span>
            </div>
          </div>
        </div>
      </div>

      {/* 资金对账：余额 − 流水累计 = 冻结 属正常，差值非 0 才是账目异常 */}
      <div className="card p-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-ink">资金对账</h2>
          <div className="flex items-center gap-3">
            {health && (
              <span className="text-[11px] text-gray-400">
                更新于 {new Date(health.generatedAt).toLocaleTimeString('zh-CN')}
              </span>
            )}
            <button className="text-[11px] text-gray-500 hover:text-ink" onClick={loadHealth}>重新对账</button>
          </div>
        </div>

        {!health && !healthErr && <div className="text-sm text-gray-400">对账中…</div>}
        {healthErr && <div className="text-sm text-clay">对账失败：{healthErr}</div>}

        {health && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div className="flex justify-between lg:block">
                <span className="text-gray-500">账户总余额</span>
                <div className="font-bold">{health.totalBalance.toLocaleString()} 积分</div>
              </div>
              <div className="flex justify-between lg:block">
                <span className="text-gray-500">冻结合计</span>
                <div className="font-bold">{health.totalFrozen.toLocaleString()} 积分</div>
              </div>
              <div className="flex justify-between lg:block">
                <span className="text-gray-500">流水条数</span>
                <div className="font-bold">{health.txnRows.toLocaleString()}{health.truncated ? '+' : ''}</div>
              </div>
              <div className="flex justify-between lg:block">
                <span className="text-gray-500">异常账号</span>
                <div className={'font-bold ' + (health.anomalies.length ? 'text-clay' : '')}>
                  {health.anomalies.length} 个
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              对账口径：余额只由「会动余额」的流水决定（冻结/解冻流水只挪冻结、不动余额，已排除），
              所以正常账号的「余额 − 流水累计」应为 0；冻结额应等于「进行中任务的雇主托管 + 待审提现」。
              余额 ≥ {health.alertThreshold.toLocaleString()} 积分的账号会被标为「余额异常高」，需人工确认积分来源。
            </p>

            {health.anomalies.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-bold text-clay mb-1">余额对不上（{health.anomalies.length}）</div>
                {health.anomalies.slice(0, 10).map(a => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                    <span className="truncate">{a.nickname}{a.phone ? ` · ${a.phone}` : ''}</span>
                    <span className="text-clay shrink-0 ml-3">
                      余额 {a.balance.toLocaleString()} / 流水 {a.txnSum.toLocaleString()} / 差 {a.diff.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {health.frozenAnomalies.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-bold text-clay mb-1">冻结对不上（{health.frozenAnomalies.length}）</div>
                {health.frozenAnomalies.slice(0, 10).map(f => (
                  <div key={f.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                    <span className="truncate">{f.nickname}{f.phone ? ` · ${f.phone}` : ''}</span>
                    <span className="text-clay shrink-0 ml-3">
                      当前 {f.frozen.toLocaleString()} / 应有 {f.expected.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {health.highBalance.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-bold text-clay mb-1">余额异常高（{health.highBalance.length}）· 请确认积分来源</div>
                {health.highBalance.slice(0, 10).map(h => (
                  <div key={h.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                    <span className="truncate">{h.nickname}{h.phone ? ` · ${h.phone}` : ''}</span>
                    <span className="text-clay shrink-0 ml-3">{h.balance.toLocaleString()} 积分</span>
                  </div>
                ))}
              </div>
            )}

            {health.anomalies.length === 0 && health.frozenAnomalies.length === 0 && health.highBalance.length === 0 && (
              <div className="text-sm text-gray-500 mt-3">账面正常：余额与冻结都对得上，没有余额异常高的账号。</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
