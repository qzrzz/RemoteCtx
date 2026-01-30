import { WebSocketServer } from "ws"
import * as Comlink from "comlink"
import { runAsWorker } from "synckit"
import { websocketToComlink } from "./comlinkUtils"

// 定义远程上下文服务的接口（即 Host 端暴漏给 Work 端调用的能力）
export interface IRemoteCtxService {
    get(path: string[]): Promise<any>
    set(path: string[], value: any): Promise<void>
    apply(path: string[], args: any[]): Promise<any>
    serialize(path: string[]): Promise<any>
}

let wss: WebSocketServer | null = null
let currentHostService: Comlink.Remote<IRemoteCtxService> | null = null
let port = 0

// 这是 Synckit 的 Worker 入口
// synckit 会从主线程同步调用这个函数
// 我们在这里处理 WebSocket 服务的启动和 RPC 调用的转发
runAsWorker(async (message: { type: string; payload?: any }) => {
    switch (message.type) {
        case "listen": {
            if (wss) return port
            const requestedPort = message.payload || 0
            wss = new WebSocketServer({ port: requestedPort })

            return new Promise((resolve) => {
                wss!.on("listening", () => {
                    const address = wss!.address()
                    if (typeof address === "object" && address !== null) {
                        port = address.port
                    }
                    console.log("[RemoteCtx Worker] 监听端口:", port)
                    resolve(port)
                })

                wss!.on("connection", (ws) => {
                    console.log("[RemoteCtx Worker] Host 已连接")
                    const endpoint = websocketToComlink(ws as any)
                    // 使用 Comlink 包装 WebSocket，获得远程服务代理
                    currentHostService = Comlink.wrap<IRemoteCtxService>(endpoint)
                })
            })
        }

        case "wait-connection": {
            // 轮询连接状态
            // 主线程会同步调用此方法来检查 Host 是否已连接
            return !!currentHostService
        }

        case "get": {
            if (!currentHostService) throw new Error("No host connected")
            const { path } = message.payload
            return await currentHostService.get(path)
        }

        case "set": {
            if (!currentHostService) throw new Error("No host connected")
            const { path, value } = message.payload
            return await currentHostService.set(path, value)
        }

        case "apply": {
            if (!currentHostService) throw new Error("No host connected")
            const { path, args } = message.payload
            return await currentHostService.apply(path, args)
        }

        case "serialize": {
            if (!currentHostService) throw new Error("No host connected")
            const { path } = message.payload
            return await currentHostService.serialize(path)
        }

        default:
            throw new Error(`Unknown message type: ${message.type}`)
    }
})
