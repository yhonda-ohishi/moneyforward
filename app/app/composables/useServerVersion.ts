const LOCAL_SERVER_URL = 'http://localhost:3939'
const GITHUB_REPO = 'yhonda-ohishi-pub-dev/dencho-cli'

interface GitHubAsset {
  name: string
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  html_url: string
  body: string
  assets: GitHubAsset[]
}

export function useServerVersion() {
  const currentVersion = ref<string | null>(null)
  const latestVersion = ref<string | null>(null)
  const updateAvailable = ref(false)
  const downloadUrlMsi = ref<string | null>(null)
  const downloadUrlZip = ref<string | null>(null)
  const releaseUrl = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const serverOnline = ref(false)

  function isNewerVersion(current: string, latest: string): boolean {
    const currentParts = current.split('.').map(Number)
    const latestParts = latest.split('.').map(Number)

    for (let i = 0; i < 3; i++) {
      if ((latestParts[i] || 0) > (currentParts[i] || 0)) return true
      if ((latestParts[i] || 0) < (currentParts[i] || 0)) return false
    }
    return false
  }

  async function fetchCurrentVersion(): Promise<string | null> {
    try {
      const res = await fetch(`${LOCAL_SERVER_URL}/api/version`)
      if (!res.ok) throw new Error('Server responded with error')
      const data = await res.json()
      serverOnline.value = true
      return data.version
    } catch {
      serverOnline.value = false
      return null
    }
  }

  async function fetchLatestVersion(): Promise<void> {
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      if (!res.ok) {
        if (res.status === 404) {
          // No releases yet
          return
        }
        throw new Error('Failed to fetch latest release')
      }

      const data: GitHubRelease = await res.json()
      const version = data.tag_name.replace(/^v/, '')
      latestVersion.value = version
      releaseUrl.value = data.html_url

      // Find MSI and ZIP assets
      for (const asset of data.assets) {
        if (asset.name.endsWith('.msi')) {
          downloadUrlMsi.value = asset.browser_download_url
        } else if (asset.name.endsWith('.zip')) {
          downloadUrlZip.value = asset.browser_download_url
        }
      }
    } catch {
      // Silently fail - just don't show latest version info
    }
  }

  async function checkForUpdates(): Promise<void> {
    loading.value = true
    error.value = null
    updateAvailable.value = false
    downloadUrlMsi.value = null
    downloadUrlZip.value = null
    releaseUrl.value = null

    try {
      const version = await fetchCurrentVersion()
      currentVersion.value = version

      if (!version) {
        error.value = 'サーバーに接続できません'
        return
      }

      await fetchLatestVersion()

      if (latestVersion.value && currentVersion.value) {
        updateAvailable.value = isNewerVersion(currentVersion.value, latestVersion.value)
      }
    } finally {
      loading.value = false
    }
  }

  return {
    currentVersion: readonly(currentVersion),
    latestVersion: readonly(latestVersion),
    updateAvailable: readonly(updateAvailable),
    downloadUrlMsi: readonly(downloadUrlMsi),
    downloadUrlZip: readonly(downloadUrlZip),
    releaseUrl: readonly(releaseUrl),
    loading: readonly(loading),
    error: readonly(error),
    serverOnline: readonly(serverOnline),
    checkForUpdates,
  }
}
