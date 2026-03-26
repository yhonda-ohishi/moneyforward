#!/bin/bash
# 最新バックアップの journals.json を public/data/ にコピー
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BACKUPS_DIR="$(dirname "$APP_DIR")/backups"
TARGET_DIR="$APP_DIR/public/data"

mkdir -p "$TARGET_DIR"

# 最新のバックアップフォルダを取得（名前順で最後）
LATEST=$(ls -d "$BACKUPS_DIR"/*/ 2>/dev/null | sort | tail -1)

if [ -z "$LATEST" ]; then
  echo "[copy-journals] バックアップが見つかりません: $BACKUPS_DIR"
  exit 0
fi

cp "$LATEST/journals.json" "$TARGET_DIR/journals.json" 2>/dev/null
cp "$LATEST/backup_info.json" "$TARGET_DIR/backup_info.json" 2>/dev/null

echo "[copy-journals] コピー完了: $LATEST -> $TARGET_DIR"
