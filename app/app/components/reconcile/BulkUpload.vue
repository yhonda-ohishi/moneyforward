<script setup lang="ts">
import type { ParsedInvoice } from '~/composables/useGemini'

const emit = defineEmits<{
  imported: []
}>()

const { parseInvoice, hasApiKey } = useGemini()
const { addInvoice } = useDatabase()
const { uploadFile } = useGoogleDrive()
const { getViewUrl } = useGoogleDrive()

interface UploadItem {
  file: File
  status: 'pending' | 'processing' | 'done' | 'error'
  result?: ParsedInvoice
  error?: string
  driveFileId?: string
  driveStatus?: 'uploading' | 'done' | 'failed'
}

const items = ref<UploadItem[]>([])
const processing = ref(false)
const dragOver = ref(false)

function addFiles(files: FileList | File[]) {
  const newItems: UploadItem[] = Array.from(files)
    .filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'))
    .map(f => ({ file: f, status: 'pending' as const }))
  items.value = [...items.value, ...newItems]
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) {
    addFiles(input.files)
    input.value = ''
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  dragOver.value = false
  if (event.dataTransfer?.files.length) {
    addFiles(event.dataTransfer.files)
  }
}

function removeItem(idx: number) {
  items.value.splice(idx, 1)
}

function buildDriveFileName(parsed: ParsedInvoice, originalFilename: string): string {
  const ext = originalFilename.includes('.')
    ? originalFilename.substring(originalFilename.lastIndexOf('.'))
    : ''
  const safeName = parsed.counterparty.replace(/[/\\:*?"<>|]/g, '_').substring(0, 30)
  return `${parsed.transactionDate}_${safeName}${ext}`
}

async function processAll() {
  if (!hasApiKey()) {
    alert('Gemini API キーが設定されていません。設定画面で入力してください。')
    return
  }

  processing.value = true

  for (const item of items.value) {
    if (item.status !== 'pending') continue
    item.status = 'processing'

    try {
      const base64 = await fileToBase64(item.file)
      const mimeType = item.file.type || 'application/pdf'

      const parsed = await parseInvoice(base64, mimeType)
      item.result = parsed

      let driveFileId: string | undefined
      let driveFileName: string | undefined
      item.driveStatus = 'uploading'
      try {
        const safeName = buildDriveFileName(parsed, item.file.name)
        const driveFile = await uploadFile(base64, safeName, mimeType)
        driveFileId = driveFile.id
        driveFileName = safeName
        item.driveFileId = driveFileId
        item.driveStatus = 'done'
      } catch (driveErr: any) {
        console.warn('Drive upload failed:', driveErr.message)
        item.driveStatus = 'failed'
      }

      await addInvoice({
        transactionDate: parsed.transactionDate,
        amount: parsed.amount,
        currency: parsed.currency || 'JPY',
        counterparty: parsed.counterparty,
        documentType: parsed.documentType,
        sourceType: 'manual',
        driveFileId,
        driveFileName: driveFileName || item.file.name,
        extractedData: JSON.stringify(parsed),
        memo: parsed.memo || '',
      })

      item.status = 'done'
    } catch (e: any) {
      item.status = 'error'
      item.error = e.message
    }
  }

  processing.value = false
  emit('imported')
}

const pendingCount = computed(() => items.value.filter(i => i.status === 'pending').length)
const doneCount = computed(() => items.value.filter(i => i.status === 'done').length)
</script>

<template>
  <div class="space-y-4 pt-4">
    <!-- ファイル選択エリア -->
    <div
      class="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
      :class="dragOver
        ? 'border-primary bg-primary/5'
        : 'border-gray-300 dark:border-gray-600 hover:border-primary'"
      @click="($refs.fileInput as HTMLInputElement)?.click()"
      @drop="handleDrop"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
    >
      <UIcon name="i-lucide-file-up" class="text-3xl mb-2 text-muted" />
      <p class="font-medium mb-1">PDF / 画像ファイルをアップロード</p>
      <p class="text-sm text-dimmed">クリックまたはドラッグ&ドロップ（複数選択可）</p>
      <input
        ref="fileInput"
        type="file"
        accept=".pdf,image/*"
        multiple
        class="hidden"
        @change="handleFileSelect"
      >
    </div>

    <!-- ファイルリスト -->
    <div v-if="items.length" class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">
          ファイル一覧（{{ doneCount }} / {{ items.length }} 件完了）
        </span>
        <UButton
          v-if="pendingCount > 0"
          icon="i-lucide-play"
          :loading="processing"
          color="success"
          size="xs"
          @click="processAll"
        >
          {{ pendingCount }} 件を取り込み
        </UButton>
      </div>

      <div class="space-y-2">
        <div
          v-for="(item, idx) in items"
          :key="idx"
          class="flex items-center gap-3 rounded-md bg-muted/50 p-3"
        >
          <UIcon
            v-if="item.status === 'done'"
            name="i-lucide-check-circle"
            class="text-green-600 shrink-0"
          />
          <UIcon
            v-else-if="item.status === 'error'"
            name="i-lucide-alert-circle"
            class="text-red-600 shrink-0"
          />
          <UIcon
            v-else-if="item.status === 'processing'"
            name="i-lucide-loader-2"
            class="animate-spin text-primary shrink-0"
          />
          <UIcon v-else name="i-lucide-file" class="text-muted shrink-0" />

          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ item.file.name }}</div>
            <div class="text-xs text-dimmed">{{ (item.file.size / 1024).toFixed(0) }} KB</div>

            <div v-if="item.result" class="text-xs mt-1 flex flex-wrap gap-2">
              <span>{{ item.result.counterparty }}</span>
              <span>{{ formatAmount(item.result.amount, item.result.currency) }}</span>
              <span>{{ item.result.transactionDate }}</span>
            </div>

            <div v-if="item.driveStatus === 'done' && item.driveFileId" class="flex items-center gap-1 mt-1">
              <UBadge variant="subtle" size="xs" color="success">Drive保存済</UBadge>
              <UButton
                icon="i-lucide-external-link"
                variant="ghost"
                size="xs"
                :to="getViewUrl(item.driveFileId)"
                target="_blank"
              />
            </div>
            <div v-else-if="item.driveStatus === 'failed'">
              <UBadge variant="subtle" size="xs" color="warning">Drive保存失敗</UBadge>
            </div>

            <div v-if="item.error" class="text-xs text-red-500 mt-1">{{ item.error }}</div>
          </div>

          <UButton
            v-if="item.status === 'pending'"
            icon="i-lucide-x"
            variant="ghost"
            size="xs"
            @click="removeItem(idx)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
