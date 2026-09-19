import { useEffect } from 'react'
import { CheckCircle2, XCircle, Flag } from 'lucide-react'
import { useStore } from '../../store/store'
import { PageHeader, StatusBadge, Empty } from './ui'

const TARGET_LABEL: Record<string, string> = {
  post: '帖子',
  goods: '商品',
  task: '任务',
  comment: '评论',
  user: '用户',
}

/**
 * 举报处理（管理端）。
 *
 * 数据来自 db-write 的 `list_reports`（service_role + 后端 requireAdmin），
 * reports 表本身不开放 anon 读策略，所以只有管理员能看到举报内容。
 */
export default function Reports() {
  const reports = useStore((s) => s.reports)
  const fetchReports = useStore((s) => s.fetchReports)
  const handleReport = useStore((s) => s.handleReport)

  useEffect(() => {
    fetchReports()
  }, [])

  const pending = reports.filter((r) => r.status === 'pending').length

  return (
    <div>
      <PageHeader title="举报处理" desc="用户提交的举报，核实后可标记已处理或驳回">
        <div className="text-sm text-gray-500">
          待处理 <b className="text-clay text-lg">{pending}</b> 条
        </div>
      </PageHeader>

      {reports.length === 0 && <Empty text="暂无举报" />}

      <div className="space-y-3">
        {reports.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-clay shrink-0">
                  <Flag size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="tag bg-gray-100 text-gray-600">{TARGET_LABEL[r.target_type] || r.target_type}</span>
                    <span className="font-medium text-ink truncate">{r.target_title || r.target_id}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">原因：{r.reason}</div>
                  {r.detail && <div className="text-xs text-gray-400 mt-1">补充：{r.detail}</div>}
                  <div className="text-xs text-gray-400 mt-2">
                    举报人 {r.reporter_name || '匿名'} · {new Date(r.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                {r.status === 'pending' ? (
                  <StatusBadge text="待处理" tone="amber" />
                ) : r.status === 'handled' ? (
                  <StatusBadge text="已处理" tone="green" />
                ) : (
                  <StatusBadge text="已驳回" tone="gray" />
                )}
              </div>
            </div>

            {r.status === 'pending' && (
              <div className="mt-3 border-t border-gray-100 pt-3 flex gap-2">
                <button className="btn-primary" onClick={() => handleReport(r.id, 'handled')}>
                  <CheckCircle2 size={15} /> 标记已处理
                </button>
                <button className="btn-ghost" onClick={() => handleReport(r.id, 'rejected')}>
                  <XCircle size={15} /> 驳回举报
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
