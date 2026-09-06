#!/bin/bash
# ==============================================================================
# HRMS PostgreSQL Automated Daily Backup Script
# Creates a compressed pg_dump and retains backups for 30 days.
# ==============================================================================

set -e

# Resolve script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/hrms_backup_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

# Load environment variables if .env exists
if [ -f "$PROJECT_ROOT/.env" ]; then
  # Export vars without comments
  export $(grep -v "^#" "$PROJECT_ROOT/.env" | grep -v "^\s*$" | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[ERROR] DATABASE_URL is not set in .env or environment" >&2
  exit 1
fi

if ! command -v pg_dump &> /dev/null; then
  echo "[ERROR] pg_dump utility is not installed or not in PATH" >&2
  exit 1
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting database backup for HRMS..."

# Execute pg_dump with gzip compression
pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip -9 > "$BACKUP_FILE"

FILE_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup completed successfully: $BACKUP_FILE ($FILE_SIZE)"

# Retain backups for 30 days (delete older files)
DELETED_COUNT=$(find "$BACKUP_DIR" -type f -name "hrms_backup_*.sql.gz" -mtime +30 -delete -print | wc -l | tr -d " ")
if [ "$DELETED_COUNT" -gt "0" ]; then
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Cleaned up $DELETED_COUNT backup(s) older than 30 days."
fi
