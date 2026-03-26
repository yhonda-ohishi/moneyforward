<script setup lang="ts">
import type { GmailMessage } from '~/types/gmail'
import type { MFTransaction } from '~/types/reconcile'

const props = defineProps<{
  unmatchedTransactions: MFTransaction[]
}>()

const emit = defineEmits<{
  imported: []
}>()

const { isLoggedIn } = useGoogleAuth()
const { searchEmails } = useGmail()
const { hasApiKey } = useGemini()
const { isGmailMessageImported, deleteByGmailMessageId } = useDatabase()
const { senderAddresses } = useSettings()
const { importEmails, importItems, importing } = useImport()

const searchQuery = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const searching = ref(false)
const searchError = ref('')
const hasSearched = ref(false)
const emails = ref<GmailMessage[]>([])
const selectedIds = ref<Set<string>>(new Set())
const nextPageToken = ref<string>()

async function handleSearch(pageToken?: string) {
  searching.value = true
  searchError.value = ''
  try {
    const result = await searchEmails({
      query: searchQuery.value || undefined,
      fromAddresses: senderAddresses.value.length ? [...senderAddresses.value] : undefined,
      dateFrom: dateFrom.value || undefined,
      dateTo: dateTo.value || undefined,
      hasAttachment: true,
      maxResults: 20,
      pageToken,
    })

    const messagesWithStatus = await Promise.all(
      result.messages.map(async (msg) => ({
        ...msg,
        _imported: await isGmailMessageImported(msg.id),
      })),
    )

    if (pageToken) {
      emails.value = [...emails.value, ...messagesWithStatus]
    } else {
      emails.value = messagesWithStatus
      selectedIds.value.clear()
    }
    nextPageToken.value = result.nextPageToken
    hasSearched.value = true
  } catch (e: any) {
    console.error('Search error:', e)
    searchError.value = e.message || '検索中にエラーが発生しました'
  } finally {
    searching.value = false
  }
}

function handleBulkSearch() {
  const allDates = props.unmatchedTransactions.map(t => t.date).filter(Boolean)
  if (allDates.length === 0) return

  const minDate = allDates.reduce((a, b) => (a < b ? a : b))
  const maxDate = allDates.reduce((a, b) => (a > b ? a : b))

  const from = new Date(minDate)
  from.setDate(from.getDate() - 7)
  const to = new Date(maxDate)
  to.setDate(to.getDate() + 7)

  dateFrom.value = from.toISOString().slice(0, 10)
  dateTo.value = to.toISOString().slice(0, 10)
  searchQuery.value = ''

  handleSearch()
}

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

const allSelected = computed({
  get: () => emails.value.length > 0 && selectedIds.value.size === emails.value.filter(e => e.hasAttachment && !(e as any)._imported).length,
  set: (val: boolean) => {
    if (val) {
      emails.value.filter(e => e.hasAttachment && !(e as any)._imported).forEach(e => selectedIds.value.add(e.id))
    } else {
      selectedIds.value.clear()
    }
  },
})

async function handleImport() {
  if (!hasApiKey()) {
    alert('Gemini API キーが設定されていません。設定画面で入力してください。')
    return
  }
  const selected = emails.value.filter(e => selectedIds.value.has(e.id))
  try {
    await importEmails(selected)
    emit('imported')
  } catch (e: any) {
    alert(e.message)
  }
}

const reimportingId = ref<string>()
async function handleReimport(email: GmailMessage) {
  if (!hasApiKey()) {
    alert('Gemini API キーが設定されていません。設定画面で入力してください。')
    return
  }
  reimportingId.value = email.id
  try {
    await deleteByGmailMessageId(email.id)
    await importEmails([email])
    // ステータスを更新
    ;(email as any)._imported = true
    emit('imported')
  } catch (e: any) {
    alert(e.message)
  } finally {
    reimportingId.value = undefined
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('ja-JP')
  } catch {
    return dateStr
  }
}

function formatFrom(from: string): string {
  const match = from.match(/^(.+?)\s*</)
  return match?.[1]?.replace(/"/g, '') ?? from
}
</script>

<template>
  <div class="space-y-4 pt-4">
    <!-- 未ログイン -->
    <div v-if="!isLoggedIn" class="text-center py-6 space-y-3">
      <UIcon name="i-lucide-mail" class="text-3xl text-muted" />
      <p>Gmail から検索するには Google アカウントとの連携が必要です。</p>
      <UButton to="/settings">設定画面へ</UButton>
    </div>

    <!-- ログイン済み -->
    <template v-else>
      <!-- 検索フォーム -->
      <form class="space-y-3" @submit.prevent="handleSearch()">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <UInput
            v-model="searchQuery"
            placeholder="キーワード（件名、本文など）"
            icon="i-lucide-search"
          />
          <UInput v-model="dateFrom" type="date" />
          <UInput v-model="dateTo" type="date" />
        </div>

        <div v-if="senderAddresses.length" class="flex flex-wrap gap-1">
          <span class="text-sm text-muted mr-1">送信元フィルタ:</span>
          <UBadge v-for="addr in senderAddresses" :key="addr" variant="subtle" size="sm">
            {{ addr }}
          </UBadge>
        </div>

        <div class="flex gap-2 flex-wrap">
          <UButton type="submit" :loading="searching" icon="i-lucide-search" size="sm">
            Gmail を検索
          </UButton>
          <UButton
            v-if="unmatchedTransactions.length > 0"
            variant="outline"
            icon="i-lucide-search"
            size="sm"
            :loading="searching"
            @click.prevent="handleBulkSearch"
          >
            未マッチ全件を一括検索
          </UButton>
          <UButton
            v-if="selectedIds.size > 0"
            color="success"
            :loading="importing"
            icon="i-lucide-download"
            size="sm"
            @click="handleImport"
          >
            選択した {{ selectedIds.size }} 件を取り込み
          </UButton>
        </div>
      </form>

      <!-- エラー -->
      <UAlert v-if="searchError" color="error" icon="i-lucide-alert-triangle" :title="searchError" />

      <!-- 検索結果なし -->
      <div v-if="hasSearched && !emails.length && !searchError" class="text-center py-4 text-muted">
        <UIcon name="i-lucide-search-x" class="text-2xl mb-1" />
        <p class="text-sm">検索結果がありません</p>
      </div>

      <!-- 検索結果 -->
      <div v-if="emails.length">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium">検索結果</span>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="allSelected" type="checkbox" class="rounded" />
            すべて選択
          </label>
        </div>

        <div class="divide-y divide-default">
          <div
            v-for="email in emails"
            :key="email.id"
            class="flex items-start gap-3 py-3"
            :class="{ 'opacity-50': (email as any)._imported }"
          >
            <input
              v-if="email.hasAttachment && !(email as any)._imported"
              type="checkbox"
              class="mt-1 rounded"
              :checked="selectedIds.has(email.id)"
              @change="toggleSelect(email.id)"
            />
            <div v-else class="w-4" />

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium truncate text-sm">{{ email.subject || '(件名なし)' }}</span>
                <UBadge v-if="(email as any)._imported" variant="subtle" size="xs">取込済</UBadge>
                <UButton
                  v-if="(email as any)._imported"
                  icon="i-lucide-refresh-cw"
                  variant="ghost"
                  color="warning"
                  size="xs"
                  :loading="reimportingId === email.id"
                  title="再取り込み"
                  class="shrink-0"
                  @click="handleReimport(email)"
                />
                <UButton
                  icon="i-lucide-external-link"
                  variant="ghost"
                  size="xs"
                  :to="`https://mail.google.com/mail/u/0/#inbox/${email.id}`"
                  target="_blank"
                  title="Gmailで開く"
                  class="shrink-0"
                />
              </div>
              <div class="text-xs text-muted flex gap-3 mt-1">
                <span>{{ formatFrom(email.from) }}</span>
                <span>{{ formatDate(email.date) }}</span>
              </div>
              <div v-if="email.attachments.length" class="flex flex-wrap gap-1 mt-1">
                <UBadge
                  v-for="att in email.attachments"
                  :key="att.attachmentId"
                  variant="outline"
                  size="xs"
                >
                  {{ att.filename }}
                </UBadge>
              </div>
            </div>
          </div>
        </div>

        <UButton
          v-if="nextPageToken"
          variant="outline"
          :loading="searching"
          block
          size="sm"
          class="mt-2"
          @click="handleSearch(nextPageToken)"
        >
          さらに読み込む
        </UButton>
      </div>

      <!-- 取り込み進捗 -->
      <div v-if="importItems.length" class="space-y-2">
        <span class="text-sm font-medium">取り込み状況</span>
        <div class="space-y-2">
          <div
            v-for="(item, idx) in importItems"
            :key="idx"
            class="flex items-center gap-3 rounded-md bg-muted/50 p-3"
          >
            <UIcon
              v-if="item.status === 'done'"
              name="i-lucide-check-circle"
              class="text-success shrink-0"
            />
            <UIcon
              v-else-if="item.status === 'error'"
              name="i-lucide-alert-circle"
              class="text-error shrink-0"
            />
            <UIcon
              v-else-if="item.status === 'processing'"
              name="i-lucide-loader-circle"
              class="animate-spin text-primary shrink-0"
            />
            <UIcon v-else name="i-lucide-clock" class="text-muted shrink-0" />

            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">
                {{ item.email.attachments[item.attachmentIndex]?.filename }}
              </div>
              <div class="text-xs text-muted">{{ formatFrom(item.email.from) }}</div>
              <div v-if="item.result" class="text-xs mt-1">
                {{ item.result.counterparty }} / {{ formatAmount(item.result.amount, item.result.currency) }} / {{ item.result.transactionDate }}
              </div>
              <div v-if="item.driveStatus === 'done'" class="flex items-center gap-1 mt-1">
                <UBadge variant="subtle" size="xs" color="success">Drive保存済</UBadge>
              </div>
              <div v-else-if="item.driveStatus === 'failed'" class="flex items-center gap-1 mt-1">
                <UBadge variant="subtle" size="xs" color="warning">Drive保存失敗</UBadge>
              </div>
              <div v-if="item.error" class="text-xs text-error mt-1">{{ item.error }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
