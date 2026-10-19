#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: %s [--dry-run]\n' "${0##*/}"
}

dry_run=false
if [[ "${1:-}" == "--dry-run" && $# -eq 1 ]]; then
  dry_run=true
elif [[ $# -ne 0 ]]; then
  usage >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

for command_name in git npm tar gzip sha256sum gh; do
  command -v "$command_name" >/dev/null || {
    printf 'Required command is missing: %s\n' "$command_name" >&2
    exit 1
  }
done

branch="$(git branch --show-current)"
[[ "$branch" == "main" ]] || {
  printf 'Publish from main; current branch is %s.\n' "$branch" >&2
  exit 1
}

git fetch --quiet origin main
commit="$(git rev-parse HEAD)"
remote_commit="$(git rev-parse origin/main)"
[[ "$commit" == "$remote_commit" ]] || {
  printf 'Local main must match origin/main before release. Local=%s origin=%s\n' \
    "$commit" "$remote_commit" >&2
  exit 1
}

if [[ "$dry_run" == false ]] && [[ -n "$(git status --porcelain)" ]]; then
  printf 'Refusing to publish from a dirty worktree.\n' >&2
  exit 1
fi

if [[ "$dry_run" == false ]]; then
  gh auth status >/dev/null
fi

npm ci
npm run lint
npm run build
[[ -s dist/index.html ]] || {
  printf 'Build did not produce dist/index.html.\n' >&2
  exit 1
}

release_tag="home-${commit:0:12}"
release_dir="$(mktemp -d "${TMPDIR:-/tmp}/bizshore-home-release.XXXXXX")"
trap 'rm -rf "$release_dir"' EXIT
archive="$release_dir/bizshore-home-dist.tar.gz"
checksum="$archive.sha256"
source_commit="$release_dir/source-commit.txt"

# Normalize archive metadata so identical dist contents produce stable bytes.
tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner \
  -C dist -cf - . | gzip -n > "$archive"
(
  cd "$release_dir"
  sha256sum bizshore-home-dist.tar.gz > bizshore-home-dist.tar.gz.sha256
)
printf '%s\n' "$commit" > "$source_commit"

(cd "$release_dir" && sha256sum -c bizshore-home-dist.tar.gz.sha256)
if tar -tzf "$archive" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  printf 'Generated archive contains an unsafe path.\n' >&2
  exit 1
fi
tar -tzf "$archive" | grep -qx './index.html' || {
  printf 'Generated archive does not contain index.html.\n' >&2
  exit 1
}

if [[ "$dry_run" == true ]]; then
  printf 'Dry run passed: %s (%s), archive %s bytes. No GitHub release created.\n' \
    "$release_tag" "$commit" "$(stat -c %s "$archive")"
  exit 0
fi

if gh release view "$release_tag" >/dev/null 2>&1; then
  printf 'Release %s already exists; refusing to replace it.\n' "$release_tag" >&2
  exit 1
fi

gh release create "$release_tag" \
  --repo ja95aricapa/bizshore-home \
  --target "$commit" \
  --title "Bizshore Home ${commit:0:12}" \
  --notes "Static site built locally from commit $commit. Published by scripts/publish-release.sh." \
  "$archive" \
  "$checksum" \
  "$source_commit#source-commit.txt"
