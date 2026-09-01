"""Gmail から受領請求書PDFの添付を取得する。

接続中の Gmail MCP には添付ダウンロード用ツールが無いため、
`~/.gmail-mcp/credentials.json`（gongrzhe/server-gmail-autoauth-mcp が保存する
OAuth 認証情報）のリフレッシュトークンで Gmail API を直接叩く。

`invalid_grant` が返る場合はリフレッシュトークンが失効している。ユーザーに
`npx @gongrzhe/server-gmail-autoauth-mcp auth` を実行してもらえば、Claude Code を
再起動しなくてもこのスクリプトは動く（MCP 経由ではなくファイルを直接読むため）。

Usage:
    python gmail_fetch.py --after 2026/04/28 --out <staging_dir>
    python gmail_fetch.py --after 2026/04/28 --list        # 一覧のみ（DLしない）
    python gmail_fetch.py --query "from:foo@bar subject:receipt" --out <dir>
"""

import argparse
import base64
import datetime
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

GMAIL_HOME = Path(os.path.expanduser("~")) / ".gmail-mcp"
API = "https://gmail.googleapis.com/gmail/v1/users/me/"

# claude.md「サービス別メール検索クエリ」由来
VENDOR_QUERIES = {
    "Anthropic": "from:invoice+statements@mail.anthropic.com",
    "Supabase": "from:invoice+statements@supabase.com",
    "GitHub": "from:noreply@github.com subject:receipt",
    "GoogleCloud": "from:payments-noreply@google.com",
    "Cloudflare": 'from:noreply@notify.cloudflare.com subject:"invoice is attached"',
    "SQLBak": "from:noreply@sqlbak.com Payment Received",
}

# Anthropic / Supabase は Invoice-*.pdf と Receipt-*.pdf の両方が添付される。
# 証憑としては Receipt を採用する。
PREFER_RECEIPT = {"Anthropic", "Supabase"}


def access_token() -> str:
    creds = json.load(open(GMAIL_HOME / "credentials.json"))
    keys = json.load(open(GMAIL_HOME / "gcp-oauth.keys.json"))["installed"]
    data = urllib.parse.urlencode(
        {
            "client_id": keys["client_id"],
            "client_secret": keys["client_secret"],
            "refresh_token": creds["refresh_token"],
            "grant_type": "refresh_token",
        }
    ).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(keys["token_uri"], data=data)) as r:
            return json.load(r)["access_token"]
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if "invalid_grant" in body:
            sys.exit(
                "リフレッシュトークンが失効しています。以下を実行して再認証してください:\n"
                "  npx @gongrzhe/server-gmail-autoauth-mcp auth\n"
                "（Claude Code の再起動は不要です）"
            )
        sys.exit(f"トークン取得に失敗しました: HTTP {e.code} {body}")


def api(token: str, path: str, **params):
    url = API + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def flatten(part, out):
    out.append(part)
    for child in part.get("parts", []):
        flatten(child, out)
    return out


def message_detail(token: str, mid: str) -> dict:
    m = api(token, "messages/" + mid, format="full")
    headers = {h["name"].lower(): h["value"] for h in m["payload"].get("headers", [])}
    attachments = [
        (p["filename"], p["body"].get("attachmentId"), p["body"].get("size"))
        for p in flatten(m["payload"], [])
        if p.get("filename")
    ]
    return {
        "id": mid,
        "subject": headers.get("subject", ""),
        "date": datetime.datetime.fromtimestamp(int(m["internalDate"]) // 1000).strftime("%Y-%m-%d"),
        "attachments": attachments,
    }


def download(token: str, mid: str, aid: str, dest: Path) -> int:
    d = api(token, f"messages/{mid}/attachments/{aid}")
    raw = base64.urlsafe_b64decode(d["data"])
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(raw)
    return len(raw)


def pick(vendor: str, attachments):
    """このベンダーで採用すべきPDF添付を返す。"""
    pdfs = [a for a in attachments if a[0].lower().endswith(".pdf")]
    if vendor in PREFER_RECEIPT:
        receipts = [a for a in pdfs if a[0].lower().startswith("receipt")]
        if receipts:
            return receipts
    return pdfs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--after", help="Gmail の after: に渡す日付 (YYYY/MM/DD)")
    ap.add_argument("--query", help="独自クエリ（指定時は VENDOR_QUERIES を使わない）")
    ap.add_argument("--out", help="添付の保存先ディレクトリ")
    ap.add_argument("--list", action="store_true", help="一覧表示のみ")
    ap.add_argument("--max", type=int, default=25, help="1クエリあたりの最大件数")
    args = ap.parse_args()

    if not args.list and not args.out:
        ap.error("--out か --list のどちらかを指定してください")

    token = access_token()
    queries = {"custom": args.query} if args.query else dict(VENDOR_QUERIES)
    total = 0

    for vendor, q in queries.items():
        if args.after:
            q = f"{q} after:{args.after}"
        res = api(token, "messages", q=q, maxResults=args.max)
        ids = [m["id"] for m in res.get("messages", [])]
        print(f"== {vendor}: {len(ids)}件  ({q})")
        for mid in ids:
            d = message_detail(token, mid)
            chosen = pick(vendor, d["attachments"])
            names = [a[0] for a in chosen]
            print(f"   {d['date']}  {d['subject'][:60]}  -> {names}")
            if args.list:
                continue
            for filename, aid, _size in chosen:
                dest = Path(args.out) / f"{vendor}__{d['date']}__{filename}"
                if dest.exists():
                    continue
                n = download(token, mid, aid, dest)
                total += 1
                print(f"      saved {dest.name} ({n:,} bytes)")

    if not args.list:
        print(f"\n合計 {total} 件を保存しました -> {args.out}")
        print("この後、金額・発行日を確認してから references/invoices/ に配置し、"
              "matches.json に登録してください。")


if __name__ == "__main__":
    main()
