#!/bin/sh
# Session-start sync in ONE call — tooling for AI-assisted sessions (Claude via a terminal bridge).
#
#   sh scripts/dev/sync.sh [<expected branch tip from project memory, e.g. e2cd10d>]
#
# Why: every terminal call is a full LLM turn, and a session that starts on a stale or dirty clone wastes the whole
# session. This script does fetch -> checks -> pull --ff-only (only when the branch is merely behind) -> npm install
# (only when package(-lock).json changed or node_modules is incomplete) and prints one OK line.
#
# It NEVER resets, stashes or discards anything. Modified/staged tracked files, unpushed commits, a diverged branch or
# a tip different from the expected one -> "STOP ...", exit 1, and the human decides.
# Untracked files are only listed: they are often local scratch specs, and deliver.sh never stages them implicitly.
set -u
cd "$(dirname "$0")/../.." || exit 2
stop() { echo "STOP: $*"; exit 1; }
echo "machine: $(hostname), repo: $(pwd)"
git fetch --prune -q origin || stop "git fetch failed"
b=$(git rev-parse --abbrev-ref HEAD)
[ "$b" != HEAD ] || stop "detached HEAD"
dirty=$(git status --porcelain --untracked-files=no)
[ -z "$dirty" ] || { echo "$dirty" | head -n 10; stop "uncommitted changes to tracked files (above)"; }
untracked=$(git status --porcelain | grep '^??' || true)
[ -z "$untracked" ] || echo "note: untracked (left alone): $(echo "$untracked" | cut -c4- | tr '\n' ' ')"
git rev-parse -q --verify "origin/$b" > /dev/null || stop "branch $b does not exist on origin"
ahead=$(git rev-list --count "origin/$b..HEAD")
behind=$(git rev-list --count "HEAD..origin/$b")
[ "$ahead" = 0 ] || stop "$b has $ahead unpushed commit(s) (behind origin: $behind)"
NPM=0
if [ "$behind" != 0 ]; then
  old=$(git rev-parse HEAD)
  git pull --ff-only -q origin "$b" || stop "pull --ff-only failed"
  echo "fast-forwarded from origin: $behind commit(s)"
  if git diff --name-only "$old" HEAD | grep -qE '^package(-lock)?[.]json$'; then NPM=1; fi
fi
# @playwright/test and allure are the two packages every test/report command needs.
[ -d node_modules/@playwright/test ] && [ -d node_modules/allure-playwright ] || NPM=1
if [ "$NPM" = 1 ]; then
  npm install --no-audit --no-fund --loglevel=error > /dev/null || stop "npm install failed"
  echo "npm install: done"
fi
tip=$(git rev-parse --short HEAD)
if [ $# -ge 1 ] && [ "$(git rev-parse --short "$1" 2> /dev/null)" != "$tip" ]; then
  stop "tip of $b is $tip but memory says $1 — confirm which branch is the working one"
fi
echo "OK  branch $b, tip $tip = origin/$b, no tracked changes"
