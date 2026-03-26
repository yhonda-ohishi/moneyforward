"""
MoneyForwardバックアップ・ログをGoogle Driveに同期

rclone で backups/ と audit-logs/ を gdrive:moneyforward/ に同期する。
"""

import subprocess
import sys
import os
from pathlib import Path

RCLONE = os.path.expanduser("~/bin/rclone.exe")
SYNC_DIRS = [
    ("c:/moneyforward/backups", "gdrive:moneyforward/backups"),
    ("c:/moneyforward/audit-logs", "gdrive:moneyforward/audit-logs"),
]


def main():
    if not Path(RCLONE).exists():
        return

    for local, remote in SYNC_DIRS:
        if not Path(local).exists():
            continue
        try:
            subprocess.run(
                [RCLONE, "sync", local, remote, "--quiet"],
                timeout=30,
                capture_output=True,
            )
        except Exception:
            pass


if __name__ == "__main__":
    main()
