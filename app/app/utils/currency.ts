const CURRENCY_SYMBOLS: Record<string, string> = {
  JPY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  KRW: '₩',
  CNY: '¥',
}

export function formatAmount(amount: number, currency?: string): string {
  const code = currency || 'JPY'
  const symbol = CURRENCY_SYMBOLS[code] || code + ' '
  // JPY は小数なし、その他は小数2桁
  if (code === 'JPY') {
    return `${symbol}${amount.toLocaleString()}`
  }
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
