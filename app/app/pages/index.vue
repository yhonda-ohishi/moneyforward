<script setup lang="ts">
import type { MFTransaction, ReconcileResult, ReconcileStatus } from '~/types/reconcile'
import type { Invoice } from '~/types/invoice'

useHead({ title: '突合' })

const { loadFromBackup, loadLocalInvoices, reconcileManual } = useReconcile()

const results = ref<ReconcileResult[]>([])
const parsedTransactions = ref<MFTransaction[]>([])
const localInvoices = ref<Invoice[]>([])
const loadingJournals = ref(false)
const loadError = ref('')
const resultFilter = ref<ReconcileStatus | 'all'>('all')

interface MatchesFile {
  matches: Record<string, string>
}

const summary = computed(() => {
  const total = results.value.length
  const matched = results.value.filter(r => r.status === 'matched').length
  const unmatched = results.value.filter(r => r.status === 'unmatched').length
  const notApplicable = results.value.filter(r => r.status === 'not_applicable').length
  return { total, matched, unmatched, notApplicable }
})

async function loadAndReconcile() {
  loadingJournals.value = true
  loadError.value = ''
  try {
    parsedTransactions.value = await loadFromBackup()

    try {
      localInvoices.value = await loadLocalInvoices()
    } catch { localInvoices.value = [] }

    // matches.json を読み込み
    let manualMap: Record<string, string> = {}
    try {
      const data = await $fetch<MatchesFile>('/data/matches.json')
      manualMap = data.matches || {}
    } catch { /* matches.json がなければ空 */ }

    results.value = reconcileManual(parsedTransactions.value, localInvoices.value, manualMap)
  } catch (e: any) {
    loadError.value = 'バックアップデータの読み込みに失敗しました。'
  } finally {
    loadingJournals.value = false
  }
}

onMounted(() => {
  loadAndReconcile()
})
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold">突合</h2>

    <div v-if="loadingJournals" class="text-center py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl" />
      <p class="mt-2">読み込み中...</p>
    </div>

    <UAlert v-if="loadError" color="error" :title="loadError" icon="i-lucide-alert-circle" />

    <UAlert
      v-if="parsedTransactions.length > 0 && !loadingJournals"
      color="info"
      icon="i-lucide-database"
      :title="`${parsedTransactions.length} 件の仕訳 × ${localInvoices.length} 件のインボイスを読み込みました`"
    />

    <!-- サマリー -->
    <ReconcileSummary v-if="results.length > 0" :summary="summary" :active-filter="resultFilter" @filter="resultFilter = $event" />

    <!-- 突合結果テーブル -->
    <ReconcileResultTable
      v-if="results.length > 0"
      v-model="resultFilter"
      :results="results"
    />
  </div>
</template>
