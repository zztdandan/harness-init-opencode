#!/bin/bash
# Common helpers for dedge Go environment scripts.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

resolve_goroot() {
  local version="$1"
  local arg_goroot="${2:-}"

  if [[ -n "${arg_goroot}" && -x "${arg_goroot}/bin/go" ]]; then
    echo "${arg_goroot}"
    return 0
  fi

  local env_key="DEDGE_GO${version}_GOROOT"
  local env_goroot="${!env_key:-}"
  if [[ -n "${env_goroot}" && -x "${env_goroot}/bin/go" ]]; then
    echo "${env_goroot}"
    return 0
  fi

  local default_goroot=""
  if [[ "${version}" == "120" ]]; then
    default_goroot="/home/base/.gvm/gos/go1.20.14"
  elif [[ "${version}" == "124" ]]; then
    default_goroot="/home/base/.gvm/gos/go1.24.10"
  fi

  if [[ -n "${default_goroot}" && -x "${default_goroot}/bin/go" ]]; then
    echo "${default_goroot}"
    return 0
  fi

  return 1
}

resolve_gopath() {
  local version="$1"
  local arg_gopath="${2:-}"

  if [[ -n "${arg_gopath}" ]]; then
    echo "${arg_gopath}"
    return 0
  fi

  local env_key="DEDGE_GO${version}_GOPATH"
  local env_gopath="${!env_key:-}"
  if [[ -n "${env_gopath}" ]]; then
    echo "${env_gopath}"
    return 0
  fi

  if [[ "${version}" == "120" ]]; then
    echo "/home/base/repo/go120_mod"
    return 0
  fi

  if [[ "${version}" == "124" ]]; then
    echo "/home/base/repo/go124_mod"
    return 0
  fi

  return 1
}

resolve_gobin() {
  local version="$1"
  local gopath="$2"
  local arg_gobin="${3:-}"

  if [[ -n "${arg_gobin}" ]]; then
    echo "${arg_gobin}"
    return 0
  fi

  local env_key="DEDGE_GO${version}_GOBIN"
  local env_gobin="${!env_key:-}"
  if [[ -n "${env_gobin}" ]]; then
    echo "${env_gobin}"
    return 0
  fi

  echo "${gopath}/bin"
}

path_prepend_unique() {
  local item="$1"
  if [[ ":${PATH}:" != *":${item}:"* ]]; then
    export PATH="${item}:${PATH}"
  fi
}

setup_go_env_common() {
  local goroot="$1"
  local gopath="$2"
  local gobin="$3"

  export GOROOT="${goroot}"
  export GOPATH="${gopath}"
  export GOBIN="${gobin}"
  export GOTOOLCHAIN="local"
  export GOPROXY="https://goproxy.cn,direct"
  export GOPRIVATE="gitlab-c7n.lgdxtech.com"
  export GONOPROXY="gitlab-c7n.lgdxtech.com"
  export GONOSUMDB="gitlab-c7n.lgdxtech.com"
  export GOSUMDB="sum.golang.org"
  export GO111MODULE="on"
  export CGO_ENABLED="1"

  mkdir -p "${GOPATH}" "${GOBIN}"

  path_prepend_unique "${GOROOT}/bin"
  path_prepend_unique "${GOBIN}"

  "${GOROOT}/bin/go" env -w GOSUMDB=sum.golang.org >/dev/null 2>&1 || true
}

print_env_summary() {
  echo -e "${GREEN}Environment switched${NC}"
  echo -e "${BLUE}go version:${NC} $(go version)"
  echo -e "${BLUE}GOROOT:${NC} $(go env GOROOT)"
  echo -e "${BLUE}GOPATH:${NC} $(go env GOPATH)"
  echo -e "${BLUE}GOBIN:${NC} ${GOBIN:-}"
  echo -e "${BLUE}PWD:${NC} $(pwd)"
}

print_tool_presence() {
  local version="$1"
  local gobin="$2"
  local tools=(gopls goimports golangci-lint dlv)

  echo -e "${YELLOW}Tool presence (from ${gobin}):${NC}"
  for t in "${tools[@]}"; do
    if [[ -x "${gobin}/${t}" ]]; then
      echo -e "  ${GREEN}ok${NC} ${t}"
    else
      echo -e "  ${RED}missing${NC} ${t} (run install_go${version}_tools.sh)"
    fi
  done
}
