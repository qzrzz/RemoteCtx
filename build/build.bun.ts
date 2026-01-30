import fs from "node:fs/promises"

console.log("Cleaning dist...")
await fs.rm("./dist-bundler", { recursive: true, force: true })

console.log("Building Node (index.ts)...")
const nodeBuild = await Bun.build({
    entrypoints: ["./src/index.ts"],
    format: "esm",
    outdir: "./dist-bundler",
    external: [],
    target: "node",
})
if (!nodeBuild.success) {
    console.error("Node build failed:", nodeBuild.logs)
    process.exit(1)
}

console.log("Building Browser (RemoteCtxHost.ts)...")
const browserBuild = await Bun.build({
    entrypoints: ["./src/RemoteCtxHost.ts"],
    format: "iife",
    outdir: "./dist-bundler",
    external: [],
    target: "browser",
})
if (!browserBuild.success) {
    console.error("Browser build failed:", browserBuild.logs)
    process.exit(1)
}

console.log("Build complete.")
