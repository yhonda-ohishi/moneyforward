"""MoneyForward 請求書突合チェックスクリプト

MCP getJournalsの結果ファイル（またはbackups/配下のjournals.json）と
references/invoices/matches.json を突合し、以下を検出する:

  1. 課税仕入（needs_document）の仕訳のうち、請求書PDFが未登録・ファイル欠落のもの
  2. 既知の海外サービス（claude.md「海外サービスの税区分ルール」）の税区分誤り

ロジックは app/app/composables/useReconcile.ts (hasTaxableCategory /
reconcileManual) と同じ仕様に揃えている。app 側のロジックを変更した場合は
こちらも追従させること。

Usage:
    python check_invoices.py <journals_file> [--year 2026]

<journals_file> は以下のいずれか:
  - mfc_ca_getJournals の生ツール結果ファイル ( [{"text": "{...}"}] 形式 )
  - { "journals": [...] } 形式のJSON
  - 省略時は c:\\moneyforward\\backups\\ 配下の最新バックアップを使う
"""

import json
import sys
from pathlib import Path

BASE = Path("c:/moneyforward")
INVOICES_ROOT = BASE / "references" / "invoices"
BACKUPS_ROOT = BASE / "backups"

# claude.md「海外サービスの税区分ルール」由来。摘要/取引先名にキーワードが
# 含まれる仕訳を対象に、期待される税区分と照合する。
KNOWN_VENDORS = [
    {
        "keywords": ["CLOUDFLARE"],
        "expected_tax_contains": "課税仕入",
        "note": "登録番号 T2700150123404。インボイスに消費税10%明記 → 課税仕入10%",
    },
    {
        "keywords": ["SQLBAK", "PRANAS"],
        "expected_tax_contains": "対象外",
        "note": "米国企業、消費税請求なし → 対象外",
    },
    {
        "keywords": ["ANTHROPIC", "CLAUDE.AI", "CLAUDE AI"],
        # 2026-04-01 から課税仕入10%に切替 (claude.md参照)。日付は呼び出し側で判定
        "expected_tax_contains": None,
        "note": "登録番号 T7700150134388。2026-03まで対象外 / 2026-04以降は課税仕入10%",
    },
    {
        "keywords": ["GOOGLE CLOUD", "GOOGLE, GOOGLE合同会社", "GCP"],
        "expected_tax_contains": "課税仕入",
        "note": "登録番号 T6010003022051 (日本法人)。インボイスに消費税10%明記 → 課税仕入10%",
    },
]


def has_taxable_category(branch: dict) -> bool:
    debitor = branch.get("debitor") or {}
    creditor = branch.get("creditor") or {}
    return "課税仕入" in (debitor.get("tax_long_name") or "") or "課税仕入" in (
        creditor.get("tax_long_name") or ""
    )


def load_journals_payload(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)

    # MCPツール結果の生envelope ( [{"text": "..."}] ) を吸収
    if isinstance(raw, list):
        raw = json.loads(raw[0]["text"])
    return raw


def latest_backup_journals() -> Path | None:
    if not BACKUPS_ROOT.exists():
        return None
    dirs = sorted([d for d in BACKUPS_ROOT.iterdir() if d.is_dir()], reverse=True)
    for d in dirs:
        candidate = d / "journals.json"
        if candidate.exists():
            return candidate
    return None


def resolve_invoice_file(year: str, rel_path: str) -> Path | None:
    """matches.json の相対パス (\"YYYY/file.pdf\") から実ファイルを探す。

    index-invoices.sh は references/invoices/<year>/ 直下、または二重ネスト
    (references/invoices/<year>/<year>/) のどちらにも対応しているため、両方
    見に行く。
    """
    filename = Path(rel_path).name
    candidates = [
        INVOICES_ROOT / rel_path,
        INVOICES_ROOT / year / filename,
        INVOICES_ROOT / year / year / filename,
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def check_known_vendor(description: str, txn_date: str) -> tuple[str, str] | None:
    """既知ベンダーにマッチしたら (期待される税区分の部分文字列, 注記) を返す。"""
    upper = description.upper()
    for vendor in KNOWN_VENDORS:
        if not any(kw in upper for kw in vendor["keywords"]):
            continue
        expected = vendor["expected_tax_contains"]
        if expected is None:
            # Anthropic/Claude.AI: 2026-04-01 から対象外 → 課税仕入10% に切替 (claude.md参照)
            expected = "対象外" if txn_date < "2026-04-01" else "課税仕入"
        return expected, vendor["note"]
    return None


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    year = "2026"
    if "--year" in sys.argv:
        year = sys.argv[sys.argv.index("--year") + 1]

    if args:
        journals_path = Path(args[0])
    else:
        journals_path = latest_backup_journals()
        if journals_path is None:
            print("journals.json が見つかりません。<journals_file> を指定するか、"
                  "mf-backup で先にバックアップを取ってください。")
            sys.exit(1)

    data = load_journals_payload(journals_path)
    journals = data.get("journals", [])

    matches_path = INVOICES_ROOT / "matches.json"
    matches = {}
    if matches_path.exists():
        with open(matches_path, encoding="utf-8") as f:
            matches = json.load(f)
    year_map = matches.get(year, {})

    missing_invoice = []
    broken_link = []
    vendor_warnings = []

    for j in journals:
        number = str(j.get("number"))
        txn_date = j.get("transaction_date", "")
        branches = j.get("branches", [])
        needs_document = any(has_taxable_category(b) for b in branches)
        description = next((b.get("remark", "") for b in branches if b.get("remark")), "")

        if needs_document:
            rel_path = year_map.get(number)
            if not rel_path:
                missing_invoice.append((number, txn_date, description))
            elif resolve_invoice_file(year, rel_path) is None:
                broken_link.append((number, txn_date, description, rel_path))

        vendor_match = check_known_vendor(description, txn_date)
        if vendor_match:
            expected, note = vendor_match
            tax_names = [
                (b.get("debitor") or {}).get("tax_long_name")
                or (b.get("creditor") or {}).get("tax_long_name")
                or ""
                for b in branches
            ]
            # いずれの行にも期待される税区分が含まれていなければ不一致として報告
            if not any(expected in t for t in tax_names):
                vendor_warnings.append((number, txn_date, description, tax_names, expected, note))

    print(f"## 請求書突合チェック結果 (年度: {year})\n")
    print(f"| チェック項目 | 該当件数 |")
    print(f"|---|---|")
    print(f"| 請求書PDF未登録 (課税仕入) | {len(missing_invoice)}件 |")
    print(f"| 請求書PDFファイル欠落 | {len(broken_link)}件 |")
    print(f"| 既知海外サービスの税区分不一致 | {len(vendor_warnings)}件 |\n")

    if missing_invoice:
        print("### 請求書PDF未登録\n")
        for number, date, desc in missing_invoice:
            print(f"- No.{number} | {date} | {desc}")
        print()

    if broken_link:
        print("### 請求書PDFファイル欠落 (matches.json に記載はあるがファイルが無い)\n")
        for number, date, desc, rel in broken_link:
            print(f"- No.{number} | {date} | {desc} | 期待パス: {rel}")
        print()

    if vendor_warnings:
        print("### 既知海外サービスの税区分不一致\n")
        for number, date, desc, tax_names, expected, note in vendor_warnings:
            print(
                f"- No.{number} | {date} | {desc} | 現在の税区分: {tax_names} | "
                f"期待: 「{expected}」を含む区分 | {note}"
            )
        print()

    if not missing_invoice and not broken_link and not vendor_warnings:
        print("課税仕入の仕訳はすべて請求書PDFと突合済みで、既知海外サービスの税区分も問題ありません。")


if __name__ == "__main__":
    main()
