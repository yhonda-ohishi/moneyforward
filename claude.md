
moneyforwardに関するskillsはこのフォルダに作成

## Skills
- [mf-journal](skills/mf-journal/SKILL.md) - 仕訳取得・表示スキル
- [mf-backup](skills/mf-backup/SKILL.md) - 仕訳バックアップ（変更前に必ず実行）

## Web App
- [仕訳ビューア](app/) - Nuxt 4 SPA、バックアップデータの表示・インボイス管理
- `cd app && npm run dev` でローカル起動（http://localhost:3000）
- `predev` / `prebuild` で最新バックアップを自動コピー

## 自動化

SessionStart/PostToolUseフック（`.claude/settings.json`）で以下を自動実行:

- **セッション開始時**: 未完了タスク表示、最新バックアップ確認
- **MCP操作時**: 全操作を `audit-logs/operations/` に自動ログ
- **Google Drive同期**: backups/ と audit-logs/ を `gdrive:moneyforward/` に自動同期（rclone）

## 海外サービスの税区分ルール

仕訳チェック時、海外サービスの税区分は以下を基準に判断する。

| サービス | 適格請求書発行事業者 | 税区分 | 備考 |
|---------|-------------------|--------|------|
| Cloudflare | T2700150123404 | 課税仕入 10% | インボイスに日本消費税10%を明記 |
| SQLBAK (Pranas.NET) | なし | 対象外 | 米国企業、消費税請求なし |
| Claude.AI (Anthropic) | T7700150134388 | 2026年3月まで: 対象外 / 2026年4月から: 課税仕入 10% | 4月1日より消費税10%徴収開始 |

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