import { EXPENSE_CATEGORIES } from '../constants'
import { planTotalSpend, planSpendBreakdown } from './selectors'
import { formatDate, formatMoney } from '../utils/format'

// HTML 转义，避免用户输入破坏文档结构
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 多行文本转 HTML（保留换行）
function multiline(value) {
  return escapeHtml(value).replace(/\n/g, '<br>')
}

// 文件名清洗：去掉文件系统不允许的字符
function sanitizeFilename(name) {
  const cleaned = String(name || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
  return cleaned || '未命名计划'
}

function recordTotal(record) {
  return EXPENSE_CATEGORIES.reduce((sum, { key }) => sum + (Number(record[key]) || 0), 0)
}

// ===== 各部分内容 =====
function buildRecordsHtml(plan) {
  const records = [...(plan.records || [])].sort((a, b) => (a.date < b.date ? -1 : 1))
  if (!records.length) {
    return '<p class="empty-note">暂无行程记录</p>'
  }
  return records
    .map((r) => {
      const costs = EXPENSE_CATEGORIES.filter(({ key }) => Number(r[key]))
        .map(({ key, label }) => `<span class="cost">${label} ${formatMoney(r[key])}</span>`)
        .join('')
      return `<div class="record">
        <div class="record-head">
          <span class="record-date">${formatDate(r.date)}</span>
          <span class="record-total">${formatMoney(recordTotal(r))}</span>
        </div>
        <p class="record-title">${escapeHtml(r.itinerary) || '（无行程内容）'}</p>
        ${costs ? `<div class="record-costs">${costs}</div>` : ''}
        ${r.notes ? `<p class="record-notes">${multiline(r.notes)}</p>` : ''}
      </div>`
    })
    .join('')
}

function buildExpenseHtml(plan) {
  if (!(plan.records || []).length) {
    return '<p class="empty-note">暂无花费记录</p>'
  }
  const total = planTotalSpend(plan)
  const budget = Number(plan.budget) || 0
  const balance = budget - total
  const breakdown = planSpendBreakdown(plan)
  const rows = EXPENSE_CATEGORIES.map(
    ({ label }) =>
      `<tr><td>${label}</td><td class="num">${formatMoney(breakdown[label])}</td></tr>`
  ).join('')
  return `<div class="expense-summary">
      <div><span>总花费</span><strong>${formatMoney(total)}</strong></div>
      <div><span>预算</span><strong>${formatMoney(budget)}</strong></div>
      <div><span>${balance >= 0 ? '结余' : '超支'}</span><strong class="${balance >= 0 ? 'good' : 'bad'}">${formatMoney(Math.abs(balance))}</strong></div>
    </div>
    <table>
      <thead><tr><th>花费分类</th><th class="num">金额</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
}

function buildSummaryHtml(plan) {
  const summary = plan.summary
  if (!summary) {
    return '<p class="empty-note">暂无出行总结</p>'
  }
  const rating = Math.min(5, Math.max(0, Number(summary.rating) || 0))
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
  const blocks = [
    ['亮点', summary.highlights],
    ['遗憾', summary.regrets],
    ['建议', summary.suggestions],
  ]
    .filter(([, text]) => text && String(text).trim())
    .map(([label, text]) => `<div class="summary-item"><h3>${label}</h3><p>${multiline(text)}</p></div>`)
    .join('')
  return `<p class="rating">总体评分：<span class="stars">${stars}</span>（${rating}/5）</p>${blocks}`
}

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; color: #1f2937; background: #fff; line-height: 1.7; font-size: 14px; }
  .page { max-width: 800px; margin: 0 auto; padding: 36px 28px 56px; }
  header.doc-head { border-bottom: 2px solid #4f6ef7; padding-bottom: 16px; margin-bottom: 24px; }
  h1 { font-size: 24px; margin-bottom: 6px; }
  .subtitle { color: #6b7280; }
  .tags { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; }
  .tag { border: 1px solid #c7d0fb; color: #3b56d4; border-radius: 20px; padding: 1px 10px; font-size: 12px; }
  section { margin-bottom: 28px; }
  h2 { font-size: 17px; border-left: 4px solid #4f6ef7; padding-left: 10px; margin-bottom: 12px; }
  h3 { font-size: 14px; margin-bottom: 4px; }
  .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 24px; }
  .info-grid .item { display: flex; gap: 8px; }
  .info-grid .label { color: #6b7280; flex-shrink: 0; }
  .empty-note { color: #9ca3af; padding: 12px 0; }
  .record { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; page-break-inside: avoid; }
  .record-head { display: flex; justify-content: space-between; align-items: baseline; }
  .record-date { color: #3b56d4; font-weight: 600; font-size: 13px; }
  .record-total { font-weight: 600; }
  .record-title { font-weight: 500; margin-top: 2px; }
  .record-costs { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: #6b7280; margin-top: 4px; }
  .record-notes { font-size: 12px; color: #9ca3af; margin-top: 4px; }
  .expense-summary { display: flex; gap: 32px; margin-bottom: 12px; }
  .expense-summary span { display: block; font-size: 12px; color: #6b7280; }
  .expense-summary strong { font-size: 18px; }
  .expense-summary .good { color: #10b981; }
  .expense-summary .bad { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
  th { color: #6b7280; font-weight: 500; font-size: 13px; background: #fafbfc; }
  .num { text-align: right; }
  .rating { margin-bottom: 10px; }
  .stars { color: #f59e0b; }
  .summary-item { margin-bottom: 10px; page-break-inside: avoid; }
  footer.doc-foot { border-top: 1px solid #e5e7eb; padding-top: 12px; color: #9ca3af; font-size: 12px; text-align: center; }
  .print-btn { position: fixed; top: 16px; right: 16px; border: none; border-radius: 8px; background: #4f6ef7; color: #fff; padding: 8px 18px; font-size: 14px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  @media print {
    .print-btn { display: none; }
    .page { max-width: none; padding: 0; }
  }
`

// 生成自包含的行程单 HTML（可直接打印、可转发）
export function buildItineraryHtml(plan) {
  const memberNames = (plan.members || []).map((m) => escapeHtml(m.name)).join('、')
  const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false })
  const infoItems = [
    ['目的地', plan.destination],
    ['出行日期', `${formatDate(plan.startDate)} 至 ${formatDate(plan.endDate)}（${plan.days} 天）`],
    ['出行人数', `${plan.memberCount} 人${memberNames ? `：${memberNames}` : ''}`],
    ['交通方式', plan.transport],
    ['住宿信息', plan.accommodation || '未填写'],
    ['预算总额', formatMoney(plan.budget)],
  ]
    .map(
      ([label, value]) =>
        `<div class="item"><span class="label">${label}</span><span>${escapeHtml(value)}</span></div>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>行程单 · ${escapeHtml(plan.name)}</title>
<style>${STYLES}</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">打印行程单</button>
<div class="page">
  <header class="doc-head">
    <h1>${escapeHtml(plan.name)}</h1>
    <p class="subtitle">${escapeHtml(plan.destination)} · ${formatDate(plan.startDate)} 至 ${formatDate(plan.endDate)}</p>
    <div class="tags">
      <span class="tag">${escapeHtml(plan.tripType)}</span>
      <span class="tag">${escapeHtml(plan.destinationType)}</span>
      <span class="tag">${escapeHtml(plan.transport)}</span>
    </div>
  </header>

  <section>
    <h2>基本信息</h2>
    <div class="info-grid">${infoItems}</div>
    ${plan.notes ? `<div class="item" style="margin-top:8px"><span class="label">备注</span><span>${multiline(plan.notes)}</span></div>` : ''}
  </section>

  <section>
    <h2>行程安排</h2>
    ${buildRecordsHtml(plan)}
  </section>

  <section>
    <h2>花费汇总</h2>
    ${buildExpenseHtml(plan)}
  </section>

  <section>
    <h2>出行总结</h2>
    ${buildSummaryHtml(plan)}
  </section>

  <footer class="doc-foot">本行程单由「出行管家」于 ${generatedAt} 导出</footer>
</div>
</body>
</html>`
}

// 触发浏览器下载行程单 HTML 文件；失败时抛出异常由调用方提示
export function exportPlanItinerary(plan) {
  if (!plan) {
    throw new Error('出行计划不存在，无法导出')
  }
  const html = buildItineraryHtml(plan)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = `行程单-${sanitizeFilename(plan.name)}.html`
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
