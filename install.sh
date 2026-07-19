#!/bin/sh
# Install freellama from GitHub Releases.
#
#   curl -fsSL https://raw.githubusercontent.com/johnpangalos/freellama/main/install.sh | sh
#
# Environment variables:
#   FREELLAMA_VERSION  release to install, e.g. 0.2.0 (default: latest)
#   FREELLAMA_INSTALL  install directory (default: ~/.local/bin)

set -eu

repo="johnpangalos/freellama"
install_dir="${FREELLAMA_INSTALL:-$HOME/.local/bin}"
version="${FREELLAMA_VERSION:-latest}"

err() {
  printf 'install.sh: %s\n' "$1" >&2
  exit 1
}

os=$(uname -s)
arch=$(uname -m)
case "$os-$arch" in
  Linux-x86_64) target="x86_64-unknown-linux-gnu" ;;
  Linux-aarch64 | Linux-arm64) target="aarch64-unknown-linux-gnu" ;;
  Darwin-x86_64) target="x86_64-apple-darwin" ;;
  Darwin-arm64) target="aarch64-apple-darwin" ;;
  *) err "unsupported platform: $os $arch — download a binary from https://github.com/$repo/releases (Windows: freellama-x86_64-pc-windows-msvc.zip)" ;;
esac

asset="freellama-$target.tar.gz"
if [ "$version" = latest ]; then
  url="https://github.com/$repo/releases/latest/download/$asset"
else
  url="https://github.com/$repo/releases/download/v${version#v}/$asset"
fi

tmp=$(mktemp -d "${TMPDIR:-/tmp}/freellama-install.XXXXXX")
trap 'rm -rf "$tmp"' EXIT

echo "Downloading $url"
if command -v curl >/dev/null 2>&1; then
  curl -fL --proto '=https' --progress-bar "$url" -o "$tmp/$asset" ||
    err "download failed — check that the release exists: $url"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$tmp/$asset" "$url" ||
    err "download failed — check that the release exists: $url"
else
  err "curl or wget is required"
fi

tar -xzf "$tmp/$asset" -C "$tmp"
mkdir -p "$install_dir"
install -m 755 "$tmp/freellama" "$install_dir/freellama"

echo "Installed $("$install_dir/freellama" --version) to $install_dir/freellama"

case ":$PATH:" in
  *":$install_dir:"*) ;;
  *)
    echo
    echo "Note: $install_dir is not on your PATH. Add it with:"
    echo "  export PATH=\"$install_dir:\$PATH\""
    ;;
esac
