<script setup lang="ts">
import type { ReconcileResult, ReconcileStatus } from '~/types/reconcile'

type FilterValue = ReconcileStatus | 'all'

const props = defineProps<{
  results: ReconcileResult[]
  modelValue?: FilterValue
}>()

const emit = defineEmits<{
  'update:modelValue': [value: FilterValue]
}>()

const { getViewUrl } = useGoogleDrive()

const filter = computed({
  get: () => props.modelValue ?? 'all',
  set: (v: FilterValue) => emit('update:modelValue', v),
})

const filteredResults = computed(() => {
  if (filter.value === 'all') return props.results
  return props.results.filter(r => r.status === filter.value)
})

const statusLabel: Record<ReconcileStatus, string> = {
  matched: 'マッチ',
  unmatched: '未マッチ',
  not_applicable: '対象外',
}

const statusColor = {
  matched: 'success',
  unmatched: 'error',
  not_applicable: 'neutral',
} as const
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <span class="font-semibold">突合結果（{{ filteredResults.length }} 件）</span>
        <div class="flex gap-2">
          <UButton size="xs" :variant="filter === 'all' ? 'solid' : 'ghost'" @click="filter = 'all'">
            全件
          </UButton>
          <UButton size="xs" color="error" :variant="filter === 'unmatched' ? 'solid' : 'ghost'" @click="filter = 'unmatched'">
            未マッチ
          </UButton>
          <UButton size="xs" color="success" :variant="filter === 'matched' ? 'solid' : 'ghost'" @click="filter = 'matched'">
            マッチ済み
          </UButton>
          <UButton size="xs" color="neutral" :variant="filter === 'not_applicable' ? 'solid' : 'ghost'" @click="filter = 'not_applicable'">
            対象外
          </UButton>
        </div>
      </div>
    </template>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default text-left">
            <th class="pb-2 pr-4">取引日</th>
            <th class="pb-2 pr-4">勘定科目</th>
            <th class="pb-2 pr-4 text-right">金額</th>
            <th class="pb-2 pr-4">摘要</th>
            <th class="pb-2 pr-4">税区分</th>
            <th class="pb-2 pr-4">突合</th>
            <th class="pb-2 pr-4">対応書類</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, idx) in filteredResults"
            :key="idx"
            class="border-b border-muted"
            :class="{
              'bg-green-50 dark:bg-green-950/20': r.status === 'matched',
              'bg-red-50 dark:bg-red-950/20': r.status === 'unmatched',
              'opacity-50': r.status === 'not_applicable',
            }"
          >
            <td class="py-2 pr-4 whitespace-nowrap">{{ r.transaction.date }}</td>
            <td class="py-2 pr-4">{{ r.transaction.primaryAccount }}</td>
            <td class="py-2 pr-4 text-right whitespace-nowrap">{{ formatAmount(r.transaction.amount) }}</td>
            <td class="py-2 pr-4 max-w-xs truncate" :title="r.transaction.description">
              {{ r.transaction.description }}
            </td>
            <td class="py-2 pr-4 whitespace-nowrap">
              <span v-if="r.transaction.taxCategory" class="text-xs">{{ r.transaction.taxCategory }}</span>
              <span v-else class="text-xs text-dimmed">--</span>
            </td>
            <td class="py-2 pr-4">
              <UBadge :color="statusColor[r.status]" variant="subtle" size="xs">
                {{ statusLabel[r.status] }}
              </UBadge>
              <span
                v-if="r.matchedInvoice?.driveFolder"
                class="ml-1 text-xs"
                :class="r.matchedInvoice.driveFolder === 'tmp' ? 'text-warning' : 'text-muted'"
              >
                {{ r.matchedInvoice.driveFolder }}
              </span>
            </td>
            <td class="py-2 pr-4">
              <template v-if="r.matchedInvoice">
                <div class="text-xs">{{ r.matchedInvoice.counterparty }}</div>
                <UButton
                  v-if="r.matchedInvoice.driveFileId?.startsWith('/data/')"
                  icon="i-lucide-file-text"
                  variant="ghost"
                  size="xs"
                  :to="r.matchedInvoice.driveFileId"
                  target="_blank"
                  :label="r.matchedInvoice.driveFileName || '書類'"
                />
                <UButton
                  v-else-if="r.matchedInvoice.driveFileId"
                  icon="i-lucide-external-link"
                  variant="ghost"
                  size="xs"
                  :to="getViewUrl(r.matchedInvoice.driveFileId)"
                  target="_blank"
                  label="書類"
                />
              </template>
              <span v-else class="text-xs text-dimmed">--</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>
