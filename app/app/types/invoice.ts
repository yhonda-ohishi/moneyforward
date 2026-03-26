/** 電子帳簿保存法 書類メタデータ */
export interface Invoice {
  /** 一意ID (auto-increment) */
  id?: number
  /** 取引年月日 (YYYY-MM-DD) */
  transactionDate: string
  /** 取引金額 (税込) */
  amount: number
  /** 通貨コード (ISO 4217: JPY, USD, EUR など) */
  currency?: string
  /** 取引先名 */
  counterparty: string
  /** 書類種別 */
  documentType: DocumentType
  /** Google Drive ファイルID */
  driveFileId?: string
  /** Google Drive ファイル名 */
  driveFileName?: string
  /** Drive 保存先フォルダ ('tmp' | 年フォルダ '2025', '2026' 等) */
  driveFolder?: string
  /** Gemini API による抽出データ (JSON) */
  extractedData?: string
  /** Gmail メッセージID (重複取り込み防止) */
  gmailMessageId?: string
  /** 取り込み元 */
  sourceType?: 'gmail' | 'manual'
  /** メモ */
  memo?: string
  /** 登録日時 */
  createdAt: string
  /** 更新日時 */
  updatedAt: string
}

/** 書類種別 */
export type DocumentType =
  | 'invoice'        // 請求書
  | 'receipt'        // 領収書
  | 'quotation'      // 見積書
  | 'delivery_slip'  // 納品書
  | 'contract'       // 契約書
  | 'other'          // その他
