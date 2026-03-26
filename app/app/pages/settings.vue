<script setup lang="ts">
useHead({ title: '設定' })

const { buildSQLiteData } = useDatabase()
const { hasApiKey, getApiKey, setApiKey, removeApiKey } = useGemini()
const { isLoggedIn, login, logout } = useGoogleAuth()
const { uploadFile } = useGoogleDrive()
const { senderAddresses, addSenderAddress, removeSenderAddress, driveFolderName, setDriveFolderName, reconcileDateTolerance, setReconcileDateTolerance, pageSize, setPageSize } = useSettings()
const { searchHistory, removeSearch } = useSearchHistory()

// GitHub認証情報管理
const { getCredentials, saveCredentials } = useGitHubCredentials()

// サーバーバージョン管理
const {
  currentVersion,
  latestVersion,
  updateAvailable,
  downloadUrlMsi,
  downloadUrlZip,
  loading: versionLoading,
  error: versionError,
  serverOnline,
  checkForUpdates,
} = useServerVersion()

const geminiKey = ref(getApiKey() || '')
const geminiSaved = ref(hasApiKey())
const githubUsername = ref('')
const githubPassword = ref('')
const githubSaved = ref(false)
const newAddress = ref('')
const folderNameInput = ref(driveFolderName.value)
const folderNameSaved = ref(false)
const toleranceInput = ref(reconcileDateTolerance.value)
const toleranceSaved = ref(false)
const pageSizeInput = ref(pageSize.value)
const pageSizeSaved = ref(false)
const pageSizeOptions = [
  { label: '10 件', value: 10 },
  { label: '20 件', value: 20 },
  { label: '50 件', value: 50 },
  { label: '100 件', value: 100 },
]
const exporting = ref(false)
const exportError = ref('')
const generatingYoryo = ref(false)
const yoryoError = ref('')
const yoryoDriveUrl = ref('')

onMounted(() => {
  const creds = getCredentials()
  githubUsername.value = creds.username
  githubPassword.value = creds.password

  // サーバーバージョンを自動チェック
  checkForUpdates()
})

async function handleExportSQLite() {
  exporting.value = true
  exportError.value = ''
  try {
    const { base64, filename } = await buildSQLiteData()
    await uploadFile(base64, filename, 'application/x-sqlite3')
  } catch (e: any) {
    exportError.value = e.message || 'エクスポートに失敗しました'
  } finally {
    exporting.value = false
  }
}

function saveFolderName() {
  if (folderNameInput.value.trim()) {
    setDriveFolderName(folderNameInput.value.trim())
    folderNameSaved.value = true
    setTimeout(() => { folderNameSaved.value = false }, 2000)
  }
}

function saveGeminiKey() {
  if (geminiKey.value.trim()) {
    setApiKey(geminiKey.value.trim())
    geminiSaved.value = true
  }
}

function clearGeminiKey() {
  removeApiKey()
  geminiKey.value = ''
  geminiSaved.value = false
}

function saveTolerance() {
  setReconcileDateTolerance(toleranceInput.value)
  toleranceSaved.value = true
  setTimeout(() => { toleranceSaved.value = false }, 2000)
}

function savePageSize() {
  setPageSize(pageSizeInput.value)
  pageSizeSaved.value = true
  setTimeout(() => { pageSizeSaved.value = false }, 2000)
}

async function handleGenerateYoryo() {
  generatingYoryo.value = true
  yoryoError.value = ''
  yoryoDriveUrl.value = ''
  try {
    const { base64, filename } = buildShoriYoryoHtml(driveFolderName.value)
    const driveFile = await uploadFile(base64, filename, 'text/html')
    yoryoDriveUrl.value = `https://drive.google.com/file/d/${driveFile.id}/view`
  } catch (e: any) {
    yoryoError.value = e.message || '処理要領の作成に失敗しました'
  } finally {
    generatingYoryo.value = false
  }
}

function handleAddAddress() {
  if (newAddress.value.trim()) {
    addSenderAddress(newAddress.value)
    newAddress.value = ''
  }
}

function saveGitHubCredentials() {
  saveCredentials(githubUsername.value, githubPassword.value)
  githubSaved.value = true
  setTimeout(() => { githubSaved.value = false }, 2000)
}
</script>

<template>
  <div class="space-y-8">
    <h2 class="text-2xl font-bold">設定</h2>

    <!-- ローカルサーバー -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-server" />
          <span class="font-semibold">ローカルサーバー</span>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">Supabase請求書ダウンロードに使用するローカルサーバーの状態を確認できます。</p>

        <div class="flex items-center gap-3">
          <UBadge :color="serverOnline ? 'success' : 'error'" variant="subtle">
            {{ serverOnline ? 'オンライン' : 'オフライン' }}
          </UBadge>
          <span v-if="serverOnline" class="text-sm">
            バージョン: {{ currentVersion }}
          </span>
        </div>

        <div v-if="updateAvailable" class="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
            新しいバージョン {{ latestVersion }} が利用可能です
          </p>
          <div class="mt-2 flex gap-2">
            <UButton
              v-if="downloadUrlMsi"
              icon="i-lucide-download"
              size="sm"
              :href="downloadUrlMsi"
              target="_blank"
            >
              MSI インストーラー
            </UButton>
            <UButton
              v-if="downloadUrlZip"
              icon="i-lucide-archive"
              size="sm"
              variant="outline"
              :href="downloadUrlZip"
              target="_blank"
            >
              ZIP アーカイブ
            </UButton>
          </div>
        </div>

        <UButton
          icon="i-lucide-refresh-cw"
          :loading="versionLoading"
          :disabled="versionLoading"
          variant="outline"
          @click="checkForUpdates"
        >
          更新を確認
        </UButton>

        <p v-if="versionError" class="text-sm text-error">{{ versionError }}</p>
      </div>
    </UCard>

    <!-- Google アカウント連携 -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-mail" />
          <span class="font-semibold">Google アカウント連携</span>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">Gmail からメールを取り込むために Google アカウントとの連携が必要です。</p>

        <div v-if="isLoggedIn" class="flex items-center gap-3">
          <UBadge color="success" variant="subtle">接続済み</UBadge>
          <UButton variant="outline" color="error" size="sm" @click="logout">
            連携解除
          </UButton>
        </div>
        <UButton v-else icon="i-lucide-log-in" @click="login">
          Google アカウントでログイン
        </UButton>
      </div>
    </UCard>

    <!-- Google Drive 保存先 -->
    <UCard v-if="isLoggedIn">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-hard-drive" />
          <span class="font-semibold">Google Drive 書類保管</span>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">
          メールから取り込んだ書類は Google Drive の指定フォルダに自動保存されます。
        </p>

        <form class="flex gap-2" @submit.prevent="saveFolderName">
          <UInput
            v-model="folderNameInput"
            placeholder="フォルダ名"
            icon="i-lucide-folder"
            class="flex-1"
          />
          <UButton type="submit" :disabled="!folderNameInput.trim() || folderNameInput.trim() === driveFolderName">
            保存
          </UButton>
        </form>

        <div v-if="folderNameSaved" class="flex items-center gap-2">
          <UBadge color="success" variant="subtle">保存しました</UBadge>
        </div>
      </div>
    </UCard>

    <!-- 突合設定 -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-calendar-range" />
          <span class="font-semibold">突合設定</span>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">
          請求書の日付がクレジットカードの決済日より前の場合に、何日前までマッチを許容するかを設定します。
        </p>

        <form class="flex items-center gap-2" @submit.prevent="saveTolerance">
          <UInput
            v-model.number="toleranceInput"
            type="number"
            :min="0"
            :max="90"
            class="w-24"
          />
          <span class="text-sm">日</span>
          <UButton type="submit" :disabled="toleranceInput === reconcileDateTolerance">
            保存
          </UButton>
        </form>

        <div v-if="toleranceSaved" class="flex items-center gap-2">
          <UBadge color="success" variant="subtle">保存しました</UBadge>
        </div>
      </div>
    </UCard>

    <!-- 一覧表示設定 -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-list" />
          <span class="font-semibold">一覧表示設定</span>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">検索ページのデータ一覧で 1 ページあたりに表示する件数を設定します。</p>

        <form class="flex items-center gap-2" @submit.prevent="savePageSize">
          <USelect
            v-model.number="pageSizeInput"
            :items="pageSizeOptions"
            class="w-32"
          />
          <UButton type="submit" :disabled="pageSizeInput === pageSize">
            保存
          </UButton>
        </form>

        <div v-if="pageSizeSaved" class="flex items-center gap-2">
          <UBadge color="success" variant="subtle">保存しました</UBadge>
        </div>
      </div>
    </UCard>

    <!-- 検索対象メールアドレス -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-at-sign" />
          <span class="font-semibold">検索対象メールアドレス</span>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">請求書を送信してくる取引先のメールアドレスを登録すると、Gmail 検索時に自動でフィルタされます。</p>

        <form class="flex gap-2" @submit.prevent="handleAddAddress">
          <UInput
            v-model="newAddress"
            type="email"
            placeholder="example@company.com"
            class="flex-1"
          />
          <UButton type="submit" :disabled="!newAddress.trim()">
            追加
          </UButton>
        </form>

        <div v-if="senderAddresses.length" class="space-y-2">
          <div
            v-for="addr in senderAddresses"
            :key="addr"
            class="flex items-center justify-between rounded-md bg-muted px-3 py-2"
          >
            <span class="text-sm">{{ addr }}</span>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="error"
              size="xs"
              @click="removeSenderAddress(addr)"
            />
          </div>
        </div>
        <p v-else class="text-sm text-dimmed">まだ登録されていません</p>
      </div>
    </UCard>

    <!-- 保存済み検索条件 -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-bookmark" />
          <span class="font-semibold">保存済み検索条件</span>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">メール取込画面で実行した検索は自動保存され、月次登録で再利用されます。</p>

        <div v-if="searchHistory.length" class="space-y-2">
          <div
            v-for="s in searchHistory"
            :key="s.id"
            class="flex items-center justify-between rounded-md bg-muted px-3 py-2"
          >
            <div class="min-w-0">
              <span class="text-sm">{{ s.label }}</span>
              <div class="text-xs text-dimmed">最終使用: {{ new Date(s.lastUsedAt).toLocaleDateString('ja-JP') }}</div>
            </div>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="error"
              size="xs"
              @click="removeSearch(s.id)"
            />
          </div>
        </div>
        <p v-else class="text-sm text-dimmed">まだ保存された検索条件はありません</p>
      </div>
    </UCard>

    <!-- データエクスポート -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-database" />
          <span class="font-semibold">データエクスポート</span>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">
          IndexedDB に保存されている全インボイスデータを SQLite ファイルとしてエクスポートします。
        </p>

        <UButton
          icon="i-lucide-download"
          :loading="exporting"
          :disabled="exporting"
          @click="handleExportSQLite"
        >
          SQLite エクスポート
        </UButton>

        <p v-if="exportError" class="text-sm text-error">
          {{ exportError }}
        </p>
      </div>
    </UCard>

    <!-- 処理要領 -->
    <UCard v-if="isLoggedIn">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-file-text" />
          <span class="font-semibold">事務処理規程</span>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">
          電子帳簿保存法で求められる「電子取引データの訂正及び削除の防止に関する事務処理規程」を作成し、Google Drive にアップロードします。
        </p>

        <UButton
          icon="i-lucide-upload"
          :loading="generatingYoryo"
          :disabled="generatingYoryo"
          @click="handleGenerateYoryo"
        >
          処理要領を作成して Drive にアップロード
        </UButton>

        <div v-if="yoryoDriveUrl" class="flex items-center gap-2">
          <UBadge color="success" variant="subtle">アップロード完了</UBadge>
          <a :href="yoryoDriveUrl" target="_blank" class="text-sm text-primary hover:underline">
            Drive で開く
          </a>
        </div>

        <p v-if="yoryoError" class="text-sm text-error">
          {{ yoryoError }}
        </p>
      </div>
    </UCard>

    <!-- Gemini API キー -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-sparkles" />
          <span class="font-semibold">Gemini API キー</span>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">請求書の自動解析に使用します。Google AI Studio で取得できます。</p>

        <div v-if="geminiSaved" class="flex items-center gap-3">
          <UBadge color="success" variant="subtle">設定済み</UBadge>
          <UButton variant="outline" color="error" size="sm" @click="clearGeminiKey">
            削除
          </UButton>
        </div>
        <form v-else class="flex gap-2" @submit.prevent="saveGeminiKey">
          <UInput
            v-model="geminiKey"
            type="password"
            placeholder="AIza..."
            class="flex-1"
          />
          <UButton type="submit" :disabled="!geminiKey.trim()">
            保存
          </UButton>
        </form>
      </div>
    </UCard>

    <!-- GitHub 認証情報 -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-github" />
          <span class="font-semibold">GitHub 認証情報</span>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">Supabase請求書ダウンロード時のGitHub認証に使用します。</p>

        <form class="space-y-4" @submit.prevent="saveGitHubCredentials">
          <UInput
            v-model="githubUsername"
            placeholder="GitHub Username"
            icon="i-lucide-user"
          />
          <UInput
            v-model="githubPassword"
            type="password"
            placeholder="GitHub Password"
            icon="i-lucide-lock"
          />
          <UButton type="submit">
            保存
          </UButton>
        </form>

        <div v-if="githubSaved" class="flex items-center gap-2">
          <UBadge color="success" variant="subtle">保存しました</UBadge>
        </div>
      </div>
    </UCard>
  </div>
</template>
