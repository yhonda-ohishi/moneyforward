import type { SavedSearch } from '~/types/searchHistory'

const SEARCH_HISTORY_KEY = 'invoice-search-history'
const MAX_ENTRIES = 30

export function useSearchHistory() {
  const searchHistory = useState<SavedSearch[]>('search-history', () => {
    if (import.meta.client) {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY)
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  function saveSearch(
    params: { query?: string; fromAddresses?: string[]; hasAttachment?: boolean },
    label?: string,
  ): void {
    const fingerprint = JSON.stringify({
      q: params.query || '',
      f: params.fromAddresses || [],
      a: params.hasAttachment ?? true,
    })

    const existing = searchHistory.value.find(
      (s) =>
        JSON.stringify({
          q: s.params.query || '',
          f: s.params.fromAddresses || [],
          a: s.params.hasAttachment ?? true,
        }) === fingerprint,
    )

    if (existing) {
      existing.lastUsedAt = new Date().toISOString()
    } else {
      const newSearch: SavedSearch = {
        id: Date.now().toString(36),
        label: label || buildAutoLabel(params),
        params,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      }
      searchHistory.value = [...searchHistory.value, newSearch]

      // 上限超過時は古い順に削除
      if (searchHistory.value.length > MAX_ENTRIES) {
        const sorted = [...searchHistory.value].sort(
          (a, b) => new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime(),
        )
        const toRemove = sorted.slice(0, searchHistory.value.length - MAX_ENTRIES)
        const removeIds = new Set(toRemove.map((s) => s.id))
        searchHistory.value = searchHistory.value.filter((s) => !removeIds.has(s.id))
      }
    }
    persist()
  }

  function removeSearch(id: string): void {
    searchHistory.value = searchHistory.value.filter((s) => s.id !== id)
    persist()
  }

  function updateLabel(id: string, label: string): void {
    const search = searchHistory.value.find((s) => s.id === id)
    if (search) {
      search.label = label
      persist()
    }
  }

  function persist(): void {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory.value))
    } catch (e) {
      console.warn('Failed to persist search history:', e)
    }
  }

  function buildAutoLabel(params: { query?: string; fromAddresses?: string[] }): string {
    const parts: string[] = []
    if (params.query) parts.push(params.query)
    if (params.fromAddresses?.length) parts.push(params.fromAddresses.join(', '))
    return parts.join(' | ') || '(条件なし)'
  }

  return {
    searchHistory: readonly(searchHistory),
    saveSearch,
    removeSearch,
    updateLabel,
  }
}
