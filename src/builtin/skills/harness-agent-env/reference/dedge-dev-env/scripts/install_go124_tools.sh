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

echo -e "${GREEN}Installing Go 1.24 toolset...${NC}"
echo -e "${BLUE}Go:${NC} $(${GO_BIN} version)"

"${GO_BIN}" install golang.org/x/tools/gopls@v0.21.1
"${GO_BIN}" install golang.org/x/tools/cmd/goimports@v0.31.0
"${GO_BIN}" install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.64.8
"${GO_BIN}" install github.com/go-delve/delve/cmd/dlv@v1.24.0

echo -e "${GREEN}Installed into ${TOOLS_DIR}${NC}"
[[ -x "${TOOLS_DIR}/gopls" ]] && "${TOOLS_DIR}/gopls" version | head -1
[[ -x "${TOOLS_DIR}/goimports" ]] && echo "goimports installed"
[[ -x "${TOOLS_DIR}/golangci-lint" ]] && "${TOOLS_DIR}/golangci-lint" --version | head -1
[[ -x "${TOOLS_DIR}/dlv" ]] && "${TOOLS_DIR}/dlv" version | head -1
