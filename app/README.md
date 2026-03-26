# denchoho-invoice

電子帳簿保存法対応 インボイス管理アプリ

## 概要

Money Forward 仕訳帳 CSV とインボイス書類を突合し、Google Drive で年度別フォルダに自動整理するSPAアプリ。

**アプリURL**: https://yhonda-ohishi-pub-dev.github.io/denchoho-invoice/

## 主な機能

- **仕訳帳CSV突合**: Money Forward の仕訳帳CSVをアップロードし、IndexedDB に保存済みのインボイスと自動マッチング（日付許容日数・金額一致・取引先あいまいマッチ）
- **Gmail一括取込**: Gmail からインボイスメールを検索し、添付PDFをGemini AIで解析してメタデータ自動抽出
- **PDF/画像手動登録**: PDFや画像ファイルを直接アップロードしてGeminiで解析・登録
- **Drive年フォルダ整理**: 突合結果に基づき、マッチ済みインボイスを年度フォルダ（2025, 2026等）に自動移動。未マッチはtmpフォルダへ
- **tmpインボイス管理**: tmpフォルダのインボイスを一覧表示・個別/一括削除（削除後Gmail再取得可能）
- **検索**: 取引年月日・金額・取引先・書類種別で検索。年度タブで絞り込み
- **SQLiteエクスポート**: DB内容をSQLiteファイルとしてGoogle Driveに自動アップロード
- **電帳法処理要領**: 処理要領PDFをDriveにアップロード

## 使い方

### 1. 初期設定（設定ページ）

1. 「Googleログイン」で Google アカウントを連携（Drive / Gmail アクセス許可）
2. Gemini API キーを入力して保存
3. Drive フォルダ名を設定（インボイス保管先の親フォルダ名）
4. Gmail 取込対象の送信元メールアドレスを登録

### 2. インボイス取込・突合（突合ページ）

1. Money Forward の仕訳帳 CSV をアップロード → 自動で突合実行
2. 未マッチの取引に対して以下で取込:
   - **Gmail 検索**: 登録済み送信元アドレスから該当メール・添付PDFを自動取得
   - **手動 PDF 登録**: PDF / 画像をアップロードして Gemini で解析
3. 「Drive 年フォルダ整理」でマッチ済みインボイスを年度フォルダへ自動移動
4. tmp フォルダの不要インボイスは個別 / 一括削除可能

### 3. 検索・確認（検索ページ）

- 年度タブで年ごとに絞り込み
- 取引年月日・金額・取引先・書類種別で検索
- Drive 上のファイルをブラウザで閲覧

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Nuxt 4 (SPA, ssr: false) |
| UI | @nuxt/ui + Tailwind CSS |
| メインDB | IndexedDB (Dexie.js) |
| エクスポート | SQLite (sql.js) |
| 設定/APIキー | localStorage |
| ドキュメント保管 | Google Drive API (OAuth2) |
| メール取込 | Gmail API |
| AI解析 | Gemini API (@google/generative-ai) |
| デプロイ | GitHub Pages (GitHub Actions) |
| パッケージマネージャー | npm |

## セットアップ

```bash
npm install
```

### 環境変数

```
NUXT_PUBLIC_GOOGLE_CLIENT_ID=<Google OAuth2 Client ID>
```

### 開発サーバー

```bash
npm run dev
```

### ビルド・デプロイ

```bash
npm run generate
```

`main` ブランチへの push で GitHub Actions が自動デプロイ。`.output/public` を GitHub Pages に配信。

## ディレクトリ構造

```
app/
├── components/    # Vueコンポーネント (auto-import)
│   └── reconcile/ # 突合関連コンポーネント
├── composables/   # Composables (auto-import)
│   ├── useDatabase.ts    # IndexedDB (Dexie) + SQLiteエクスポート
│   ├── useGoogleDrive.ts # Drive API (アップロード/移動/削除)
│   ├── useGoogleAuth.ts  # OAuth2認証
│   ├── useGmail.ts       # Gmail API
│   ├── useImport.ts      # メール取込 + Gemini解析
│   ├── useReconcile.ts   # 突合アルゴリズム
│   └── useSettings.ts    # 設定管理
├── pages/
│   ├── index.vue   # 突合ページ (CSV, Drive整理, tmp管理)
│   ├── search.vue  # 検索ページ (年度タブ, 検索フォーム)
│   └── settings.vue # 設定ページ
├── types/         # TypeScript型定義
└── utils/         # ユーティリティ
```

## 突合フロー

1. Money Forward 仕訳帳CSVをアップロード
2. CSVをパースしてMF取引リストを生成
3. IndexedDB の全インボイスと突合（日付許容日数内 + 金額一致 or 取引先あいまいマッチ）
4. 未マッチ取引に対してGmail検索 or 手動PDF登録
5. 「Drive年フォルダ整理」で自動整理
   - マッチ済み → 仕訳帳の取引年フォルダへ移動
   - 未マッチ（mainにいるもの）→ tmpへ移動
   - 既に年フォルダにいるインボイスは保護（他のCSVで整理済み）
6. SQLiteエクスポート → Driveにアップロード
