import type { GmailMessage, GmailSearchParams } from '~/types/gmail'

/** 保存済み検索条件 */
export interface SavedSearch {
  /** 一意ID (timestamp-based) */
  id: string
  /** 表示ラベル */
  label: string
  /** 検索パラメータ */
  params: {
    query?: string
    fromAddresses?: string[]
    hasAttachment?: boolean
  }
  /** 初回保存日時 */
  createdAt: string
  /** 最終使用日時 */
  lastUsedAt: string
}

/** 月次ページの検索ソース */
export interface MonthlySearchSource {
  /** 一意キー: 'sender:email@...' or 'saved:id' */
  key: string
  /** ソース種別 */
  type: 'sender' | 'saved'
  /** 表示ラベル */
  label: string
  /** 補足説明 */
  description?: string
  /** 検索パラメータ (dateFrom/dateTo は月選択から注入) */
  baseParams: Omit<GmailSearchParams, 'dateFrom' | 'dateTo' | 'maxResults' | 'pageToken'>
}

/** 月次検索の結果 */
export interface MonthlySearchResult {
  source: MonthlySearchSource
  /** 検索状態 */
  status: 'idle' | 'searching' | 'done' | 'error'
  /** エラーメッセージ */
  error?: string
  /** 検出メール一覧 */
  messages: (GmailMessage & { _imported?: boolean })[]
  /** 取込済件数 */
  importedCount: number
  /** 未取込件数 */
  unimportedCount: number
  /** カード展開状態 */
  expanded: boolean
}
