"""ポータルから保存したページHTMLをPDFに変換する。

マネーフォワード クラウドの請求書ページや Amazon の領収書ページは PDF ダウンロードが無く
`window.print()` しか無い（ネイティブ印刷ダイアログは自動操作できない）。そこでブラウザ側で
`document.documentElement.outerHTML` を Blob 経由で保存し、それをここで headless Chrome に
食わせて PDF 化する。

外部CSSはオフラインでは読めないので link ごと捨て、class/style 属性も落として最小限の
自前CSSを当てる。`getComputedStyle` を全要素にインライン展開する方法は真っ白なPDFになるので
使わないこと。

変換後はテキストを抽出して金額・発行日が読めることを必ず確認する。

Usage:
    python html_to_pdf.py <in.html> <out.pdf> [--font-size 13]
"""

import argparse
import os
import re
import subprocess
import sys
import tempfile

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

CSS_TEMPLATE = (
    '<style>body{{font-family:"Yu Gothic",Meiryo,sans-serif;font-size:{size}px;'
    "color:#111;margin:36px;line-height:1.9}}img{{max-width:140px}}</style>"
)


def clean(html: str, font_size: int) -> str:
    # スクリプト・スタイル・外部CSS・Claude拡張の注入要素を除去
    html = re.sub(r"<(script|noscript|style)[^>]*>.*?</\1>", "", html, flags=re.S | re.I)
    html = re.sub(r"<link[^>]*>", "", html, flags=re.I)
    html = re.sub(r"<div[^>]*claude-agent[^>]*>.*?</div>", "", html, flags=re.S | re.I)
    html = re.sub(r"<button[^>]*>.*?</button>", "", html, flags=re.S | re.I)
    # 残った class/style は元サイトのCSSが無いと意味が無く、むしろ描画を壊す
    html = re.sub(r'\sstyle="[^"]*"', "", html)
    html = re.sub(r'\sclass="[^"]*"', "", html)
    return '<!doctype html><meta charset="utf-8">' + CSS_TEMPLATE.format(size=font_size) + html


def to_pdf(html_path: str, pdf_path: str) -> None:
    if not os.path.exists(CHROME):
        sys.exit(f"Chrome が見つかりません: {CHROME}")
    subprocess.run(
        [
            CHROME,
            "--headless=new",
            "--disable-gpu",
            "--no-pdf-header-footer",
            f"--print-to-pdf={pdf_path}",
            "file:///" + html_path.replace("\\", "/"),
        ],
        check=True,
        capture_output=True,
    )


def drop_blank_pages(pdf_path: str) -> int:
    try:
        import fitz
    except ImportError:
        return -1
    d = fitz.open(pdf_path)
    blank = [i for i in range(len(d)) if not d[i].get_text().strip()]
    if blank and len(blank) < len(d):
        d.delete_pages(blank)
        # 同じパスへの上書き保存は fitz が拒否するので、別名に書いて差し替える
        tmp = pdf_path + ".tmp"
        d.save(tmp)
        n = len(d)
        d.close()
        os.replace(tmp, pdf_path)
        return n
    n = len(d)
    d.close()
    return n


def preview(pdf_path: str) -> str:
    try:
        import fitz
    except ImportError:
        return "(PyMuPDF 未導入のため本文確認をスキップ)"
    d = fitz.open(pdf_path)
    text = re.sub(r"\s+", " ", " ".join(p.get_text() for p in d))
    d.close()
    return text[:400]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--font-size", type=int, default=13)
    args = ap.parse_args()

    html = open(args.src, encoding="utf-8").read()
    cleaned = clean(html, args.font_size)

    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(cleaned)
        tmp = f.name
    try:
        to_pdf(tmp, args.dst)
    finally:
        os.unlink(tmp)

    pages = drop_blank_pages(args.dst)
    print(f"{args.dst} ({os.path.getsize(args.dst):,} bytes, {pages} pages)")
    print("--- 本文確認 ---")
    print(preview(args.dst))


if __name__ == "__main__":
    main()
