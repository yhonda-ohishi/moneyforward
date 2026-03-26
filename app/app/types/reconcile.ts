import type { Invoice } from './invoice'

/** Money Forward 仕訳帳CSV 1行分 */
export interface MFJournalRow {
  transactionNo: string
  date: string              // YYYY-MM-DD (変換済み)
  debitAccount: string      // 借方勘定科目
  debitSubAccount: string   // 借方補助科目
  debitDepartment: string   // 借方部門
  debitCounterparty: string // 借方取引先
  debitTaxCategory: string  // 借方税区分
  debitInvoice: string      // 借方インボイス
  debitAmount: number       // 借方金額(円)
  creditAccount: string     // 貸方勘定科目
  creditSubAccount: string  // 貸方補助科目
  creditDepartment: string  // 貸方部門
  creditCounterparty: string // 貸方取引先
  creditTaxCategory: string // 貸方税区分
  creditInvoice: string     // 貸方インボイス
  creditAmount: number      // 貸方金額(円)
  description: string       // 摘要
  tag: string               // タグ
  memo: string              // メモ
}

/** 取引No でグループ化した取引単位 */
export interface MFTransaction {
  transactionNo: string
  date: string
  rows: MFJournalRow[]
  description: string        // 摘要（最初の非空値）
  needsDocument: boolean     // 課税区分があるか
  primaryAccount: string     // メインの勘定科目
  amount: number             // マッチング用金額
  taxCategory: string        // 課税区分（表示用）
}

export type ReconcileStatus = 'matched' | 'unmatched' | 'not_applicable'

export interface ReconcileResult {
  transaction: MFTransaction
  status: ReconcileStatus
  matchedInvoice?: Invoice
}
