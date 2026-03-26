# denchoho-invoice

電子帳簿保存法対応 インボイス管理アプリ

## 技術スタック

- **フレームワーク**: Nuxt 4 (SPA モード, ssr: false)
- **UI**: @nuxt/ui + Tailwind CSS
- **メインDB**: IndexedDB (Dexie.js)
- **エクスポート**: SQLite (sql.js)
- **設定/APIキー**: localStorage
- **ドキュメント保管**: Google Drive API (OAuth2)
- **AI解析**: Gemini API (@google/generative-ai)
- **デプロイ**: GitHub Pages (GitHub Actions)
- **パッケージマネージャー**: npm

## ディレクトリ構造

```
app/
├── components/    # Vueコンポーネント (auto-import)
├── composables/   # Composables (auto-import)
├── layouts/       # レイアウト
├── pages/         # ページ (auto-routing)
├── plugins/       # プラグイン
├── types/         # TypeScript型定義
└── utils/         # ユーティリティ
```

## コーディング規約

- `<script setup lang="ts">` を使用
- composables は `use` プレフィックス (例: `useDatabase`, `useGoogleDrive`)
- 型定義は `app/types/` に配置
- クライアント専用プラグインは `.client.ts` サフィックス

## デプロイ

- main ブランチへの push で GitHub Actions が自動デプロイ
- `npm run generate` でビルド → `.output/public` を GitHub Pages に配信
- baseURL: `/denchoho-invoice/`

## 電帳法要件

- 検索要件: 取引年月日、取引金額、取引先で検索可能にする
- 書類種別: 請求書、領収書、見積書、納品書、契約書、その他
- メタデータ: `app/types/invoice.ts` で定義

## APIキー管理

- Gemini API キーはユーザーが設定画面で入力し localStorage に保存
- Google OAuth2 Client ID は環境変数 `NUXT_PUBLIC_GOOGLE_CLIENT_ID`
