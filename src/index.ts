import { fileURLToPath } from "node:url"

import { createHarnessInitPlugin, resolveBuiltinPaths } from "./plugin-factory"

const runtimeFile = fileURLToPath(import.meta.url)
const runtimePaths = resolveBuiltinPaths(runtimeFile)

const plugin = async () => createHarnessInitPlugin(runtimePaths)

export default plugin
