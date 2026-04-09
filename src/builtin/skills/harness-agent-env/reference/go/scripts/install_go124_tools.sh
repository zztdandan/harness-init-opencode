#!/bin/bash
# Verify and install Go 1.24 core tools.
# Usage: bash ./install_go124_tools.sh [goroot] [gopath] [gobin]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/go_env_common.sh"

ARG_GOROOT="${1:-}"
ARG_GOPATH="${2:-}"
ARG_GOBIN="${3:-}"

GOROOT_RESOLVED="$(resolve_goroot 124 "${ARG_GOROOT}")" || {
  echo -e "${RED}Cannot find Go 1.24 GOROOT at default path.${NC}"
  echo -e "${YELLOW}Use: bash ./install_go124_tools.sh <goroot> <gopath> <gobin>${NC}"
  exit 1
}
GOPATH_RESOLVED="$(resolve_gopath 124 "${ARG_GOPATH}")"
GOBIN_RESOLVED="$(resolve_gobin 124 "${GOPATH_RESOLVED}" "${ARG_GOBIN}")"

setup_go_env_common "${GOROOT_RESOLVED}" "${GOPATH_RESOLVED}" "${GOBIN_RESOLVED}"
GO_BIN="${GOROOT_RESOLVED}/bin/go"
TOOLS_DIR="${GOBIN_RESOLVED}"

# Go 1.24.10-compatible pinned versions.
# Note: gopls >= v0.19.0 requires go >= 1.24.2.
GOPLS_VERSION="v0.18.1"
GOIMPORTS_VERSION="v0.31.0"
GOLANGCI_LINT_VERSION="v1.64.8"
DLV_VERSION="v1.24.0"

cleanup_existing_tools() {
  echo -e "${YELLOW}Cleaning existing Go 1.24 tool binaries and caches...${NC}"

  # Remove existing binaries to avoid accidentally reusing incompatible builds.
  rm -f "${TOOLS_DIR}/gopls" \
    "${TOOLS_DIR}/goimports" \
    "${TOOLS_DIR}/golangci-lint" \
    "${TOOLS_DIR}/dlv"

  # Clear Go build cache for a clean reinstall.
  "${GO_BIN}" clean -cache

  # Module cache may contain read-only files from previous sessions.
  # Try to clear it, but don't fail the whole install if permissions block cleanup.
  if ! "${GO_BIN}" clean -modcache; then
    echo -e "${YELLOW}Warning:${NC} cannot fully clear modcache (permission denied)."
    echo -e "${YELLOW}Tool binaries will still be reinstalled with pinned versions.${NC}"
  fi
}

echo -e "${GREEN}Installing Go 1.24 toolset...${NC}"
echo -e "${BLUE}Go:${NC} $(${GO_BIN} version)"

cleanup_existing_tools

"${GO_BIN}" install "golang.org/x/tools/gopls@${GOPLS_VERSION}"
"${GO_BIN}" install "golang.org/x/tools/cmd/goimports@${GOIMPORTS_VERSION}"
"${GO_BIN}" install "github.com/golangci/golangci-lint/cmd/golangci-lint@${GOLANGCI_LINT_VERSION}"
"${GO_BIN}" install "github.com/go-delve/delve/cmd/dlv@${DLV_VERSION}"

echo -e "${GREEN}Installed into ${TOOLS_DIR}${NC}"
[[ -x "${TOOLS_DIR}/gopls" ]] && "${TOOLS_DIR}/gopls" version
[[ -x "${TOOLS_DIR}/goimports" ]] && echo "goimports installed"
[[ -x "${TOOLS_DIR}/golangci-lint" ]] && "${TOOLS_DIR}/golangci-lint" --version
[[ -x "${TOOLS_DIR}/dlv" ]] && "${TOOLS_DIR}/dlv" version
