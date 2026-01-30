import { describe, it, expect, afterAll } from "vitest"
import { RemoteCtx } from "../src/index"
import { spawn, type ChildProcess } from "child_process"
import { join } from "path"
import { fileURLToPath } from "url"

const __dirname = fileURLToPath(import.meta.url).replace(/\/[^/]+$/, "")

describe("RemoteCtx serialize", () => {
    let hostProcess: ChildProcess

    afterAll(() => {
        if (hostProcess) hostProcess.kill()
    })

    it("should serialize remote object values", async () => {
        const remoteCtx = new RemoteCtx()
        const port = remoteCtx.port

        const hostScript = join(__dirname, "host-process.ts")
        hostProcess = spawn("bun", [hostScript, port.toString()], {
            stdio: "inherit",
        })

        await remoteCtx.ready

        const host = remoteCtx.host

        // 验证 serialize 功能
        // Note: host.o1 is a getter that returns { t1: 1 }

        // 1. 常规访问返回 Plain Object (Previously Proxy)
        expect(typeof host.o1).toBe("object")
        // 2. 使用 serialize 获取值
        const val = remoteCtx.serialize(host.o1)
        expect(val).toEqual({ t1: 1 })

        // 3. 验证对普通值的作用（应直接返回）
        expect(remoteCtx.serialize(123)).toBe(123)
        expect(remoteCtx.serialize(host.num)).toBe(0)
    }, 15000)
})
