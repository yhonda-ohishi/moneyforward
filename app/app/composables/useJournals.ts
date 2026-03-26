import type { Journal, JournalsFile, JournalDisplayRow } from '~/types/journal'

export function useJournals() {
  const journals = ref<Journal[]>([])
  const loading = ref(false)
  const error = ref('')
  const backupDate = ref('')

  /** public/data/journals.json を自動読み込み */
  async function loadJournals() {
    loading.value = true
    error.value = ''
    try {
      const data = await $fetch<JournalsFile>('/data/journals.json')
      journals.value = data.journals
      // backup_info.json も読み込み
      try {
        const info = await $fetch<{ backup_date: string }>('/data/backup_info.json')
        backupDate.value = info.backup_date
      } catch {
        backupDate.value = ''
      }
    } catch (e: any) {
      error.value = 'バックアップデータの読み込みに失敗しました。backups/ にデータがあるか確認してください。'
      journals.value = []
    } finally {
      loading.value = false
    }
  }

  /** Journal[] → 表示用フラット行に変換 */
  function toDisplayRows(list: Journal[]): JournalDisplayRow[] {
    const rows: JournalDisplayRow[] = []
    for (const j of list) {
      for (let i = 0; i < j.branches.length; i++) {
        const b = j.branches[i]!
        rows.push({
          journal: j,
          branchIndex: i,
          date: j.transaction_date,
          number: j.number,
          debitAccount: b.debitor?.account_name || '',
          debitSubAccount: b.debitor?.sub_account_name || '',
          debitAmount: b.debitor?.value || 0,
          creditAccount: b.creditor?.account_name || '',
          creditSubAccount: b.creditor?.sub_account_name || '',
          creditAmount: b.creditor?.value || 0,
          taxCategory: b.debitor?.tax_long_name || b.creditor?.tax_long_name || '',
          description: b.remark || j.memo || '',
          tradePartner: b.debitor?.trade_partner_name || b.creditor?.trade_partner_name || '',
          enteredBy: j.entered_by,
        })
      }
    }
    return rows
  }

  /** フィルタ適用 */
  function filterJournals(
    list: Journal[],
    filters: {
      dateFrom?: string
      dateTo?: string
      account?: string
      text?: string
    },
  ): Journal[] {
    return list.filter((j) => {
      if (filters.dateFrom && j.transaction_date < filters.dateFrom) return false
      if (filters.dateTo && j.transaction_date > filters.dateTo) return false

      if (filters.account) {
        const hasAccount = j.branches.some(b =>
          b.debitor?.account_name?.includes(filters.account!) ||
          b.creditor?.account_name?.includes(filters.account!) ||
          b.debitor?.sub_account_name?.includes(filters.account!) ||
          b.creditor?.sub_account_name?.includes(filters.account!),
        )
        if (!hasAccount) return false
      }

      if (filters.text) {
        const t = filters.text.toLowerCase()
        const match = j.branches.some(b =>
          b.remark?.toLowerCase().includes(t) ||
          b.debitor?.trade_partner_name?.toLowerCase().includes(t) ||
          b.creditor?.trade_partner_name?.toLowerCase().includes(t) ||
          b.debitor?.account_name?.toLowerCase().includes(t) ||
          b.creditor?.account_name?.toLowerCase().includes(t),
        ) || j.memo?.toLowerCase().includes(t)
        if (!match) return false
      }

      return true
    })
  }

  /** 勘定科目の一覧を抽出 */
  function extractAccounts(list: Journal[]): string[] {
    const set = new Set<string>()
    for (const j of list) {
      for (const b of j.branches) {
        if (b.debitor?.account_name) set.add(b.debitor.account_name)
        if (b.creditor?.account_name) set.add(b.creditor.account_name)
      }
    }
    return [...set].sort()
  }

  return {
    journals,
    loading,
    error,
    backupDate,
    loadJournals,
    toDisplayRows,
    filterJournals,
    extractAccounts,
  }
}
