import { build } from "bun"
import fs from "node:fs/promises"
import path from "node:path"

const SRC_DIR = path.resolve(import.meta.dir, "../extension")
const DIST_DIR = path.resolve(import.meta.dir, "../dist/extension")

async function clean() {
    await fs.rm(DIST_DIR, { recursive: true, force: true })
    await fs.mkdir(DIST_DIR, { recursive: true })
}

async function copyStaticModels() {
    await fs.copyFile(path.join(SRC_DIR, "manifest.json"), path.join(DIST_DIR, "manifest.json"))
    await fs.copyFile(path.join(SRC_DIR, "popup.html"), path.join(DIST_DIR, "popup.html"))
    await fs.copyFile(path.join(SRC_DIR, "icon-128.png"), path.join(DIST_DIR, "icon-128.png"))
    await fs.copyFile(path.join(SRC_DIR, "icon-512.png"), path.join(DIST_DIR, "icon-512.png"))
}

async function bundle() {
    console.log("[Build] Bundling extension...")

    // Build content script
    await build({
        entrypoints: [path.join(SRC_DIR, "content.ts")],
        outdir: DIST_DIR,
        target: "browser",
        minify: false,
    })

    // Build popup script
    await build({
        entrypoints: [path.join(SRC_DIR, "popup.ts")],
        outdir: DIST_DIR,
        target: "browser",
        minify: false,
    })

    // Build injected script
    // Warning: injected script imports RemoteCtxHost, which might have dependencies.
    // Bun's bundler handles this well.
    await build({
        entrypoints: [path.join(SRC_DIR, "injected.ts")],
        outdir: DIST_DIR,
        target: "browser",
        minify: false,
    })
}

async function main() {
    try {
        await clean()
        await copyStaticModels()
        await bundle()
        console.log("[Build] Extension built successfully at dist/extension")
    } catch (error) {
        console.error("[Build] Failed to build extension:", error)
        process.exit(1)
    }
}

main()
