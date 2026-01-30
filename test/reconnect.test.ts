import { describe, it, expect, afterAll } from "vitest"
import { RemoteCtx } from "../src/index"
import { spawn, type ChildProcess } from "child_process"
import { join } from "path"
import { fileURLToPath } from "url"

const __dirname = fileURLToPath(import.meta.url).replace(/\/[^/]+$/, "")

describe("RemoteCtx Reconnection", () => {
    let hostProcess: ChildProcess

    afterAll(() => {
        if (hostProcess) hostProcess.kill()
    })

    it("should reconnect if server starts later", async () => {
        const port = 50000 + Math.floor(Math.random() * 1000)

        console.log("Testing with port", port)

        // 1. Start RemoteCtxHost ("Host" side) FIRST
        const hostScript = join(__dirname, "host-process.ts")
        hostProcess = spawn("bun", [hostScript, port.toString()], {
            stdio: "inherit",
        })

        // Wait a bit to ensure Host started and failed to connect initially
        await new Promise((r) => setTimeout(r, 2000))

        console.log("Starting RemoteCtx server now...")

        // 2. Start RemoteCtx ("Work" side)
        const remoteCtx = new RemoteCtx({ port })

        // 3. Wait for connection
        // RemoteCtx should eventually receive connection from the retrying Host
        await remoteCtx.ready
        console.log("RemoteCtx connected")

        // 4. Verify interaction
        const host = remoteCtx.host
        expect(host.o1).toEqual({ t1: 1 })
    }, 15000)
})
