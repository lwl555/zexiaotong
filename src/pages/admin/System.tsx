import { useState } from 'react'
import { Shield, Tags, FileText, Database, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../store/store'
import { PageHeader, confirmDanger } from './ui'

const SEED_WORDS = ['代写', '刷单', '赌博', '贷款', '私彩', '色情']
const SEED_LOGS = [
  { t: '2026-08-21 11:10', who: 'u_me', act: '发布任务「代取快递」', level: 'info' },
  { t: '2026-08-21 11:00', who: 'u_4', act: '接单「占座」', level: 'info' },
  { t: '2026-08-21 10:30', who: 'u_5', act: '账号被封禁', level: 'warn' },
  { t: '2026-08-20 15:00', who: 'u_admin', act: '仲裁判定「代填问卷」', level: 'warn' },
  { t: '2026-08-19 09:12', who: 'system', act: '数据库每日备份完成', level: 'info' }
]

export default function System() {
  const categories = useStore(s => s.categories)
  const [words, setWords] = useState<string[]>(SEED_WORDS)
  const [newWord, setNewWord] = useState('')
  const [logs] = useState(SEED_LOGS)

  const addWord = () => {
    const w = newWord.trim()
    if (!w) return
    if (words.includes(w)) { alert('已存在'); return }
    setWords([...words, w]); setNewWord('')
  }
  const delWord = (w: string) => setWords(words.filter(x => x !== w))

  const backup = () => {
    const blob = new Blob([JSON.stringify({ ts: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'zexiaotong-backup.json'
    a.click()
    alert('已导出备份快照（演示）')
  }

  return (
    <div>
      <PageHeader title="系统安全" desc="敏感词库、分类管理、操作日志与数据备份" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 敏感词 */}
        <div className="card p-5">
          <div className="flex items-center gap-2 font-bold text-ink mb-4"><Shield size={18} className="text-clay" /> 敏感词库（{words.length}）</div>
          <div className="flex gap-2 mb-3">
            <input className="input flex-1" placeholder="新增敏感词" value={newWord} onChange={e => setNewWord(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWord()} />
            <button className="btn-primary" onClick={addWord}><Plus size={16} /> 添加</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {words.map(w => (
              <span key={w} className="tag bg-red-50 text-red-600 flex items-center gap-1">
                {w}
                <button onClick={() => delWord(w)} className="hover:text-red-800"><Trash2 size={11} /></button>
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">发布任务 / 帖子 / 评论时命中敏感词将被拦截（演示：此处仅维护词库，未接入实时校验）。</p>
        </div>

        {/* 分类管理 */}
        <div className="card p-5">
          <div className="flex items-center gap-2 font-bold text-ink mb-4"><Tags size={18} className="text-brand-600" /> 分类管理</div>
          <div className="space-y-2">
            {(['task', 'goods'] as const).map(kind => (
              <div key={kind}>
                <div className="text-xs text-gray-400 mb-1">{kind === 'task' ? '任务分类' : '二手分类'}</div>
                <div className="flex flex-wrap gap-2">
                  {categories.filter(c => c.kind === kind).map(c => (
                    <span key={c.id} className="tag bg-brand-50 text-brand-700">{c.name}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">分类在 mockData.ts 中维护，真实环境应提供增删改界面。</p>
        </div>

        {/* 操作日志 */}
        <div className="card p-5">
          <div className="flex items-center gap-2 font-bold text-ink mb-4"><FileText size={18} className="text-ink" /> 操作日志</div>
          <div className="space-y-2 text-sm">
            {logs.map((l, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50">
                <span className={'w-2 h-2 rounded-full mt-1.5 ' + (l.level === 'warn' ? 'bg-amber-400' : 'bg-green-400')} />
                <div className="flex-1">
                  <div className="text-ink">{l.act}</div>
                  <div className="text-xs text-gray-400">{l.t} · {l.who}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 数据备份 */}
        <div className="card p-5">
          <div className="flex items-center gap-2 font-bold text-ink mb-4"><Database size={18} className="text-brand-600" /> 数据备份</div>
          <p className="text-sm text-gray-600 mb-4">定期导出平台数据快照，防止意外丢失。</p>
          <button className="btn-primary w-full" onClick={backup}><Database size={16} /> 立即导出备份快照</button>
          <p className="text-xs text-gray-400 mt-3">真实环境应接入对象存储 + 定时任务自动备份。</p>
        </div>
      </div>
    </div>
  )
}
