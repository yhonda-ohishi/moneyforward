<script setup lang="ts">
import type { MFTransaction } from '~/types/reconcile'

const emit = defineEmits<{
  parsed: [transactions: MFTransaction[]]
}>()

const { parseCSV } = useReconcile()

const loading = ref(false)
const error = ref('')
const storedFileName = useSessionStorage('reconcile-csv-name', '')
const fileName = ref(storedFileName.value)
const fileHandle = shallowRef<FileSystemFileHandle | null>(null)

const supportsFileAccess = typeof window !== 'undefined' && 'showOpenFilePicker' in window

async function processFile(file: File) {
  loading.value = true
  error.value = ''
  fileName.value = file.name
  storedFileName.value = file.name

  try {
    const transactions = await parseCSV(file)
    emit('parsed', transactions)
  } catch (e: any) {
    error.value = e.message || 'CSVの読み込みに失敗しました'
  } finally {
    loading.value = false
  }
}

async function openFilePicker() {
  if (supportsFileAccess) {
    try {
      const handles = await window.showOpenFilePicker({
        types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }],
        multiple: false,
      })
      const handle = handles[0]
      if (!handle) return
      fileHandle.value = handle
      const file = await handle.getFile()
      await processFile(file)
    } catch (e: any) {
      // ユーザーがキャンセルした場合は無視
      if (e.name === 'AbortError') return
      error.value = e.message || 'ファイルの読み込みに失敗しました'
    }
  } else {
    // フォールバック: 従来の input[type=file]
    ;(document.querySelector('#csv-file-input') as HTMLInputElement)?.click()
  }
}

async function reload() {
  if (!fileHandle.value) return
  try {
    const file = await fileHandle.value.getFile()
    await processFile(file)
  } catch (e: any) {
    error.value = e.message || '再読み込みに失敗しました'
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileHandle.value = null
  processFile(file)
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files[0]
  if (!file) return
  fileHandle.value = null
  processFile(file)
}
</script>

<template>
  <UCard>
    <div
      class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
      @drop="handleDrop"
      @dragover.prevent
      @click="openFilePicker"
    >
      <div class="text-4xl mb-2">📄</div>
      <p class="text-lg font-medium mb-1">Money Forward 仕訳帳CSVをアップロード</p>
      <p class="text-sm text-dimmed">クリックまたはドラッグ&ドロップ</p>
      <p v-if="fileName" class="mt-2 text-sm text-primary">{{ fileName }}</p>
      <!-- フォールバック用 hidden input -->
      <input
        v-if="!supportsFileAccess"
        id="csv-file-input"
        type="file"
        accept=".csv"
        class="hidden"
        @change="handleFileChange"
      >
    </div>

    <div v-if="fileHandle && fileName" class="mt-3 flex items-center justify-end gap-2">
      <UButton
        size="sm"
        variant="soft"
        icon="i-lucide-refresh-cw"
        :loading="loading"
        @click.stop="reload"
      >
        再読み込み
      </UButton>
    </div>
  </UCard>

  <div v-if="loading" class="text-center py-8">
    <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl" />
    <p class="mt-2">CSVを解析中...</p>
  </div>

  <UAlert v-if="error" color="error" :title="error" icon="i-lucide-alert-circle" />
</template>
