#!/bin/bash
# Script to download and bundle ttyd binary for different platforms

set -e

TTYD_VERSION="1.7.4"
BUNDLED_DIR="bundled/binaries"

echo "Downloading ttyd binaries for distribution..."

mkdir -p "$BUNDLED_DIR"

# Function to download ttyd for a specific platform
download_ttyd() {
    local platform=$1
    local filename=$2
    local url="https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/${filename}"
    
    echo "Downloading ttyd for ${platform}..."
    curl -L -o "${BUNDLED_DIR}/ttyd-${platform}" "$url"
    chmod +x "${BUNDLED_DIR}/ttyd-${platform}"
}

# Download for macOS (both Intel and Apple Silicon)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Check architecture
    if [[ $(uname -m) == "arm64" ]]; then
        download_ttyd "darwin-arm64" "ttyd.aarch64"
    else
        download_ttyd "darwin-x64" "ttyd.x86_64"
    fi
fi

# For production builds, you would download all platforms:
# download_ttyd "darwin-x64" "ttyd.x86_64"
# download_ttyd "darwin-arm64" "ttyd.aarch64"
# download_ttyd "linux-x64" "ttyd.x86_64"
# download_ttyd "win-x64" "ttyd.win32.exe"

echo "ttyd bundling complete!"
echo "Note: For production, download binaries for all target platforms."