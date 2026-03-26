<script setup lang="ts">
import type { JournalDisplayRow } from '~/types/journal'

defineProps<{
  rows: JournalDisplayRow[]
}>()
</script>

<template>
  <UCard>
    <template #header>
      <span class="font-semibold">仕訳一覧（{{ rows.length }} 行）</span>
    </template>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default text-left">
            <th class="pb-2 pr-3">No.</th>
            <th class="pb-2 pr-3">取引日</th>
            <th class="pb-2 pr-3">借方科目</th>
            <th class="pb-2 pr-3 text-right">借方金額</th>
            <th class="pb-2 pr-3">貸方科目</th>
            <th class="pb-2 pr-3 text-right">貸方金額</th>
            <th class="pb-2 pr-3">摘要</th>
            <th class="pb-2 pr-3">取引先</th>
            <th class="pb-2 pr-3">税区分</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in rows"
            :key="`${row.number}-${row.branchIndex}`"
            class="border-b border-muted"
            :class="{
              'bg-blue-50 dark:bg-blue-950/20': row.taxCategory.includes('課税仕入'),
            }"
          >
            <td class="py-2 pr-3 whitespace-nowrap text-muted">{{ row.branchIndex === 0 ? row.number : '' }}</td>
            <td class="py-2 pr-3 whitespace-nowrap">{{ row.branchIndex === 0 ? row.date : '' }}</td>
            <td class="py-2 pr-3">
              <div>{{ row.debitAccount }}</div>
              <div v-if="row.debitSubAccount" class="text-xs text-dimmed truncate max-w-[200px]" :title="row.debitSubAccount">{{ row.debitSubAccount }}</div>
            </td>
            <td class="py-2 pr-3 text-right whitespace-nowrap">{{ row.debitAmount ? formatAmount(row.debitAmount) : '' }}</td>
            <td class="py-2 pr-3">
              <div>{{ row.creditAccount }}</div>
              <div v-if="row.creditSubAccount" class="text-xs text-dimmed truncate max-w-[200px]" :title="row.creditSubAccount">{{ row.creditSubAccount }}</div>
            </td>
            <td class="py-2 pr-3 text-right whitespace-nowrap">{{ row.creditAmount ? formatAmount(row.creditAmount) : '' }}</td>
            <td class="py-2 pr-3 max-w-xs truncate" :title="row.description">{{ row.description }}</td>
            <td class="py-2 pr-3 whitespace-nowrap">{{ row.tradePartner }}</td>
            <td class="py-2 pr-3 whitespace-nowrap text-xs">
              <UBadge v-if="row.taxCategory.includes('課税仕入')" color="info" variant="subtle" size="xs">{{ row.taxCategory }}</UBadge>
              <UBadge v-else-if="row.taxCategory.includes('課売')" color="success" variant="subtle" size="xs">{{ row.taxCategory }}</UBadge>
              <span v-else class="text-dimmed">{{ row.taxCategory }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="rows.length === 0" class="text-center py-8 text-dimmed">
      該当する仕訳がありません
    </div>
  </UCard>
</template>
