import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DocumentType } from '~/types/invoice'

const STORAGE_KEY = 'gemini-api-key'

export interface ParsedInvoice {
  transactionDate: string
  amount: number
  currency?: string
  counterparty: string
  documentType: DocumentType
  memo?: string
}

const PARSE_PROMPT = `この書類画像/PDFから以下の情報をJSON形式で抽出してください。
日本の電子帳簿保存法（電帳法）に基づく管理に必要な項目です。

必須項目:
- transactionDate: 取引年月日 (YYYY-MM-DD形式)
- amount: 取引金額 (税込、数値のみ)
- currency: 通貨コード (ISO 4217形式: "JPY", "USD", "EUR" など。書類に通貨が明記されていない場合は "JPY")
- counterparty: 取引先名（書類の発行元・販売元の会社名。"Bill to"や"請求先"に記載された宛先ではなく、書類を発行した側の名前を抽出すること。Amazonマーケットプレイスの場合は個別の出品者名ではなく "Amazon" とすること）
- documentType: 書類種別 (以下のいずれか: "invoice", "receipt", "quotation", "delivery_slip", "contract", "other")

任意項目:
- memo: その他の重要な情報（摘要、品目など）

注意:
- PDFが複数ページある場合は全ページを確認すること
- amountは全ページの合計金額（税込）を合算すること。例: 1ページ目が¥2,166、2ページ目が¥1,839なら、amountは4005とすること
- Amazonマーケットプレイスの請求書は出品者ごとに別ページになるが、同一注文番号なら1つの取引として全ページの金額を合算し、counterpartyは "Amazon" とすること
- 「マーケットプレイス商品の税率は、アマゾンジャパン合同会社ではなく」という記載がある場合はAmazonの請求書と判断すること

JSONのみを返してください。説明文は不要です。
`

export function useGemini() {
  function getApiKey(): string | null {
    return localStorage.getItem(STORAGE_KEY)
  }

  function setApiKey(key: string): void {
    localStorage.setItem(STORAGE_KEY, key)
  }

  function removeApiKey(): void {
    localStorage.removeItem(STORAGE_KEY)
  }

  function hasApiKey(): boolean {
    return !!getApiKey()
  }

  async function parseInvoice(fileData: string, mimeType: string): Promise<ParsedInvoice> {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('Gemini API キーが設定されていません。設定画面で入力してください。')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent([
      PARSE_PROMPT,
      {
        inlineData: {
          data: fileData,
          mimeType,
        },
      },
    ])

    const text = result.response.text()

    // Try extracting from ```json ... ``` code block first
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    const jsonStr = codeBlockMatch
      ? codeBlockMatch[1]
      : text.match(/\{[\s\S]*\}/)?.[0]

    if (!jsonStr) {
      throw new Error('Gemini API から有効なJSONが返されませんでした')
    }

    let parsed: ParsedInvoice
    try {
      parsed = JSON.parse(jsonStr) as ParsedInvoice
    } catch {
      // Greedy match may have captured trailing text after the JSON.
      // Find the matching closing brace by counting braces.
      const start = text.indexOf('{')
      if (start === -1) {
        throw new Error('Gemini API から有効なJSONが返されませんでした')
      }
      let depth = 0
      let end = -1
      for (let i = start; i < text.length; i++) {
        if (text[i] === '{') depth++
        else if (text[i] === '}') depth--
        if (depth === 0) { end = i; break }
      }
      if (end === -1) {
        throw new Error('Gemini API から有効なJSONが返されませんでした')
      }
      parsed = JSON.parse(text.slice(start, end + 1)) as ParsedInvoice
    }

    if (!parsed.transactionDate || parsed.amount == null || !parsed.counterparty) {
      throw new Error('必須項目（取引年月日、金額、取引先）が抽出できませんでした')
    }

    return parsed
  }

  return {
    getApiKey,
    setApiKey,
    removeApiKey,
    hasApiKey,
    parseInvoice,
  }
}
