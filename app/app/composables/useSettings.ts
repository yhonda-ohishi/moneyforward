const SENDER_ADDRESSES_KEY = 'invoice-sender-addresses'
const DRIVE_FOLDER_NAME_KEY = 'invoice-drive-folder-name'
const RECONCILE_DATE_TOLERANCE_KEY = 'reconcile-date-tolerance'
const PAGE_SIZE_KEY = 'invoice-page-size'
export const DEFAULT_DRIVE_FOLDER_NAME = '電帳法インボイス'
export const DEFAULT_RECONCILE_DATE_TOLERANCE = 14
export const DEFAULT_PAGE_SIZE = 20

export function useSettings() {
  const senderAddresses = useState<string[]>('sender-addresses', () => {
    if (import.meta.client) {
      const saved = localStorage.getItem(SENDER_ADDRESSES_KEY)
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  const driveFolderName = useState<string>('drive-folder-name', () => {
    if (import.meta.client) {
      return localStorage.getItem(DRIVE_FOLDER_NAME_KEY) || DEFAULT_DRIVE_FOLDER_NAME
    }
    return DEFAULT_DRIVE_FOLDER_NAME
  })

  function addSenderAddress(address: string): void {
    const trimmed = address.trim().toLowerCase()
    if (!trimmed || senderAddresses.value.includes(trimmed)) return
    senderAddresses.value = [...senderAddresses.value, trimmed]
    localStorage.setItem(SENDER_ADDRESSES_KEY, JSON.stringify(senderAddresses.value))
  }

  function removeSenderAddress(address: string): void {
    senderAddresses.value = senderAddresses.value.filter((a) => a !== address)
    localStorage.setItem(SENDER_ADDRESSES_KEY, JSON.stringify(senderAddresses.value))
  }

  function setDriveFolderName(name: string): void {
    const trimmed = name.trim()
    if (!trimmed) return
    driveFolderName.value = trimmed
    localStorage.setItem(DRIVE_FOLDER_NAME_KEY, trimmed)
  }

  const reconcileDateTolerance = useState<number>('reconcile-date-tolerance', () => {
    if (import.meta.client) {
      const saved = localStorage.getItem(RECONCILE_DATE_TOLERANCE_KEY)
      return saved ? parseInt(saved, 10) : DEFAULT_RECONCILE_DATE_TOLERANCE
    }
    return DEFAULT_RECONCILE_DATE_TOLERANCE
  })

  function setReconcileDateTolerance(days: number): void {
    const clamped = Math.max(0, Math.floor(days))
    reconcileDateTolerance.value = clamped
    localStorage.setItem(RECONCILE_DATE_TOLERANCE_KEY, String(clamped))
  }

  const pageSize = useState<number>('page-size', () => {
    if (import.meta.client) {
      const saved = localStorage.getItem(PAGE_SIZE_KEY)
      return saved ? parseInt(saved, 10) : DEFAULT_PAGE_SIZE
    }
    return DEFAULT_PAGE_SIZE
  })

  function setPageSize(size: number): void {
    pageSize.value = size
    localStorage.setItem(PAGE_SIZE_KEY, String(size))
  }

  return {
    senderAddresses: readonly(senderAddresses),
    addSenderAddress,
    removeSenderAddress,
    driveFolderName: readonly(driveFolderName),
    setDriveFolderName,
    reconcileDateTolerance: readonly(reconcileDateTolerance),
    setReconcileDateTolerance,
    pageSize: readonly(pageSize),
    setPageSize,
  }
}
