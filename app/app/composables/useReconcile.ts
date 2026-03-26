import type { Invoice } from '~/types/invoice'
import type { MFJournalRow, MFTransaction, ReconcileResult } from '~/types/reconcile'
import type { Journal, JournalsFile } from '~/types/journal'

/** CSVフィールドをパース（ダブルクォート対応） */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  fields.push(current)
  return fields
}

/** YYYY/MM/DD → YYYY-MM-DD */
function convertDate(mfDate: string): string {
  return mfDate.replace(/\//g, '-')
}

/** CSVの1行を MFJournalRow に変換 */
function rowFromFields(fields: string[]): MFJournalRow {
  return {
    transactionNo: fields[0] || '',
    date: fields[1] ? convertDate(fields[1]) : '',
    debitAccount: fields[2] || '',
    debitSubAccount: fields[3] || '',
    debitDepartment: fields[4] || '',
    debitCounterparty: fields[5] || '',
    debitTaxCategory: fields[6] || '',
    debitInvoice: fields[7] || '',
    debitAmount: parseInt(fields[8] || '0', 10) || 0,
    creditAccount: fields[9] || '',
    creditSubAccount: fields[10] || '',
    creditDepartment: fields[11] || '',
    creditCounterparty: fields[12] || '',
    creditTaxCategory: fields[13] || '',
    creditInvoice: fields[14] || '',
    creditAmount: parseInt(fields[15] || '0', 10) || 0,
    description: fields[16] || '',
    tag: fields[17] || '',
    memo: fields[18] || '',
  }
}

/** 税区分に「課税仕入」が含まれるか判定（課税売上は自社発行なので対象外） */
function hasTaxableCategory(row: MFJournalRow): boolean {
  return row.debitTaxCategory.includes('課税仕入') || row.creditTaxCategory.includes('課税仕入')
}

/** 取引グループからメイン勘定科目・金額・税区分を決定 */
function resolveTransaction(rows: MFJournalRow[]): {
  primaryAccount: string
  amount: number
  taxCategory: string
} {
  // 課税仕入のある行を優先
  for (const row of rows) {
    if (row.debitTaxCategory.includes('課税仕入')) {
      return {
        primaryAccount: row.debitAccount,
        amount: row.debitAmount,
        taxCategory: row.debitTaxCategory,
      }
    }
    if (row.creditTaxCategory.includes('課税売上')) {
      return {
        primaryAccount: row.creditAccount,
        amount: row.creditAmount,
        taxCategory: row.creditTaxCategory,
      }
    }
  }
  // 課税区分がない場合は最初の行の借方を使用
  const first = rows[0]!
  const taxCat = first.debitTaxCategory || first.creditTaxCategory
  return {
    primaryAccount: first.debitAccount || first.creditAccount,
    amount: first.debitAmount || first.creditAmount,
    taxCategory: taxCat,
  }
}

export function useReconcile() {
  /** Money Forward 仕訳帳CSVをパースして取引リストを返す */
  async function parseCSV(file: File): Promise<MFTransaction[]> {
    const buffer = await file.arrayBuffer()
    const decoder = new TextDecoder('shift_jis')
    const text = decoder.decode(buffer)

    const lines = text.split(/\r?\n/).filter(line => line.trim())
    // ヘッダー行をスキップ
    const dataLines = lines.slice(1)

    // 全行パース
    const allRows: MFJournalRow[] = dataLines.map(line => rowFromFields(parseCSVLine(line)))

    // 取引Noでグループ化（出現順を保持）
    const groups = new Map<string, MFJournalRow[]>()
    const order: string[] = []
    for (const row of allRows) {
      if (!row.transactionNo) continue
      if (!groups.has(row.transactionNo)) {
        groups.set(row.transactionNo, [])
        order.push(row.transactionNo)
      }
      groups.get(row.transactionNo)!.push(row)
    }

    // 取引単位にまとめる（日付順にソート）
    const transactions: MFTransaction[] = order.map((no) => {
      const rows = groups.get(no)!
      const firstRow = rows[0]!
      const description = rows.find(r => r.description)?.description || ''
      const needsDocument = rows.some(hasTaxableCategory)
      const { primaryAccount, amount, taxCategory } = resolveTransaction(rows)

      return {
        transactionNo: no,
        date: firstRow.date,
        rows,
        description,
        needsDocument,
        primaryAccount,
        amount,
        taxCategory,
      }
    })

    // 日付順にソート
    transactions.sort((a, b) => b.date.localeCompare(a.date))

    return transactions
  }

  /** マッチングで無視すべき一般的な社名サフィックス */
  const STOP_WORDS = new Set([
    'INC', 'CO', 'LTD', 'LLC', 'CORP', 'PTE', 'JP', 'GK', 'KK',
    'THE', 'OF', 'AND', 'FOR',
  ])

  /** 摘要からマッチング用キーワードを抽出 */
  function extractKeywords(description: string): string[] {
    // "VISA海外利用 GITHUB, INC." → ["GITHUB"]
    // "VISA国内利用 VS カゴヤ ジヤパン" → ["カゴヤ", "ジヤパン"]
    // "CLOUDFLARE利用国US" → ["CLOUDFLARE"]
    return description
      .replace(/^VISA[^\s]*\s*(VS\s+)?/i, '')
      .replace(/利用国[A-Z]{2}/gi, '')   // "利用国US" 等を除去
      .replace(/[,.*()（）]/g, ' ')
      .split(/\s+/)
      .map(w => w.toUpperCase())
      .filter(w => w.length >= 2 && !STOP_WORDS.has(w))
  }

  /** 取引先名と摘要キーワードのあいまいマッチ */
  function fuzzyMatchCounterparty(invoiceCounterparty: string, mfDescription: string): boolean {
    if (!invoiceCounterparty || !mfDescription) return false

    const keywords = extractKeywords(mfDescription)
    if (keywords.length === 0) return false

    const counterpartyUpper = invoiceCounterparty.toUpperCase()

    // 取引先名をトークン分割（スペース、カンマ、ピリオド、ハイフン、中黒で分割）
    const counterpartyWords = counterpartyUpper
      .split(/[\s,.\-・]+/)
      .filter(w => w.length >= 2 && !STOP_WORDS.has(w))

    return keywords.some((kw) => {
      // 1. キーワードが取引先のトークンと完全一致
      if (counterpartyWords.some(cw => cw === kw)) return true

      // 2. キーワードが取引先トークンの部分文字列で、長さが70%以上
      if (counterpartyWords.some(cw =>
        cw.includes(kw) && kw.length / cw.length >= 0.7
      )) return true

      // 3. 取引先名全体がキーワードに含まれる（短い取引先名への対応）
      if (kw.includes(counterpartyUpper) && counterpartyUpper.length >= 3) return true

      return false
    })
  }

  /** 請求書日付がMF取引日付の maxDays 日前以内かを判定 */
  function isDateInRange(invoiceDate: string, txDate: string, maxDays: number): boolean {
    if (maxDays === 0) return invoiceDate === txDate
    const invTime = new Date(invoiceDate).getTime()
    const txTime = new Date(txDate).getTime()
    const diffDays = (txTime - invTime) / (1000 * 60 * 60 * 24)
    return diffDays >= 0 && diffDays <= maxDays
  }

  /** 日付差（日数）を返す */
  function dateDiff(invoiceDate: string, txDate: string): number {
    return (new Date(txDate).getTime() - new Date(invoiceDate).getTime()) / (1000 * 60 * 60 * 24)
  }

  /** MF取引リストとインボイスを突合 */
  function reconcile(transactions: MFTransaction[], invoices: Invoice[], dateTolerance: number = 0): ReconcileResult[] {
    // インボイスのコピーを作り、マッチ済みを追跡（Driveにファイルがないものは除外）
    const availableInvoices = invoices
      .filter(inv => inv.driveFileId)
      .map(inv => ({ ...inv, _used: false }))

    console.group('[reconcile] 突合開始')
    console.log(`MF取引: ${transactions.length}件, インボイス: ${invoices.length}件, 許容日数: ${dateTolerance}日`)
    console.log('インボイス一覧:', invoices.map(inv => ({ date: inv.transactionDate, amount: inv.amount, counterparty: inv.counterparty })))

    function markMatched(tx: MFTransaction, match: typeof availableInvoices[number]): ReconcileResult {
      match._used = true
      const { _used, ...invoice } = match
      return {
        transaction: tx,
        status: 'matched' as const,
        matchedInvoice: invoice as Invoice,
      }
    }

    /** 候補から日付が最も近いものを選択 */
    function findClosest(candidates: typeof availableInvoices, txDate: string) {
      if (candidates.length === 0) return undefined
      return candidates.reduce((closest, inv) =>
        dateDiff(inv.transactionDate, txDate) < dateDiff(closest.transactionDate, txDate) ? inv : closest
      )
    }

    // 2パス方式: 金額一致を優先し、fuzzyマッチで誤消費を防ぐ
    const results: ReconcileResult[] = new Array(transactions.length)

    // Pass 1: 日付範囲内 + 金額一致（日付が近いものを優先）
    transactions.forEach((tx, i) => {
      if (!tx.needsDocument) {
        results[i] = { transaction: tx, status: 'not_applicable' as const }
        return
      }

      const amountMatches = availableInvoices.filter(
        inv => !inv._used && isDateInRange(inv.transactionDate, tx.date, dateTolerance) && inv.amount === tx.amount
      )
      const exactMatch = findClosest(amountMatches, tx.date)
      if (exactMatch) {
        console.log(`%c[MATCH] No.${tx.transactionNo} ${tx.date} ¥${tx.amount} "${tx.description}" → 金額一致: ${exactMatch.counterparty}`, 'color: green')
        results[i] = markMatched(tx, exactMatch)
      }
    })

    // Pass 2: 日付範囲内 + 取引先名のあいまいマッチ（外貨取引など金額が異なるケース）
    transactions.forEach((tx, i) => {
      if (results[i]) return

      const debugInvoices = availableInvoices
        .filter(inv => !inv._used)
        .map(inv => ({
          counterparty: inv.counterparty,
          date: inv.transactionDate,
          amount: inv.amount,
          dateDiff: Math.round(dateDiff(inv.transactionDate, tx.date) * 10) / 10,
          dateInRange: isDateInRange(inv.transactionDate, tx.date, dateTolerance),
          amountMatch: inv.amount === tx.amount,
          fuzzyMatch: fuzzyMatchCounterparty(inv.counterparty, tx.description),
          keywords: extractKeywords(tx.description),
        }))

      const fuzzyMatches = availableInvoices.filter(
        inv => !inv._used && isDateInRange(inv.transactionDate, tx.date, dateTolerance) && fuzzyMatchCounterparty(inv.counterparty, tx.description)
      )
      const fuzzyMatch = findClosest(fuzzyMatches, tx.date)
      if (fuzzyMatch) {
        console.log(`%c[MATCH] No.${tx.transactionNo} ${tx.date} ¥${tx.amount} "${tx.description}" → 取引先一致: ${fuzzyMatch.counterparty}`, 'color: green')
        results[i] = markMatched(tx, fuzzyMatch)
        return
      }

      console.log(`%c[UNMATCH] No.${tx.transactionNo} ${tx.date} ¥${tx.amount} "${tx.description}"`, 'color: red')
      console.table(debugInvoices)

      results[i] = { transaction: tx, status: 'unmatched' as const }
    })

    console.groupEnd()
    return results
  }

  /** journals.json (JSON) → MFTransaction[] に変換 */
  function parseJournalsJson(data: JournalsFile): MFTransaction[] {
    const transactions: MFTransaction[] = data.journals.map((j: Journal) => {
      // branches から MFJournalRow 互換のデータを生成
      const rows: MFJournalRow[] = j.branches.map(b => ({
        transactionNo: String(j.number),
        date: j.transaction_date,
        debitAccount: b.debitor?.account_name || '',
        debitSubAccount: b.debitor?.sub_account_name || '',
        debitDepartment: b.debitor?.department_name || '',
        debitCounterparty: b.debitor?.trade_partner_name || '',
        debitTaxCategory: b.debitor?.tax_long_name || '',
        debitInvoice: b.debitor?.invoice_kind || '',
        debitAmount: b.debitor?.value || 0,
        creditAccount: b.creditor?.account_name || '',
        creditSubAccount: b.creditor?.sub_account_name || '',
        creditDepartment: b.creditor?.department_name || '',
        creditCounterparty: b.creditor?.trade_partner_name || '',
        creditTaxCategory: b.creditor?.tax_long_name || '',
        creditInvoice: b.creditor?.invoice_kind || '',
        creditAmount: b.creditor?.value || 0,
        description: b.remark || '',
        tag: j.tags.join(','),
        memo: j.memo || '',
      }))

      const description = rows.find(r => r.description)?.description || ''
      const needsDocument = rows.some(hasTaxableCategory)
      const { primaryAccount, amount, taxCategory } = resolveTransaction(rows)

      return {
        transactionNo: String(j.number),
        date: j.transaction_date,
        rows,
        description,
        needsDocument,
        primaryAccount,
        amount,
        taxCategory,
      }
    })

    transactions.sort((a, b) => b.date.localeCompare(a.date))
    return transactions
  }

  /** 指定年度の journals.json を読み込み */
  async function loadFromBackup(year: string = '2026'): Promise<MFTransaction[]> {
    const data = await $fetch<JournalsFile>(`/data/${year}/journals.json`)
    return parseJournalsJson(data)
  }

  /** ローカルインボイスインデックスを読み込み → Invoice[] 互換に変換 */
  async function loadLocalInvoices(): Promise<Invoice[]> {
    interface LocalInvoiceEntry {
      fileName: string
      path: string
      year: string
      transactionDate: string
      counterparty: string
    }
    const entries = await $fetch<LocalInvoiceEntry[]>('/data/invoices.json')
    return entries.map((e, i) => ({
      id: i + 1,
      transactionDate: e.transactionDate,
      amount: 0, // ファイル名から金額不明 → 取引先マッチで突合
      counterparty: e.counterparty,
      documentType: 'invoice' as const,
      driveFileId: e.path, // ローカルパスをIDとして使用
      driveFileName: e.fileName,
      driveFolder: e.year,
      sourceType: 'manual' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
  }

  /** ローカルインボイスとの突合（取引先名マッチ優先） */
  function reconcileLocal(transactions: MFTransaction[], invoices: Invoice[], dateTolerance: number = 14): ReconcileResult[] {
    const available = invoices.map(inv => ({ ...inv, _used: false }))

    const results: ReconcileResult[] = new Array(transactions.length)

    // Pass 1: 日付範囲内 + 取引先名fuzzyマッチ
    transactions.forEach((tx, i) => {
      if (!tx.needsDocument) {
        results[i] = { transaction: tx, status: 'not_applicable' as const }
        return
      }

      const matches = available.filter(
        inv => !inv._used && isDateInRange(inv.transactionDate, tx.date, dateTolerance) && fuzzyMatchCounterparty(inv.counterparty, tx.description),
      )

      if (matches.length > 0) {
        const closest = matches.reduce((a, b) =>
          Math.abs(dateDiff(a.transactionDate, tx.date)) < Math.abs(dateDiff(b.transactionDate, tx.date)) ? a : b,
        )
        closest._used = true
        const { _used, ...invoice } = closest
        results[i] = { transaction: tx, status: 'matched' as const, matchedInvoice: invoice as Invoice }
        return
      }

      results[i] = { transaction: tx, status: 'unmatched' as const }
    })

    return results
  }

  /** matches.json のマッピングで突合結果を生成（年別対応） */
  function reconcileManual(transactions: MFTransaction[], invoices: Invoice[], manualMap: Record<string, Record<string, string>>, year: string): ReconcileResult[] {
    const yearMap = manualMap[year] || {}
    // matches.json のパス（"2026/file.pdf"）→ インボイスへのルックアップ
    // loadLocalInvoices の driveFileId は "/data/invoices/2026/file.pdf"
    const invoiceByShortPath = new Map<string, Invoice>()
    for (const inv of invoices) {
      const path = inv.driveFileId || ''
      // "/data/invoices/2026/file.pdf" → "2026/file.pdf"
      const short = path.replace(/^\/data\/invoices\//, '')
      invoiceByShortPath.set(short, inv)
    }

    return transactions.map((tx) => {
      if (!tx.needsDocument) {
        return { transaction: tx, status: 'not_applicable' as const }
      }
      const matchedPath = yearMap[tx.transactionNo]
      if (matchedPath) {
        const inv = invoiceByShortPath.get(matchedPath)
        if (inv) {
          return { transaction: tx, status: 'matched' as const, matchedInvoice: inv }
        }
      }
      return { transaction: tx, status: 'unmatched' as const }
    })
  }

  return { parseCSV, parseJournalsJson, loadFromBackup, loadLocalInvoices, reconcile, reconcileLocal, reconcileManual }
}
