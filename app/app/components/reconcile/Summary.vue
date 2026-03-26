<script setup lang="ts">
import type { ReconcileStatus } from '~/types/reconcile'

type FilterValue = ReconcileStatus | 'all'

defineProps<{
  summary: {
    total: number
    matched: number
    unmatched: number
    notApplicable: number
  }
  activeFilter?: FilterValue
}>()

const emit = defineEmits<{
  filter: [value: FilterValue]
}>()
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <UCard
      class="cursor-pointer transition-shadow"
      :class="{ 'ring-2 ring-primary': activeFilter === 'all' }"
      @click="emit('filter', 'all')"
    >
      <div class="text-center">
        <div class="text-2xl font-bold">{{ summary.total }}</div>
        <div class="text-sm text-dimmed">全取引</div>
      </div>
    </UCard>
    <UCard
      class="cursor-pointer transition-shadow"
      :class="{ 'ring-2 ring-green-500': activeFilter === 'matched' }"
      @click="emit('filter', 'matched')"
    >
      <div class="text-center">
        <div class="text-2xl font-bold text-green-600">{{ summary.matched }}</div>
        <div class="text-sm text-dimmed">マッチ済み</div>
      </div>
    </UCard>
    <UCard
      class="cursor-pointer transition-shadow"
      :class="{ 'ring-2 ring-red-500': activeFilter === 'unmatched' }"
      @click="emit('filter', 'unmatched')"
    >
      <div class="text-center">
        <div class="text-2xl font-bold text-red-600">{{ summary.unmatched }}</div>
        <div class="text-sm text-dimmed">未マッチ（要対応）</div>
      </div>
    </UCard>
    <UCard
      class="cursor-pointer transition-shadow"
      :class="{ 'ring-2 ring-gray-400': activeFilter === 'not_applicable' }"
      @click="emit('filter', 'not_applicable')"
    >
      <div class="text-center">
        <div class="text-2xl font-bold text-gray-400">{{ summary.notApplicable }}</div>
        <div class="text-sm text-dimmed">対象外</div>
      </div>
    </UCard>
  </div>
</template>
