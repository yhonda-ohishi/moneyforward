"""
MoneyForward MCP操作の自動ログスクリプト（PostToolUseフック用）

stdin からフックデータを受け取り、操作ログをJSONファイルに追記する。
"""

import json
import sys
from datetime import datetime
from pathlib import Path

LOGS_DIR = Path("c:/moneyforward/audit-logs/operations")

SKIP_TOOLS = [
    "mfc_ca_authorize",
    "mfc_ca_exchange",
    "mfc_ca_en_ja_dictionary",
]


def detect_method(tool_name: str) -> str:
    if "get" in tool_name.lower():
        return "GET"
    elif "post" in tool_name.lower():
        return "POST"
    elif "put" in tool_name.lower():
        return "PUT"
    return "UNKNOWN"


def main():
    sys.stdin.reconfigure(encoding="utf-8")

    try:
        hook_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        return

    tool_name = hook_data.get("tool_name", "")

    if not tool_name.startswith("mcp__mfc_ca"):
        return

    short_name = tool_name.replace("mcp__mfc_ca__", "")

    for skip in SKIP_TOOLS:
        if skip in short_name:
            return

    tool_input = hook_data.get("tool_input", {})
    method = detect_method(short_name)

    entry = {
        "timestamp": datetime.now().isoformat(),
        "tool": short_name,
        "method": method,
    }

    if method == "GET":
        params = {k: v for k, v in tool_input.items() if k != "access_token"}
        if params:
            entry["params"] = params

    if method in ("POST", "PUT"):
        journal = tool_input.get("journal", {})
        if journal:
            entry["transaction_date"] = journal.get("transaction_date", "")
            branches = journal.get("branches", [])
            summary = []
            for b in branches:
                dr = b.get("debitor") or b.get("debtor") or {}
                cr = b.get("creditor") or {}
                summary.append({
                    "remark": b.get("remark", ""),
                    "debit_value": dr.get("value", 0),
                    "credit_value": cr.get("value", 0),
                })
            entry["branches"] = summary

    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")
    log_file = LOGS_DIR / f"{today}.json"

    entries = []
    if log_file.exists():
        try:
            with open(log_file, encoding="utf-8") as f:
                entries = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            entries = []

    entries.append(entry)

    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
