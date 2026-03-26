#!/bin/bash
# ローカルインボイスPDFからインデックスJSONを生成
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
INVOICES_SRC="$(dirname "$APP_DIR")/references/invoices"
TARGET_DIR="$APP_DIR/public/data"

mkdir -p "$TARGET_DIR/invoices"

echo '[' > "$TARGET_DIR/invoices.json"
first=true

for year_dir in "$INVOICES_SRC"/*/; do
  [ -d "$year_dir" ] || continue
  # 二重ネスト対応 (2026/2026/)
  inner_dir="$year_dir"
  for sub in "$year_dir"*/; do
    [ -d "$sub" ] && inner_dir="$sub" && break
  done

  year=$(basename "$year_dir")
  mkdir -p "$TARGET_DIR/invoices/$year"

  for pdf in "$inner_dir"*.pdf "$inner_dir"*.docx "$inner_dir"*.jpeg "$inner_dir"*.jpg "$inner_dir"*.png; do
    [ -f "$pdf" ] || continue
    filename=$(basename "$pdf")
    # YYYY-MM-DD_取引先.pdf からメタデータ抽出
    date_part=$(echo "$filename" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
    counterparty=$(echo "$filename" | sed 's/^[0-9-]*_//' | sed 's/\.[^.]*$//' | sed 's/([0-9]*)$//')

    # public/data/invoices/YEAR/ にコピー
    cp "$pdf" "$TARGET_DIR/invoices/$year/$filename"

    if [ "$first" = true ]; then
      first=false
    else
      echo ',' >> "$TARGET_DIR/invoices.json"
    fi

    cat >> "$TARGET_DIR/invoices.json" <<ENTRY
  {
    "fileName": "$filename",
    "path": "/data/invoices/$year/$filename",
    "year": "$year",
    "transactionDate": "$date_part",
    "counterparty": "$counterparty"
  }
ENTRY
  done
done

echo ']' >> "$TARGET_DIR/invoices.json"

count=$(grep -c '"fileName"' "$TARGET_DIR/invoices.json")
echo "[index-invoices] $count 件のインボイスをインデックス化しました → $TARGET_DIR/invoices.json"

# matches.json もコピー
if [ -f "$INVOICES_SRC/matches.json" ]; then
  cp "$INVOICES_SRC/matches.json" "$TARGET_DIR/matches.json"
  echo "[index-invoices] matches.json をコピーしました"
fi
