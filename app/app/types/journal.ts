/** journals.json の借方/貸方 1側分 */
export interface JournalBranchSide {
  account_id: string
  account_name: string
  sub_account_id: string | null
  sub_account_name: string | null
  department_id: string | null
  department_name: string | null
  value: number
  tax_id: string
  tax_name: string
  tax_long_name: string
  tax_value: number
  trade_partner_code: string | null
  trade_partner_name: string | null
  invoice_kind: string
}

/** 仕訳の1明細行（借方・貸方ペア） */
export interface JournalBranch {
  debitor: JournalBranchSide | null
  creditor: JournalBranchSide | null
  remark: string
}

/** journals.json の仕訳1件 */
export interface Journal {
  id: string
  number: number
  transaction_date: string
  journal_type: string
  entered_by: string
  memo: string
  tags: string[]
  branches: JournalBranch[]
  voucher_file_ids: string[]
  create_time: string
  update_time: string
  term_period: number
  is_realized: boolean
}

/** journals.json のルート構造 */
export interface JournalsFile {
  journals: Journal[]
  metadata: {
    total_count: number
    total_pages: number
  }
}

/** backup_info.json の構造 */
export interface BackupInfo {
  backup_date: string
  fiscal_year: number
  total_journals: number
  office_name: string
  reason: string
}

/** 表示用にフラット化した仕訳行 */
export interface JournalDisplayRow {
  journal: Journal
  branchIndex: number
  date: string
  number: number
  debitAccount: string
  debitSubAccount: string
  debitAmount: number
  creditAccount: string
  creditSubAccount: string
  creditAmount: number
  taxCategory: string
  description: string
  tradePartner: string
  enteredBy: string
}
