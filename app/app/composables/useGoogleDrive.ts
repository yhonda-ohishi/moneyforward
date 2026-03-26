export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  webContentLink?: string
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

let cachedFolderId: string | null = null
let cachedFolderName: string | null = null
let cachedTmpFolderId: string | null = null
const cachedSubFolderIds = new Map<string, string>()

export function useGoogleDrive() {
  const { getValidToken } = useGoogleAuth()
  const { driveFolderName } = useSettings()

  async function fetchDrive(url: string, options: RequestInit = {}): Promise<any> {
    const token = await getValidToken()
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(`Drive API error: ${res.status} ${error.error?.message || res.statusText}`)
    }
    return res.json()
  }

  async function getOrCreateFolder(): Promise<string> {
    const folderName = driveFolderName.value

    // Clear cache if folder name changed
    if (cachedFolderId && cachedFolderName !== folderName) {
      cachedFolderId = null
      cachedFolderName = null
    }

    if (cachedFolderId) return cachedFolderId

    // Search for existing folder
    const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    const searchUrl = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`
    const result = await fetchDrive(searchUrl)

    if (result.files?.length > 0) {
      cachedFolderId = result.files[0].id
      cachedFolderName = folderName
      return cachedFolderId!
    }

    // Create folder
    const folder = await fetchDrive(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    })

    cachedFolderId = folder.id
    cachedFolderName = folderName
    return cachedFolderId!
  }

  async function getOrCreateSubFolder(name: string): Promise<string> {
    // tmp フォルダは専用キャッシュ
    if (name === 'tmp' && cachedTmpFolderId) return cachedTmpFolderId
    if (name !== 'tmp' && cachedSubFolderIds.has(name)) return cachedSubFolderIds.get(name)!

    const parentId = await getOrCreateFolder()

    const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    const searchUrl = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`
    const result = await fetchDrive(searchUrl)

    if (result.files?.length > 0) {
      const id = result.files[0].id as string
      if (name === 'tmp') cachedTmpFolderId = id
      else cachedSubFolderIds.set(name, id)
      return id
    }

    const folder = await fetchDrive(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    })

    const id = folder.id as string
    if (name === 'tmp') cachedTmpFolderId = id
    else cachedSubFolderIds.set(name, id)
    return id
  }

  async function getOrCreateTmpFolder(): Promise<string> {
    return getOrCreateSubFolder('tmp')
  }

  /** フォルダ名からフォルダIDを解決 ('tmp', '2025', '2026' 等) */
  async function resolveFolderId(folderName: string): Promise<string> {
    if (folderName === 'main') return getOrCreateFolder()
    return getOrCreateSubFolder(folderName)
  }

  async function uploadFileToTmp(
    fileData: string,
    fileName: string,
    mimeType: string,
  ): Promise<DriveFile> {
    const folderId = await getOrCreateTmpFolder()
    return uploadFileToFolder(fileData, fileName, mimeType, folderId)
  }

  /** フォルダ間でファイルを移動 (フォルダ名: 'tmp', 'main', '2025', '2026' 等) */
  async function moveFileBetweenFolders(fileId: string, from: string, to: string): Promise<void> {
    const fromId = await resolveFolderId(from)
    const toId = await resolveFolderId(to)
    await moveFile(fileId, fromId, toId)
  }

  async function moveFileToMain(fileId: string): Promise<void> {
    await moveFileBetweenFolders(fileId, 'tmp', 'main')
  }

  async function moveFileToTmp(fileId: string): Promise<void> {
    await moveFileBetweenFolders(fileId, 'main', 'tmp')
  }

  async function moveFile(fileId: string, fromFolderId: string, toFolderId: string): Promise<void> {
    const token = await getValidToken()
    const url = `${DRIVE_API}/files/${fileId}?addParents=${toFolderId}&removeParents=${fromFolderId}`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(`Drive move error: ${res.status} ${error.error?.message || res.statusText}`)
    }
  }

  async function uploadFile(
    fileData: string,
    fileName: string,
    mimeType: string,
  ): Promise<DriveFile> {
    const folderId = await getOrCreateFolder()
    return uploadFileToFolder(fileData, fileName, mimeType, folderId)
  }

  async function uploadFileToFolder(
    fileData: string,
    fileName: string,
    mimeType: string,
    folderId: string,
  ): Promise<DriveFile> {
    const token = await getValidToken()

    // 同名ファイルが既にあれば上書き (PATCH)
    const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`
    const searchUrl = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)&spaces=drive`
    const existing = await fetchDrive(searchUrl)
    const existingId = existing.files?.[0]?.id as string | undefined

    const boundary = '-------denchoho_boundary'
    const metadata = existingId
      ? { name: fileName }
      : { name: fileName, parents: [folderId] }

    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      `${fileData}\r\n` +
      `--${boundary}--`

    const uploadUrl = existingId
      ? `${DRIVE_UPLOAD_API}/files/${existingId}?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink`
      : `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink`

    const res = await fetch(uploadUrl, {
      method: existingId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(`Drive upload error: ${res.status} ${error.error?.message || res.statusText}`)
    }

    return await res.json()
  }

  function getViewUrl(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/view`
  }

  function getDownloadUrl(fileId: string): string {
    return `https://drive.google.com/uc?export=download&id=${fileId}`
  }

  async function deleteFile(fileId: string): Promise<void> {
    const token = await getValidToken()
    const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok && res.status !== 404) {
      const error = await res.json().catch(() => ({}))
      throw new Error(`Drive delete error: ${res.status} ${error.error?.message || res.statusText}`)
    }
  }

  return {
    uploadFile,
    uploadFileToTmp,
    moveFileToMain,
    moveFileToTmp,
    moveFileBetweenFolders,
    getViewUrl,
    getDownloadUrl,
    deleteFile,
  }
}
