import type { GmailMessage, GmailAttachment, GmailSearchParams, GmailSearchResult } from '~/types/gmail'

const GMAIL_API = 'https://www.googleapis.com/gmail/v1/users/me'

export function useGmail() {
  const { getValidToken } = useGoogleAuth()

  async function fetchGmail(path: string, params?: Record<string, string>): Promise<any> {
    const token = await getValidToken()
    const url = new URL(`${GMAIL_API}${path}`)
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      if (res.status === 401) {
        const { logout } = useGoogleAuth()
        logout()
      }
      const error = await res.json().catch(() => ({}))
      throw new Error(`Gmail API error: ${res.status} ${error.error?.message || res.statusText}`)
    }

    return res.json()
  }

  function buildQuery(params: GmailSearchParams): string {
    const parts: string[] = []

    if (params.fromAddresses?.length) {
      const fromQuery = params.fromAddresses.map((addr) => `from:${addr}`).join(' OR ')
      parts.push(`(${fromQuery})`)
    }

    if (params.hasAttachment) {
      parts.push('has:attachment')
    }

    if (params.dateFrom) {
      parts.push(`after:${params.dateFrom}`)
    }

    if (params.dateTo) {
      parts.push(`before:${params.dateTo}`)
    }

    if (params.query) {
      parts.push(params.query)
    }

    return parts.join(' ')
  }

  async function searchEmails(params: GmailSearchParams): Promise<GmailSearchResult> {
    const query = buildQuery(params)
    const apiParams: Record<string, string> = {
      q: query,
      maxResults: String(params.maxResults || 20),
    }
    if (params.pageToken) {
      apiParams.pageToken = params.pageToken
    }

    const listResult = await fetchGmail('/messages', apiParams)

    if (!listResult.messages?.length) {
      return { messages: [], resultSizeEstimate: listResult.resultSizeEstimate || 0 }
    }

    const messages = await Promise.all(
      listResult.messages.map((m: { id: string }) => getEmail(m.id)),
    )

    return {
      messages,
      nextPageToken: listResult.nextPageToken,
      resultSizeEstimate: listResult.resultSizeEstimate || 0,
    }
  }

  async function getEmail(messageId: string): Promise<GmailMessage> {
    const data = await fetchGmail(`/messages/${messageId}`, { format: 'full' })

    const headers = data.payload?.headers || []
    const getHeader = (name: string) =>
      headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

    const attachments: GmailAttachment[] = []
    collectAttachments(data.payload, attachments)

    return {
      id: data.id,
      threadId: data.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      date: getHeader('Date'),
      snippet: data.snippet || '',
      hasAttachment: attachments.length > 0,
      attachments,
    }
  }

  function collectAttachments(part: any, attachments: GmailAttachment[]): void {
    if (!part) return

    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
      })
    }

    if (part.parts) {
      for (const child of part.parts) {
        collectAttachments(child, attachments)
      }
    }
  }

  async function getAttachment(messageId: string, attachmentId: string): Promise<string> {
    const data = await fetchGmail(`/messages/${messageId}/attachments/${attachmentId}`)
    // Gmail API returns URL-safe base64. Convert to standard base64.
    return data.data.replace(/-/g, '+').replace(/_/g, '/')
  }

  return {
    searchEmails,
    getEmail,
    getAttachment,
    buildQuery,
  }
}
