import { describe, it, expect, afterAll } from "vitest"
import { RemoteCtx } from "../src/index"
import { spawn, type ChildProcess } from "child_process"
import { join } from "path"
import { fileURLToPath } from "url"
import { inspect } from "util"

const __dirname = fileURLToPath(import.meta.url).replace(/\/[^/]+$/, "")

describe("RemoteCtx", () => {
    let hostProcess: ChildProcess

    afterAll(() => {
        if (hostProcess) hostProcess.kill()
    })

    it("should sync properties from host", async () => {
        // 1. Start RemoteCtx ("Work" side)
        const remoteCtx = new RemoteCtx()
        const port = remoteCtx.port
        expect(port).toBeGreaterThan(0)

        console.log("RemoteCtx running on port", port)

        // 2. Start RemoteCtxHost ("Host" side) in a separate process using Bun
        const hostScript = join(__dirname, "host-process.ts")
        hostProcess = spawn("bun", [hostScript, port.toString()], {
            stdio: "inherit", // See output
        })

        // 3. Wait for connection
        await remoteCtx.ready
        console.log("RemoteCtx connected")

        // 4. Access properties synchronously
        const host = remoteCtx.host

        // Test property read
        expect(host.title).toBe("Remote World")
        expect(host.nested.flag).toBe(true)

        // Test property write
        host.title = "New Title"
        expect(host.title).toBe("New Title")
        // Note: we can't easily verify the remote object "hostEnv" directly here because it is in another process.
        // But read-back confirms the SET was effective on the remote side.

        // Test function call
        expect(host.calc(1, 2)).toBe(3)
        expect(host.nested.echo("hello")).toBe("hello")

        // Test async function call (accessed synchronously)
        const asyncRes = host.asyncFn(10)
        expect(asyncRes).toBe(20)

        // 其它

        expect(host.num).toBe(0)

        host.num = 5
        expect(host.num).toBe(5)
        host.num++
        expect(host.num).toBe(6)

        expect(host.getter).toBe(0)
        host.getter = "ok"
        expect(host.getter).toBe("ok")

        expect(host.o1).toEqual({ t1: 1 })

        console.log("o2", host.o2)
        expect(host.o2.z1).toEqual({ v: 1 })

        console.log("o3", inspect(host.o3, { showHidden: true, depth: null }))
        // Verify z1 exists but is non-enumerable
        const desc = Object.getOwnPropertyDescriptor(host.o3, "z1")
        expect(desc).toBeDefined()
        expect(desc?.enumerable).toBe(false)
        expect(host.o3.z1).toEqual({ v: 1 })

        expect(host.o3.a.name).toEqual("name1")
    }, 10000)
})
