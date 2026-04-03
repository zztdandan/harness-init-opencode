#!/bin/bash
# Switch current shell to Go 1.20 dedge environment.
# Usage: source ./switch_go120.sh [goroot] [gopath] [gobin]

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Please use: source ./switch_go120.sh [goroot] [gopath] [gobin]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/go_env_common.sh"

ARG_GOROOT="${1:-}"
ARG_GOPATH="${2:-}"
ARG_GOBIN="${3:-}"

GOROOT_RESOLVED="$(resolve_goroot 120 "${ARG_GOROOT}")" || {
  echo -e "${RED}Cannot find Go 1.20 GOROOT at default path.${NC}"
  echo -e "${YELLOW}Ask agent to discover paths, then run:${NC}"
  echo -e "${YELLOW}source ./switch_go120.sh <goroot> <gopath> <gobin>${NC}"
  return 1
}
GOPATH_RESOLVED="$(resolve_gopath 120 "${ARG_GOPATH}")"
GOBIN_RESOLVED="$(resolve_gobin 120 "${GOPATH_RESOLVED}" "${ARG_GOBIN}")"

setup_go_env_common "${GOROOT_RESOLVED}" "${GOPATH_RESOLVED}" "${GOBIN_RESOLVED}"

echo -e "${GREEN}Switched to Go 1.20 dedge env${NC}"
print_env_summary
print_tool_presence 120 "${GOBIN_RESOLVED}"
