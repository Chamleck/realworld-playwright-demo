#!/bin/sh
# Commit + push + verify in ONE call — tooling for AI-assisted sessions (Claude via a terminal bridge).
#
#   sh scripts/dev/deliver.sh [--dry-run] <message file> <marker> <file> [<file>...]
#
# Run from the repo root; file paths as `git status` shows them; <marker> is a string from the FIRST file's new content.
# Order: fetch -> checks -> `git add` EXACTLY the named files (never -A) -> the index holds exactly those files ->
# `git commit -F <message file>` -> push (-u for a new branch) -> verification BY CONTENT: HEAD = origin/<branch>,
# <marker> is present in the first file on origin, no tracked changes left behind.
#
# Why verify by content: "pushed" claimed from recall instead of from origin is the failure this script exists to
# prevent — a missing `push`, a wrong branch or a file left out of the commit are all caught here, not in the next chat.
# The message must carry the Co-Authored-By trailer (attribution of AI-assisted commits is a project rule).
# Protected branches (main, gh-pages) are refused: gh-pages is written only by the pages.yml deploy job.
# --dry-run prints the plan (branch, files, diff --stat) and changes nothing. Any error -> "STOP ...", exit 1.
set -u
stop() { echo "STOP: $*"; exit 1; }
[ -f scripts/dev/deliver.sh ] || stop "run from the repo root"
DRY=0
[ "${1:-}" = --dry-run ] && { DRY=1; shift; }
[ $# -ge 3 ] || { echo "Usage: sh scripts/dev/deliver.sh [--dry-run] <message file> <marker> <file>..."; exit 2; }
msg=$1; marker=$2; shift 2
[ -s "$msg" ] || stop "message file $msg is missing or empty"
grep -q '^Co-Authored-By: ' "$msg" || stop "message has no Co-Authored-By trailer"
for f in "$@"; do
  [ -e "$f" ] || git ls-files --error-unmatch -- "$f" > /dev/null 2>&1 || stop "no such file $f"
done
grep -qF -- "$marker" "$1" || stop "marker '$marker' not found in $1 (locally) — nothing committed"
b=$(git rev-parse --abbrev-ref HEAD)
case "$b" in HEAD | main | gh-pages) stop "refusing to deliver from '$b'" ;; esac
git fetch -q origin || stop "git fetch failed"
NEW=1
if git rev-parse -q --verify "origin/$b" > /dev/null; then
  NEW=0
  behind=$(git rev-list --count "HEAD..origin/$b")
  [ "$behind" = 0 ] || stop "$b is $behind commit(s) behind origin — run scripts/dev/sync.sh first"
fi
[ -z "$(git diff --cached --name-only)" ] || stop "index is not empty: $(git diff --cached --name-only | tr '\n' ' ')"
if [ $DRY = 1 ]; then
  echo "plan: branch $b ($([ $NEW = 1 ] && echo 'new on origin' || echo 'exists on origin')), $# file(s), marker '$marker' in $1"
  git diff --stat -- "$@" | tail -n 1
  git status --porcelain -- "$@" | grep '^??' || true
  exit 0
fi
git add -A -- "$@" || stop "git add failed"
want=$(for f in "$@"; do echo "$f"; done | sort -u)
got=$(git diff --cached --name-only | sort -u)
[ "$want" = "$got" ] || { git reset -q -- "$@"; stop "index does not hold exactly the named files (unchanged file?): $(echo $got)"; }
git commit -q -F "$msg" || stop "commit failed"
if [ $NEW = 1 ]; then git push -q -u origin "$b" || stop "push failed"; else git push -q origin "$b" || stop "push failed"; fi
git fetch -q origin || stop "git fetch after push failed"
h=$(git rev-parse --short HEAD)
o=$(git rev-parse --short "origin/$b")
[ "$h" = "$o" ] || stop "HEAD $h != origin/$b $o"
git show "origin/$b:$1" | grep -qF -- "$marker" || stop "marker '$marker' not found in $1 on origin"
left=$(git status --porcelain --untracked-files=no)
[ -z "$left" ] || { echo "$left"; stop "tracked changes left in the working tree (above)"; }
echo "OK  $b $h = origin/$b; marker '$marker' in $1 on origin; no tracked changes left"
