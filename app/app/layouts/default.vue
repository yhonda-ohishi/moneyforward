<script setup lang="ts">
import { useGitHubCredentials } from '../composables/useGitHubCredentials'

const navItems = [
  { label: '仕訳帳', icon: 'i-lucide-home', to: '/' },
  { label: '検索', icon: 'i-lucide-search', to: '/search' },
  { label: '設定', icon: 'i-lucide-settings', to: '/settings' },
]

const downloading = ref(false)
const { getCredentials } = useGitHubCredentials()

async function handleSupabaseDownload() {
  downloading.value = true
  try {
    const creds = getCredentials()

    const response = await fetch('http://localhost:3939/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        githubUsername: creds.username,
        githubPassword: creds.password
      })
    })

    const result = await response.json()

    if (result.status === 'success') {
      alert('Supabase 請求書のダウンロードが完了しました')
    }
    else {
      throw new Error(result.message || 'ダウンロードに失敗しました')
    }
  }
  catch (e: any) {
    if (e.message.includes('fetch') || e.message.includes('Failed to fetch')) {
      alert('dencho-cli.exe が起動していません。\nまず dencho-cli.exe を起動してください。')
    }
    else {
      alert(`エラー: ${e.message}`)
    }
  }
  finally {
    downloading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-gray-200 dark:border-gray-800">
      <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/" class="text-lg font-bold hover:opacity-80">MF 仕訳ビューア</NuxtLink>
        <nav class="flex gap-2">
          <UButton
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :icon="item.icon"
            :label="item.label"
            variant="ghost"
            size="sm"
          />
          <UButton
            icon="i-lucide-download"
            label="Supabase請求書"
            variant="ghost"
            size="sm"
            :loading="downloading"
            @click="handleSupabaseDownload"
          />
        </nav>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>
