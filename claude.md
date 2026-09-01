
moneyforwardに関するskillsは `.claude/skills/` に作成する。
（Claude Codeがrepoを開いた時に自動認識する標準パスのため、CCoW上でも
skillのトリガーフレーズだけで自動発火する。以前はrepoルート直下の
`skills/` に置いていたが、そちらは自動認識されないため移設済み。）

## Skills
- [mf-journal](.claude/skills/mf-journal/SKILL.md) - 仕訳取得・表示スキル
- [mf-backup](.claude/skills/mf-backup/SKILL.md) - 仕訳バックアップ（変更前に必ず実行）
- [mf-invoice-check](.claude/skills/mf-invoice-check/SKILL.md) - 請求書突合チェック（課税仕入の仕訳と受領請求書PDFの突合漏れ・税区分誤りを検出）
- [mf-invoice-review](.claude/skills/mf-invoice-review/SKILL.md) - 仕訳候補1件ごとの登録前確認（貸借バランス・重複懸念）＋登録後の反映確認
- [mf-invoice-fetch](.claude/skills/mf-invoice-fetch/SKILL.md) - 受領請求書PDFの取得・登録（Gmail添付＋顧客ポータル。突合の未登録を埋める）
- [repo-cwd-guard](.claude/skills/repo-cwd-guard/SKILL.md) - 起動ディレクトリの確認（cwd 外だと MCP と hooks が黙って無効になる）

## セッション引き継ぎ

セッション開始時に `handoff/` の最新ファイル（`handoff/YYYY-MM-DD.md`）を読む。
作業を中断するときは同じ形式で追記する。実データを含むためローカル専用（gitignore 済み）。

## Web App
- [仕訳ビューア](app/) - Nuxt 4 SPA、バックアップデータの表示・インボイス管理
- `cd app && npm run dev` でローカル起動（http://localhost:3000）
- `predev` / `prebuild` で最新バックアップを自動コピー

## 自動化

SessionStart/PostToolUseフック（`.claude/settings.json`）で以下を自動実行:

- **セッション開始時**: 未完了タスク表示、最新バックアップ確認
- **MCP操作時**: 全操作を `audit-logs/operations/` に自動ログ
- **Google Drive同期**: backups/, audit-logs/, references/ を `gdrive:moneyforward/` に自動同期（rclone）

## 請求書管理

- **PDF配置**: `references/invoices/<year>/<YYYY-MM-DD>_<取引先>.pdf`（発行日ベース命名）
- **仕訳⇔PDFマップ**: [references/invoices/matches.json](references/invoices/matches.json)（年度別、仕訳No→相対パス）
- **取得方法**: `mcp__gmail__search_emails` → `read_email` で attachmentId 取得 → `download_attachment`
- **Gmail MCP再認証**: `npx @gongrzhe/server-gmail-autoauth-mcp auth` 実行後、Claude Code再起動
- **電帳法メタデータ型**: [app/app/types/invoice.ts](app/app/types/invoice.ts)

### サービス別メール検索クエリ

| サービス | クエリ | 添付形式 |
|---------|--------|---------|
| Anthropic Claude.AI | `from:invoice+statements@mail.anthropic.com` | Receipt-XXXX-XXXX-XXXX.pdf |
| GitHub | `from:noreply@github.com subject:receipt` | github-XXX-receipt-YYYY-MM-DD.pdf |
| Supabase | `from:invoice+statements@supabase.com` | Receipt-BJJMCD-XXXXX.pdf |
| SQLBak (Pranas.NET) | `from:noreply@sqlbak.com Payment Received` | payment_XXXXXXX.pdf |
| Google Cloud | `from:payments-noreply@google.com` | <請求書番号>.pdf |

### 請求書がメール非対応のサービス（顧客ポータルから取得）

取得手順の詳細は [mf-invoice-fetch](.claude/skills/mf-invoice-fetch/SKILL.md) 参照。
Chrome MCP（`mcp__claude-in-chrome__*`）でログイン済みセッションを使う。

| サービス | ポータルURL | 取得方法 |
|---------|-----------|---------|
| マネーフォワード クラウド利用料 | `https://erp.moneyforward.com/office_usage_detail_statements` | 料金明細→請求書。**PDFなし・印刷のみ** → HTML保存してローカルでPDF化 |
| カゴヤ・ジャパン | `https://kagoyaid.kagoya.jp/kagoyaid/invoice_list/<アカウント別トークン>` | 請求管理。年月選択→チェック→ダウンロード→**PDFが新規タブで開く**ので fetch して保存 |
| Amazon | `https://www.amazon.co.jp/gp/css/summary/print.html?orderID=<注文番号>` | 領収書ページ。注文番号は仕訳の摘要にある。**PDFなし** → HTML保存してPDF化 |
| スイッチサイエンス | `https://menu.switch-science.com/#/menu/<注文別トークン>/download` | 注文後メニュー→書類ダウンロード→「納品書兼適格請求書【インボイス】」。トークンは注文確認メールの認証URL経由で取得 |

- **税務署（事業税等）**: e-Tax電子納付のため紙/PDF領収書なし → matches.json登録不要
- **飲食店等の紙レシート**: スキャンが必要

### 日付の対応関係（カード請求日 → 請求書の発行日）

ファイル名は請求書PDF内の**発行日**を使う。カード請求日とはずれる。

| サービス | 例 |
|---------|---|
| マネーフォワード | 仕訳 2026-07-05 ← 請求日 2026-06-30 ← 発行日 2026-07-03 |
| カゴヤ・ジャパン | 仕訳 2026-05-08 ← 2026年4月分 ← 発行日 2026-04-30 |
| Google Cloud | 仕訳 2026-07-01 ← 2026年6月分 ← 発行日 2026-06-30 |

### Google Cloud の請求先アカウント

`0167AE-67A318-FEC0D4` と `01833F-DE3AE7-E73305` の2つがあり毎月2通メールが届くが、
2026年4月請求分以降 `0167AE` は **¥0**。課金は `01833F` のみで仕訳も月1件。
¥0 の請求書は matches.json に登録しない。

## 海外サービスの税区分ルール

仕訳チェック時、海外サービスの税区分は以下を基準に判断する。

| サービス | 適格請求書発行事業者 | 税区分 | 備考 |
|---------|-------------------|--------|------|
| Cloudflare | T2700150123404 | 課税仕入 10% | インボイスに日本消費税10%を明記 |
| SQLBAK (Pranas.NET) | なし | 対象外 | 米国企業、消費税請求なし |
| Claude.AI (Anthropic) | T7700150134388 | 2026年3月まで: 対象外 / 2026年4月から: 課税仕入 10% | 4月1日より消費税10%徴収開始 |
| Google Cloud (Japan GK) | T6010003022051 | 課税仕入 10% | 日本法人（合同会社）、インボイスに消費税10%を明記、適格請求書あり |

### 判断基準
- 適格請求書発行事業者番号（T+13桁）が請求書にあれば → 課税仕入 10%
- なければ → 対象外（リバースチャージは簡易課税の個人事業主には不適用）

## 事業者情報
- 課税方式: **簡易課税**（仕入税額控除は売上から自動計算。適格請求書の有無は仕入側の税額に影響しない）

## MCP認証手順
1. `mfc_ca_authorize` でURLを生成 → ユーザーがブラウザで認証
2. **`mfc_ca_exchange`** で認可コードをアクセストークンに交換（この手順を忘れないこと）
3. 取得した `access_token` を各APIに渡す（有効期限: 1時間）

## MCP制限事項
- `getConnectedAccounts` は空を返す（銀行連携データはMCPスコープ外）
- 残高確認は `getReportsTrialBalanceBalanceSheet` で代替する
- 仕訳の削除APIはない（手動で削除が必要）