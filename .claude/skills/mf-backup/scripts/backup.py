"""MoneyForward仕訳バックアップスクリプト

MCP getJournalsの結果ファイルをバックアップとして保存する。

Usage:
    python backup.py <mcp_result_file> --reason "摘要の修正"
"""

import json
import sys
import os
from datetime import datetime
from dotenv import dotenv_values

BACKUP_ROOT = r"c:\moneyforward\backups"
ENV = dotenv_values(r"c:\moneyforward\.env")


def main():
    if len(sys.argv) < 2:
        print("Usage: python backup.py <mcp_result_file> [--reason '理由']")
        sys.exit(1)

    src = sys.argv[1]
    reason = "手動バックアップ"
    for i, a in enumerate(sys.argv):
        if a == "--reason" and i + 1 < len(sys.argv):
            reason = sys.argv[i + 1]

    with open(src, "r", encoding="utf-8") as f:
        raw = json.load(f)

    journals_data = json.loads(raw[0]["text"])
    total = len(journals_data.get("journals", []))

    ts = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    out_dir = os.path.join(BACKUP_ROOT, ts)
    os.makedirs(out_dir, exist_ok=True)

    with open(os.path.join(out_dir, "journals.json"), "w", encoding="utf-8") as f:
        json.dump(journals_data, f, ensure_ascii=False, indent=2)

    info = {
        "backup_date": datetime.now().astimezone().isoformat(),
        "fiscal_year": 2026,
        "total_journals": total,
        "office_name": ENV.get("OWNER_NAME", ""),
        "reason": reason,
    }
    with open(os.path.join(out_dir, "backup_info.json"), "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

    print(f"バックアップ完了: {out_dir}")
    print(f"  仕訳数: {total}件")
    print(f"  理由: {reason}")


if __name__ == "__main__":
    main()
