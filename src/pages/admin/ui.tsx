import type { ReactNode } from 'react'

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h1 className="text-2xl font-black text-ink">{title}</h1>
        {desc && <p className="text-sm text-gray-500 mt-1">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: 'brand' | 'clay' | 'red' | 'amber' | 'green' | 'ink' }) {
  const toneCls: any = {
    brand: 'text-brand-600', clay: 'text-clay', red: 'text-red-500',
    amber: 'text-amber-500', green: 'text-green-600', ink: 'text-ink'
  }
  return (
    <div className="card p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={'text-2xl font-black mt-1 ' + (toneCls[tone || 'ink'])}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={'tag ' + (className || 'bg-gray-100 text-gray-500')}>{children}</span>
}

export function StatusBadge({ text, tone }: { text: string; tone?: 'brand' | 'clay' | 'red' | 'amber' | 'green' | 'blue' | 'gray' }) {
  const map: any = {
    brand: 'bg-brand-50 text-brand-700',
    clay: 'bg-orange-50 text-clay',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    gray: 'bg-gray-100 text-gray-500'
  }
  return <Badge className={map[tone || 'gray']}>{text}</Badge>
}

export function Empty({ text = '暂无数据' }: { text?: string }) {
  return <div className="text-center text-gray-400 text-sm py-10">{text}</div>
}

export function confirmDanger(msg: string): boolean {
  return window.confirm(msg)
}
