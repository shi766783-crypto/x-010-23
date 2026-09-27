import { EXPENSE_CATEGORIES } from '../constants'
import { formatDate, formatMoney } from '../utils/format'
import { planTotalSpend, planSpendBreakdown } from './selectors'

// 转义动态内容，避免用户输入破坏导出的 HTML 结构
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 文件名清洗：去掉各系统不允许的字符
function safeFileName(name) {
  return (String(name || '行程单').trim() || '行程单')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 60)
}

// 生成时间：YYYY年M月D日 HH:mm
function formatGeneratedAt(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toNum(value) {
  return Number(value) || 0
}

// 单条记录当日花费合计
function recordTotal(record) {
  return EXPENSE_CATEGORIES.reduce((sum, { key }) => sum + toNum(record[key]), 0)
}

const EMPTY_RECORD_HTML = `
  <div class="empty-note">
    <p>暂无行程记录</p>
    <small>可在计划详情的「行程与花费」中添加后重新导出</small>
  </div>`

const EMPTY_SUMMARY_HTML = `
  <div class="empty-note">
    <p>暂无出行总结</p>
    <small>可在计划详情的「出行总结」中填写评分与心得后重新导出</small>
  </div>`

// 头部基本信息
function renderHeader(plan) {
  const memberNames = (plan.members || []).map((m) => escapeHtml(m.name)).join('、') || '未填写'
  const metaItems = [
    ['目的地', escapeHtml(plan.destination) || '未填写'],
    ['行程日期', `${formatDate(plan.startDate)} 至 ${formatDate(plan.endDate)}`],
    ['天数 / 人数', `${plan.days || 0} 天 · ${plan.memberCount || (plan.members || []).length || 0} 人`],
    ['出行类型', `${escapeHtml(plan.tripType || '未填写')} · ${escapeHtml(plan.destinationType || '')}`],
    ['交通方式', escapeHtml(plan.transport) || '未填写'],
    ['住宿信息', escapeHtml(plan.accommodation) || '未填写'],
  ]
  const metaRows = metaItems
    .map(([label, value]) => `<div class="meta-item"><span>${label}</span><strong>${value}</strong></div>`)
    .join('')

  return `
  <header class="doc-head">
    <h1>${escapeHtml(plan.name)} · 行程单</h1>
    <div class="meta-grid">${metaRows}</div>
    <div class="meta-members"><span>出行成员</span><strong>${memberNames}</strong></div>
    ${plan.notes ? `<div class="plan-notes"><span>备注</span><p>${escapeHtml(plan.notes)}</p></div>` : ''}
  </header>`
}

// 一、行程安排（按日期排序）
function renderRecords(plan) {
  const records = [...(plan.records || [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (!records.length) return EMPTY_RECORD_HTML

  const body = records
    .map((r, index) => {
      const costTags = EXPENSE_CATEGORIES.filter(({ key }) => toNum(r[key])).map(
        ({ key, label }) => `<span class="cost-tag">${label} ${formatMoney(r[key])}</span>`
      ).join('')

      return `
      <article class="record">
        <div class="record-head">
          <span class="record-day">第 ${index + 1} 天 · ${formatDate(r.date)}</span>
          <span class="record-total">当日合计 ${formatMoney(recordTotal(r))}</span>
        </div>
        <h3 class="record-title">${escapeHtml(r.itinerary) || '（未填写行程内容）'}</h3>
        ${r.notes ? `<p class="record-notes">${escapeHtml(r.notes)}</p>` : ''}
        ${costTags ? `<div class="cost-tags">${costTags}</div>` : '<div class="cost-tags"><span class="cost-tag cost-empty">当日无花费记录</span></div>'}
        ${r.photo ? `<img class="record-photo" src="${escapeHtml(r.photo)}" alt="行程照片" />` : ''}
      </article>`
    })
    .join('')

  return `<div class="record-list">${body}</div>`
}

// 二、花费汇总
function renderSpending(plan) {
  const totalSpend = planTotalSpend(plan)
  const budget = toNum(plan.budget)
  const balance = budget - totalSpend
  const breakdown = planSpendBreakdown(plan)

  const balanceLabel = balance >= 0 ? '预算结余' : '预算超支'
  const balanceClass = balance >= 0 ? 'good' : 'bad'

  const rows = EXPENSE_CATEGORIES.map(({ key, label }) => {
    const amount = toNum(breakdown[label])
    const percent = totalSpend > 0 ? `${Math.round((amount / totalSpend) * 100)}%` : '—'
    return `
      <tr>
        <td>${label}</td>
        <td class="num">${formatMoney(amount)}</td>
        <td class="num">${percent}</td>
      </tr>`
  }).join('')

  return `
  <div class="sum-cards">
    <div class="sum-card"><span>总花费</span><strong>${formatMoney(totalSpend)}</strong></div>
    <div class="sum-card"><span>预算</span><strong>${formatMoney(budget)}</strong></div>
    <div class="sum-card ${balanceClass}"><span>${balanceLabel}</span><strong>${formatMoney(Math.abs(balance))}</strong></div>
  </div>
  <table class="cost-table">
    <thead>
      <tr><th>花费分类</th><th class="num">金额</th><th class="num">占比</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

// 三、出行总结
function renderSummary(plan) {
  const summary = plan.summary
  if (!summary) return EMPTY_SUMMARY_HTML

  const rating = Math.min(5, Math.max(0, Math.round(toNum(summary.rating))))
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
  const blocks = [
    ['总体评分', rating ? `${stars} <em>${rating} / 5 分</em>` : '未评分'],
    ['亮点', escapeHtml(summary.highlights) || '未填写'],
    ['遗憾', escapeHtml(summary.regrets) || '未填写'],
    ['下次建议', escapeHtml(summary.suggestions) || '未填写'],
  ]
  const blockHtml = blocks
    .map(([label, value]) => `
      <div class="sum-block">
        <span class="sum-block-label">${label}</span>
        <p class="sum-block-text">${value}</p>
      </div>`)
    .join('')

  const photos = (summary.photos || [])
    .filter(Boolean)
    .map((src) => `<img src="${escapeHtml(src)}" alt="精选照片" />`)
    .join('')

  return `
  <div class="trip-summary">
    ${blockHtml}
    ${photos ? `<div class="sum-block"><span class="sum-block-label">精选照片</span><div class="summary-photos">${photos}</div></div>` : ''}
  </div>`
}

const DOC_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
      'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    color: #1f2937; background: #f5f7fb; line-height: 1.7; font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }
  .toolbar {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 10px 20px; background: #1e2433; color: #cbd5e1; font-size: 12px;
  }
  .toolbar button {
    border: none; border-radius: 8px; padding: 8px 18px;
    background: #4f6ef7; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .sheet {
    max-width: 820px; margin: 24px auto; background: #fff;
    border-radius: 12px; padding: 40px 48px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }
  .doc-head h1 { font-size: 26px; margin-bottom: 18px; color: #1e2433; }
  .meta-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px;
    padding: 16px; background: #f9fafb; border-radius: 10px;
  }
  .meta-item, .meta-members, .plan-notes { display: flex; gap: 8px; font-size: 13px; }
  .meta-item span, .meta-members span, .plan-notes span { color: #6b7280; flex-shrink: 0; }
  .meta-item strong, .meta-members strong { font-weight: 600; }
  .meta-members { margin-top: 12px; font-size: 13px; }
  .plan-notes { margin-top: 8px; font-size: 13px; align-items: flex-start; }
  .plan-notes p { white-space: pre-wrap; }
  section { margin-top: 32px; }
  h2 {
    font-size: 18px; color: #1e2433;
    padding-bottom: 8px; margin-bottom: 16px;
    border-bottom: 2px solid #4f6ef7;
  }
  .empty-note {
    border: 1px dashed #d1d5db; border-radius: 10px; background: #f9fafb;
    padding: 28px 20px; text-align: center; color: #6b7280;
  }
  .empty-note p { font-weight: 600; color: #4b5563; margin-bottom: 4px; }
  .empty-note small { color: #9ca3af; }
  .record-list { display: flex; flex-direction: column; gap: 14px; }
  .record {
    border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px;
    break-inside: avoid;
  }
  .record-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .record-day { color: #4f6ef7; font-weight: 700; font-size: 13px; }
  .record-total { font-weight: 700; font-size: 13px; }
  .record-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
  .record-notes { color: #4b5563; font-size: 13px; white-space: pre-wrap; }
  .cost-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .cost-tag {
    background: #eef1fe; color: #3b56d4; border-radius: 20px;
    padding: 2px 12px; font-size: 12px; font-weight: 500;
  }
  .cost-empty { background: #f3f4f6; color: #9ca3af; }
  .record-photo {
    display: block; max-width: 280px; max-height: 200px;
    border-radius: 8px; margin-top: 12px; object-fit: cover;
  }
  .sum-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
  .sum-card {
    background: #f9fafb; border-radius: 10px; padding: 16px;
    display: flex; flex-direction: column; break-inside: avoid;
  }
  .sum-card span { font-size: 12px; color: #6b7280; }
  .sum-card strong { font-size: 20px; margin-top: 2px; }
  .sum-card.good strong { color: #059669; }
  .sum-card.bad strong { color: #dc2626; }
  .cost-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .cost-table th, .cost-table td { padding: 9px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  .cost-table th { background: #f9fafb; color: #6b7280; font-weight: 500; }
  .cost-table .num { text-align: right; }
  .trip-summary { display: flex; flex-direction: column; gap: 16px; }
  .sum-block-label { display: block; font-size: 13px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }
  .sum-block-text { white-space: pre-wrap; }
  .sum-block-text em { font-style: normal; color: #f59e0b; font-size: 16px; margin-left: 6px; }
  .summary-photos { display: flex; flex-wrap: wrap; gap: 10px; }
  .summary-photos img {
    width: 150px; height: 110px; object-fit: cover; border-radius: 8px;
    border: 1px solid #e5e7eb; break-inside: avoid;
  }
  .doc-footer {
    margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb;
    text-align: center; color: #9ca3af; font-size: 12px;
  }
  @page { margin: 14mm; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .sheet { box-shadow: none; margin: 0; max-width: none; padding: 0; border-radius: 0; }
    .record, .sum-card, .summary-photos img { break-inside: avoid; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`

// 组装完整的行程单 HTML 文档
export function buildItineraryHtml(plan, { autoPrint = false } = {}) {
  if (!plan || !plan.id) {
    throw new Error('计划数据缺失，无法导出行程单')
  }

  const autoPrintScript = autoPrint
    ? `<script>
         window.addEventListener('load', function () {
           setTimeout(function () { try { window.focus(); window.print(); } catch (e) {} }, 300);
         });
       <\/script>`
    : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(plan.name)} · 行程单</title>
  <style>${DOC_STYLES}</style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">🖨 打印 / 保存为 PDF</button>
    <span>由家庭出行规划与行李管家导出 · ${formatGeneratedAt()}</span>
  </div>
  <main class="sheet">
    ${renderHeader(plan)}
    <section>
      <h2>一、行程安排</h2>
      ${renderRecords(plan)}
    </section>
    <section>
      <h2>二、花费汇总</h2>
      ${renderSpending(plan)}
    </section>
    <section>
      <h2>三、出行总结</h2>
      ${renderSummary(plan)}
    </section>
    <footer class="doc-footer">
      本行程单由「家庭出行规划与行李管家」生成，可直接打印或转发给家人 · 导出时间 ${formatGeneratedAt()}
    </footer>
  </main>
  ${autoPrintScript}
</body>
</html>`
}

// 下载为独立 HTML 文件（照片已内嵌为 data URL，离线可看、可转发）
export function downloadPlanHtml(plan) {
  const html = buildItineraryHtml(plan)
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = `${safeFileName(plan.name)}-行程单.html`
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

// 打开打印窗口（自动唤起打印对话框，可在对话框中选择“另存为 PDF”）
export function printPlan(plan) {
  const html = buildItineraryHtml(plan, { autoPrint: true })
  const win = window.open('', '_blank')
  if (!win) {
    throw new Error('浏览器拦截了打印窗口，请允许本站弹出窗口，或改用「下载行程单」后在浏览器中打印')
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}
