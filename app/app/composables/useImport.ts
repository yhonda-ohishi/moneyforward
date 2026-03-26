import type { GmailMessage } from '~/types/gmail'
import type { ParsedInvoice } from '~/composables/useGemini'

export interface ImportItem {
  email: GmailMessage
  status: 'pending' | 'processing' | 'done' | 'error'
  result?: ParsedInvoice
  error?: string
  attachmentIndex: number
  driveStatus?: 'uploading' | 'done' | 'failed'
}

export function useImport() {
  const { getAttachment } = useGmail()
  const { parseInvoice, hasApiKey } = useGemini()
  const { addInvoice } = useDatabase()
  const { uploadFile } = useGoogleDrive()

  const importItems = ref<ImportItem[]>([])
  const importing = ref(false)

  function buildDriveFileName(parsed: ParsedInvoice, originalFilename: string): string {
    const ext = originalFilename.includes('.')
      ? originalFilename.substring(originalFilename.lastIndexOf('.'))
      : ''
    const safeName = parsed.counterparty.replace(/[/\\:*?"<>|]/g, '_').substring(0, 30)
    return `${parsed.transactionDate}_${safeName}${ext}`
  }

  async function importEmails(emails: GmailMessage[]): Promise<ImportItem[]> {
    if (!hasApiKey()) {
      throw new Error('Gemini API キーが設定されていません。設定画面で入力してください。')
    }

    importing.value = true

    // Build import items (one per attachment)
    const items: ImportItem[] = []
    for (const email of emails) {
      for (let i = 0; i < email.attachments.length; i++) {
        items.push({ email, status: 'pending', attachmentIndex: i })
      }
    }
    importItems.value = items

    // Process sequentially to avoid rate limits
    for (const item of importItems.value) {
      item.status = 'processing'
      try {
        const att = item.email.attachments[item.attachmentIndex]!
        const fileData = await getAttachment(item.email.id, att.attachmentId)
        const parsed = await parseInvoice(fileData, att.mimeType)
        item.result = parsed

        // Upload to Google Drive
        let driveFileId: string | undefined
        let driveFileName: string | undefined
        item.driveStatus = 'uploading'
        try {
          const safeName = buildDriveFileName(parsed, att.filename)
          const driveFile = await uploadFile(fileData, safeName, att.mimeType)
          driveFileId = driveFile.id
          driveFileName = safeName
          item.driveStatus = 'done'
        } catch (driveError: any) {
          console.warn('Drive upload failed:', driveError.message)
          item.driveStatus = 'failed'
        }

        item.status = 'done'

        await addInvoice({
          transactionDate: parsed.transactionDate,
          amount: parsed.amount,
          currency: parsed.currency || 'JPY',
          counterparty: parsed.counterparty,
          documentType: parsed.documentType,
          gmailMessageId: item.email.id,
          sourceType: 'gmail',
          driveFileId,
          driveFileName: driveFileName || att.filename,
          extractedData: JSON.stringify(parsed),
          memo: parsed.memo || '',
        })
      } catch (e: any) {
        item.status = 'error'
        item.error = e.message
      }
    }

    importing.value = false
    return importItems.value
  }

  function resetImportState(): void {
    importItems.value = []
    importing.value = false
  }

  return {
    importItems: readonly(importItems),
    importing: readonly(importing),
    importEmails,
    resetImportState,
  }
}
