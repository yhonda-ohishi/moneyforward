<script setup lang="ts">
import type { Invoice, DocumentType } from '~/types/invoice'

useHead({ title: '検索' })

const { searchInvoices } = useDatabase()
const { getViewUrl } = useGoogleDrive()
const { pageSize } = useSettings()

// --- データ一覧 (突合済みのみ) ---
const allReconciled = ref<Invoice[]>([])
const activeYear = ref('all')
const currentPage = ref(1)

const yearTabs = computed(() => {
  const years = [...new Set(allReconciled.value.map(inv => inv.driveFolder!))].sort().reverse()
  return [
    { label: `全件`, value: 'all' },
    ...years.map(y => ({ label: y, value: y })),
  ]
})

const filteredByYear = computed(() => {
  if (activeYear.value === 'all') return allReconciled.value
  return allReconciled.value.filter(inv => inv.driveFolder === activeYear.value)
})

const totalCount = computed(() => filteredByYear.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))
const listItems = computed(() => {
  const offset = (currentPage.value - 1) * pageSize.value
  return filteredByYear.value.slice(offset, offset + pageSize.value)
})

function selectYear(year: string) {
  activeYear.value = year
  currentPage.value = 1
}

async function loadData() {
  const all = await searchInvoices({})
  allReconciled.value = all.filter(inv => inv.driveFolder && /^\d{4}$/.test(inv.driveFolder))
}

onMounted(() => loadData())

// --- 検索 ---
const dateFrom = ref('')
const dateTo = ref('')
const amountMin = ref<number>()
const amountMax = ref<number>()
const counterparty = ref('')
const documentType = ref('all')
const results = ref<Invoice[]>([])
const searched = ref(false)

const docTypeOptions = [
  { label: 'すべて', value: 'all' },
  { label: '請求書', value: 'invoice' },
  { label: '領収書', value: 'receipt' },
  { label: '見積書', value: 'quotation' },
  { label: '納品書', value: 'delivery_slip' },
  { label: '契約書', value: 'contract' },
  { label: 'その他', value: 'other' },
]

const docTypeLabels: Record<DocumentType, string> = {
  invoice: '請求書',
  receipt: '領収書',
  quotation: '見積書',
  delivery_slip: '納品書',
  contract: '契約書',
  other: 'その他',
}

async function handleSearch() {
  results.value = await searchInvoices({
    dateFrom: dateFrom.value || undefined,
    dateTo: dateTo.value || undefined,
    amountMin: amountMin.value || undefined,
    amountMax: amountMax.value || undefined,
    counterparty: counterparty.value || undefined,
    documentType: documentType.value === 'all' ? undefined : documentType.value || undefined,
  })
  searched.value = true
}

</script>

<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold">検索</h2>

    <!-- データ一覧 -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-semibold">突合済みデータ一覧（{{ totalCount }} 件）</span>
          <div class="flex gap-1">
            <UButton
              v-for="tab in yearTabs"
              :key="tab.value"
              size="xs"
              :variant="activeYear === tab.value ? 'solid' : 'ghost'"
              @click="selectYear(tab.value)"
            >
              {{ tab.label }}
            </UButton>
          </div>
        </div>
      </template>

      <div v-if="totalCount === 0" class="text-center py-8 text-muted">
        登録されたデータがありません
      </div>

      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left">
                <th class="pb-2 pr-4">年度</th>
                <th class="pb-2 pr-4">取引年月日</th>
                <th class="pb-2 pr-4">取引先</th>
                <th class="pb-2 pr-4 text-right">金額</th>
                <th class="pb-2 pr-4">種別</th>
                <th class="pb-2 pr-4">取込元</th>
                <th class="pb-2 pr-4">書類</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inv in listItems" :key="inv.id" class="border-b border-muted">
                <td class="py-2 pr-4">
                  <UBadge color="success" variant="subtle" size="xs">{{ inv.driveFolder }}</UBadge>
                </td>
                <td class="py-2 pr-4">{{ inv.transactionDate }}</td>
                <td class="py-2 pr-4">{{ inv.counterparty }}</td>
                <td class="py-2 pr-4 text-right">{{ formatAmount(inv.amount, inv.currency) }}</td>
                <td class="py-2 pr-4">
                  <UBadge variant="subtle" size="xs">{{ docTypeLabels[inv.documentType] }}</UBadge>
                </td>
                <td class="py-2 pr-4">
                  <UButton
                    v-if="inv.sourceType === 'gmail' && inv.gmailMessageId"
                    icon="i-lucide-mail"
                    variant="ghost"
                    size="xs"
                    :to="`https://mail.google.com/mail/u/0/#inbox/${inv.gmailMessageId}`"
                    target="_blank"
                    label="Gmail"
                  />
                  <UBadge v-else-if="inv.sourceType === 'gmail'" variant="outline" size="xs">Gmail</UBadge>
                  <UBadge v-else variant="outline" size="xs">手動</UBadge>
                </td>
                <td class="py-2 pr-4">
                  <UButton
                    v-if="inv.driveFileId"
                    icon="i-lucide-external-link"
                    variant="ghost"
                    size="xs"
                    :to="getViewUrl(inv.driveFileId)"
                    target="_blank"
                    label="表示"
                  />
                  <span v-else class="text-xs text-dimmed">--</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- ページネーション -->
        <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 pt-4">
          <UButton
            icon="i-lucide-chevron-left"
            variant="ghost"
            size="xs"
            :disabled="currentPage <= 1"
            @click="currentPage--"
          />
          <span class="text-sm">{{ currentPage }} / {{ totalPages }}</span>
          <UButton
            icon="i-lucide-chevron-right"
            variant="ghost"
            size="xs"
            :disabled="currentPage >= totalPages"
            @click="currentPage++"
          />
        </div>
      </template>
    </UCard>

    <!-- 検索フォーム -->
    <UCard>
      <form class="space-y-4" @submit.prevent="handleSearch">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">取引年月日（開始）</label>
            <UInput v-model="dateFrom" type="date" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">取引年月日（終了）</label>
            <UInput v-model="dateTo" type="date" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">取引先</label>
            <UInput v-model="counterparty" placeholder="取引先名" icon="i-lucide-building" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">金額（下限）</label>
            <UInput v-model.number="amountMin" type="number" placeholder="0" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">金額（上限）</label>
            <UInput v-model.number="amountMax" type="number" placeholder="999999999" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">書類種別</label>
            <USelect v-model="documentType" :items="docTypeOptions" />
          </div>
        </div>

        <UButton type="submit" icon="i-lucide-search">検索</UButton>
      </form>
    </UCard>

    <!-- 検索結果 -->
    <UCard v-if="searched">
      <template #header>
        <span class="font-semibold">検索結果（{{ results.length }} 件）</span>
      </template>

      <div v-if="results.length === 0" class="text-center py-8 text-muted">
        条件に一致するデータがありません
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-default text-left">
              <th class="pb-2 pr-4">突合</th>
              <th class="pb-2 pr-4">取引年月日</th>
              <th class="pb-2 pr-4">取引先</th>
              <th class="pb-2 pr-4 text-right">金額</th>
              <th class="pb-2 pr-4">種別</th>
              <th class="pb-2 pr-4">取込元</th>
              <th class="pb-2 pr-4">書類</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inv in results" :key="inv.id" class="border-b border-muted">
              <td class="py-2 pr-4">
                <UBadge
                  v-if="inv.driveFolder && /^\d{4}$/.test(inv.driveFolder)"
                  color="success"
                  variant="subtle"
                  size="xs"
                >
                  {{ inv.driveFolder }}
                </UBadge>
                <UBadge v-else color="warning" variant="subtle" size="xs">未</UBadge>
              </td>
              <td class="py-2 pr-4">{{ inv.transactionDate }}</td>
              <td class="py-2 pr-4">{{ inv.counterparty }}</td>
              <td class="py-2 pr-4 text-right">{{ formatAmount(inv.amount, inv.currency) }}</td>
              <td class="py-2 pr-4">
                <UBadge variant="subtle" size="xs">{{ docTypeLabels[inv.documentType] }}</UBadge>
              </td>
              <td class="py-2 pr-4">
                <UButton
                  v-if="inv.sourceType === 'gmail' && inv.gmailMessageId"
                  icon="i-lucide-mail"
                  variant="ghost"
                  size="xs"
                  :to="`https://mail.google.com/mail/u/0/#inbox/${inv.gmailMessageId}`"
                  target="_blank"
                  label="Gmail"
                />
                <UBadge v-else-if="inv.sourceType === 'gmail'" variant="outline" size="xs">Gmail</UBadge>
                <UBadge v-else variant="outline" size="xs">手動</UBadge>
              </td>
              <td class="py-2 pr-4">
                <UButton
                  v-if="inv.driveFileId"
                  icon="i-lucide-external-link"
                  variant="ghost"
                  size="xs"
                  :to="getViewUrl(inv.driveFileId)"
                  target="_blank"
                  label="表示"
                />
                <span v-else class="text-xs text-dimmed">--</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
