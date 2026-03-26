#!/bin/bash
# 全年度のバックアップ journals.json を public/data/ にコピー
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BACKUPS_DIR="$(dirname "$APP_DIR")/backups"
TARGET_DIR="$APP_DIR/public/data"

mkdir -p "$TARGET_DIR"

# 各年度フォルダをコピー
for year_dir in "$BACKUPS_DIR"/*/; do
  [ -d "$year_dir" ] || continue
  year=$(basename "$year_dir")

  # タイムスタンプ付きフォルダ（2026-03-26_161718）→ 年度判定してコピー
  if echo "$year" | grep -qE '^[0-9]{4}-[0-9]'; then
    if [ -f "${year_dir}journals.json" ]; then
      winpath=$(cygpath -w "${year_dir}journals.json" 2>/dev/null || echo "${year_dir}journals.json")
      fiscal=$(python -c "import json; f=open(r'$winpath', encoding='utf-8'); d=json.load(f); print(d['journals'][0]['term_period'])" 2>/dev/null)
      if [ -n "$fiscal" ]; then
        mkdir -p "$TARGET_DIR/$fiscal"
        cp "${year_dir}journals.json" "$TARGET_DIR/$fiscal/journals.json" 2>/dev/null
        cp "${year_dir}backup_info.json" "$TARGET_DIR/$fiscal/backup_info.json" 2>/dev/null
        echo "[copy-journals] $year -> $TARGET_DIR/$fiscal/"
      fi
    fi
  else
    # 年度名フォルダ（2025/）
    if [ -f "$year_dir/journals.json" ]; then
      mkdir -p "$TARGET_DIR/$year"
      cp "$year_dir/journals.json" "$TARGET_DIR/$year/journals.json" 2>/dev/null
      cp "$year_dir/backup_info.json" "$TARGET_DIR/$year/backup_info.json" 2>/dev/null
      echo "[copy-journals] $year -> $TARGET_DIR/$year/"
    fi
  fi
done

echo "[copy-journals] 完了"
