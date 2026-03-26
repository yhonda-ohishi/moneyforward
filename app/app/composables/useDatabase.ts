import Dexie, { type EntityTable } from 'dexie'
import type { Invoice } from '~/types/invoice'

const db = new Dexie('denchoho-invoice') as Dexie & {
  invoices: EntityTable<Invoice, 'id'>
}

db.version(1).stores({
  invoices: '++id, transactionDate, amount, counterparty, documentType, gmailMessageId, createdAt',
})

export interface InvoiceSearchParams {
  dateFrom?: string
  dateTo?: string
  amountMin?: number
  amountMax?: number
  counterparty?: string
  documentType?: string
}

export function useDatabase() {
  async function addInvoice(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date().toISOString()
    const id = await db.invoices.add({
      ...invoice,
      createdAt: now,
      updatedAt: now,
    } as Invoice)
    return id as number
  }

  async function getInvoices(limit = 50, offset = 0): Promise<Invoice[]> {
    return await db.invoices
      .orderBy('createdAt')
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray()
  }

  async function getInvoice(id: number): Promise<Invoice | undefined> {
    return await db.invoices.get(id)
  }

  async function updateInvoice(id: number, updates: Partial<Invoice>): Promise<void> {
    await db.invoices.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    })
  }

  async function deleteInvoice(id: number): Promise<void> {
    await db.invoices.delete(id)
  }

  async function searchInvoices(params: InvoiceSearchParams): Promise<Invoice[]> {
    let collection = db.invoices.orderBy('transactionDate').reverse()

    const results = await collection.toArray()

    return results.filter((inv) => {
      if (params.dateFrom && inv.transactionDate < params.dateFrom) return false
      if (params.dateTo && inv.transactionDate > params.dateTo) return false
      if (params.amountMin != null && inv.amount < params.amountMin) return false
      if (params.amountMax != null && inv.amount > params.amountMax) return false
      if (params.counterparty && !inv.counterparty.includes(params.counterparty)) return false
      if (params.documentType && inv.documentType !== params.documentType) return false
      return true
    })
  }

  async function isGmailMessageImported(gmailMessageId: string): Promise<boolean> {
    const count = await db.invoices.where('gmailMessageId').equals(gmailMessageId).count()
    return count > 0
  }

  async function deleteByGmailMessageId(gmailMessageId: string): Promise<void> {
    await db.invoices.where('gmailMessageId').equals(gmailMessageId).delete()
  }

  async function getInvoiceCount(): Promise<number> {
    return await db.invoices.count()
  }

  async function getMonthlyTotal(yearMonth: string): Promise<number> {
    const invoices = await db.invoices
      .where('transactionDate')
      .between(yearMonth + '-01', yearMonth + '-31', true, true)
      .toArray()
    return invoices.reduce((sum, inv) => sum + inv.amount, 0)
  }

  async function buildSQLiteData(): Promise<{ base64: string, filename: string }> {
    const initSqlJs = (await import('sql.js')).default

    const SQL = await initSqlJs({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/${file}`,
    })

    const sqlDb = new SQL.Database()

    sqlDb.run(`
      CREATE TABLE invoices (
        id INTEGER PRIMARY KEY,
        transactionDate TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT,
        counterparty TEXT NOT NULL,
        documentType TEXT NOT NULL,
        driveFileId TEXT,
        driveFileName TEXT,
        driveFolder TEXT,
        extractedData TEXT,
        gmailMessageId TEXT,
        sourceType TEXT,
        memo TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `)

    const invoices = await db.invoices.toArray()

    const stmt = sqlDb.prepare(`
      INSERT INTO invoices (
        id, transactionDate, amount, currency, counterparty,
        documentType, driveFileId, driveFileName, driveFolder,
        extractedData, gmailMessageId, sourceType, memo,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const inv of invoices) {
      stmt.run([
        inv.id ?? null,
        inv.transactionDate,
        inv.amount,
        inv.currency ?? null,
        inv.counterparty,
        inv.documentType,
        inv.driveFileId ?? null,
        inv.driveFileName ?? null,
        inv.driveFolder ?? null,
        inv.extractedData ?? null,
        inv.gmailMessageId ?? null,
        inv.sourceType ?? null,
        inv.memo ?? null,
        inv.createdAt,
        inv.updatedAt,
      ])
    }
    stmt.free()

    const binaryArray = sqlDb.export()
    sqlDb.close()

    // Uint8Array → base64
    let binary = ''
    for (let i = 0; i < binaryArray.length; i++) {
      binary += String.fromCharCode(binaryArray[i])
    }
    const base64 = btoa(binary)

    const now = new Date()
    const yyyymmdd = now.getFullYear().toString()
      + (now.getMonth() + 1).toString().padStart(2, '0')
      + now.getDate().toString().padStart(2, '0')
    const filename = `denchoho-invoice_${yyyymmdd}.sqlite`

    return { base64, filename }
  }

  return {
    db,
    addInvoice,
    getInvoices,
    getInvoice,
    updateInvoice,
    deleteInvoice,
    searchInvoices,
    isGmailMessageImported,
    deleteByGmailMessageId,
    getInvoiceCount,
    getMonthlyTotal,
    buildSQLiteData,
  }
}
