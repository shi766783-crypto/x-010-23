<script setup>
import { ref } from 'vue'
import Modal from '../common/Modal.vue'
import { downloadPlanHtml, printPlan } from '../../services/exportPlan'

const props = defineProps({
  show: { type: Boolean, default: false },
  plan: { type: Object, default: null },
})

const emit = defineEmits(['close'])

const exporting = ref(false)
const feedback = ref(null) // { type: 'success' | 'error', text: '' }

function resetState() {
  exporting.value = false
  feedback.value = null
}

function handleClose() {
  if (exporting.value) return
  emit('close')
}

async function run(action, successText) {
  if (exporting.value || !props.plan) return
  exporting.value = true
  feedback.value = null
  try {
    await action(props.plan)
    feedback.value = { type: 'success', text: successText }
  } catch (error) {
    const reason = error?.message || '未知错误'
    feedback.value = { type: 'error', text: `导出失败：${reason}` }
  } finally {
    exporting.value = false
  }
}

function onDownload() {
  return run(downloadPlanHtml, '行程单已开始下载，可直接发给家人或用浏览器打开打印')
}

function onPrint() {
  return run(printPlan, '已打开打印窗口，在对话框中选择打印机或“另存为 PDF”即可')
}
</script>

<template>
  <Modal :show="show" title="导出行程单" @close="handleClose">
    <div v-if="plan" class="export-modal">
      <p class="export-desc">
        将「<strong>{{ plan.name }}</strong>」导出为一份完整行程单，包含行程安排、花费汇总和出行总结，
        格式方便打印和转发给家人。
      </p>

      <div class="export-options">
        <button
          type="button"
          class="export-option"
          :disabled="exporting"
          @click="onPrint"
        >
          <span class="option-icon">🖨</span>
          <span class="option-body">
            <strong>打印 / 保存为 PDF</strong>
            <small>打开排版好的打印窗口，可直接打印或另存为 PDF 转发</small>
          </span>
        </button>

        <button
          type="button"
          class="export-option"
          :disabled="exporting"
          @click="onDownload"
        >
          <span class="option-icon">📄</span>
          <span class="option-body">
            <strong>下载 HTML 行程单</strong>
            <small>保存为单个网页文件，双击即可查看，也可自行打印</small>
          </span>
        </button>
      </div>

      <p v-if="exporting" class="export-feedback export-loading">正在生成行程单…</p>
      <p v-else-if="feedback?.type === 'success'" class="export-feedback export-success">
        ✓ {{ feedback.text }}
      </p>
      <p v-else-if="feedback?.type === 'error'" class="export-feedback export-error">
        ✕ {{ feedback.text }}
      </p>

      <p class="export-tip text-muted">
        提示：尚未填写的行程记录或出行总结会在行程单中显示为空说明，可先补充内容后再导出。
      </p>
    </div>

    <template #footer>
      <button type="button" class="btn btn-ghost" :disabled="exporting" @click="handleClose">关闭</button>
    </template>
  </Modal>
</template>

<style scoped>
.export-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.7;
}

.export-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.export-option {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  transition: border-color 0.15s, background 0.15s;
}

.export-option:hover:not(:disabled) {
  border-color: var(--primary);
  background: var(--primary-light);
}

.export-option:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.option-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  background: var(--bg);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.option-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-body strong {
  font-size: 14px;
}

.option-body small {
  font-size: 12px;
  color: var(--text-muted);
}

.export-feedback {
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.export-loading {
  background: var(--primary-light);
  color: var(--primary);
}

.export-success {
  background: var(--success-light);
  color: var(--success);
}

.export-error {
  background: var(--danger-light);
  color: var(--danger);
}

.export-tip {
  margin-top: 14px;
  font-size: 12px;
  line-height: 1.6;
}
</style>
