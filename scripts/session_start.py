"""
MoneyForward MCP セッション開始スクリプト（SessionStartフック用）

1. 前回の監査ログから未完了タスクを表示
2. 最新バックアップの日時を表示
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime

BASE = Path("c:/moneyforward")


def show_pending():
    audit_dir = BASE / "audit-logs"
    if not audit_dir.exists():
        return

    # 最新の監査ログを探す
    logs = sorted(audit_dir.glob("*.json"), reverse=True)
    if not logs:
        return

    try:
        with open(logs[0], encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return

    pending = data.get("pending", [])
    if not pending:
        print("  未完了タスクなし")
        return

    print(f"\n  未完了タスク ({len(pending)}件):")
    for p in pending:
        due = f" (期限: {p['due_date']})" if p.get("due_date") else ""
        print(f"    - {p['subject']}{due}")


def show_last_backup():
    backup_dir = BASE / "backups"
    if not backup_dir.exists():
        return

    dirs = sorted([d for d in backup_dir.iterdir() if d.is_dir()], reverse=True)
    if not dirs:
        print("  バックアップなし")
        return

    info_file = dirs[0] / "backup_info.json"
    if info_file.exists():
        try:
            with open(info_file, encoding="utf-8") as f:
                info = json.load(f)
            print(f"  最新バックアップ: {info.get('backup_date', '')[:19]} ({info.get('total_journals', '?')}件)")
        except Exception:
            print(f"  最新バックアップ: {dirs[0].name}")
    else:
        print(f"  最新バックアップ: {dirs[0].name}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")

    print("=== MoneyForward session start ===\n")
    show_last_backup()
    show_pending()
    print("\n==================================")


if __name__ == "__main__":
    main()
