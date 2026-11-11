#!/usr/bin/env bash
# Commit and push whatever the data steps produced so far. Used by both daily-data
# jobs, so each lands its own work even if a later step or job fails.
# Usage: commit-data.sh <label>
set -euo pipefail
label="${1:?usage: commit-data.sh <label>}"

# Signed as the repo owner so Vercel's Hobby plan deploys the commit
# (it blocks commits from authors it doesn't recognize). Keep this on every commit.
git config user.name "onebeerjt"
git config user.email "258927197+onebeerjt@users.noreply.github.com"

git add data/site data/sources
if git diff --cached --quiet; then
  echo "No data changes to commit ($label)"
  exit 0
fi
git commit -m "Daily data refresh $(date -u +%F) ($label)"

# Someone may have pushed since checkout. Replay our commit on top; if a data file
# conflicts, the freshly generated one wins (-X theirs means "the commit being replayed").
branch="${GITHUB_REF_NAME:?}"
for attempt in 1 2 3; do
  if git pull --rebase -X theirs origin "$branch" && git push origin "HEAD:$branch"; then
    exit 0
  fi
  echo "push attempt $attempt failed, retrying"
  git rebase --abort 2>/dev/null || true
  sleep $((attempt * 5))
done
echo "Could not push after 3 attempts" >&2
exit 1
