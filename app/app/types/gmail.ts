/** Gmail メッセージ（リスト表示用） */
export interface GmailMessage {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  hasAttachment: boolean
  attachments: GmailAttachment[]
}

/** Gmail 添付ファイル */
export interface GmailAttachment {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
}

/** Gmail 検索パラメータ */
export interface GmailSearchParams {
  query?: string
  fromAddresses?: string[]
  dateFrom?: string
  dateTo?: string
  hasAttachment?: boolean
  maxResults?: number
  pageToken?: string
}

/** Gmail 検索結果 */
export interface GmailSearchResult {
  messages: GmailMessage[]
  nextPageToken?: string
  resultSizeEstimate: number
}
