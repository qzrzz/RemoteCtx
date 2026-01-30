import * as Comlink from "comlink"
import { websocketToComlink } from "./comlinkUtils"
import type { IRemoteCtxService } from "./worker"

export interface RemoteCtxHostOptions {
    url: string
}

export class RemoteCtxHost {
    private ws!: WebSocket

    constructor(options: RemoteCtxHostOptions) {
        let url = options.url
        if (url.startsWith("http://")) {
            url = url.replace("http://", "ws://")
        } else if (url.startsWith("https://")) {
            url = url.replace("https://", "wss://")
        }

        if (typeof WebSocket === "undefined") {
            throw new Error(
                "Global WebSocket is not defined. Please polyfill it or run in an environment with WebSocket support.",
            )
        }

        const connect = async () => {
            const ws = new WebSocket(url)
            this.ws = ws

            ws.onopen = () => {
                console.log("[RemoteCtxHost] 已连接到", url)
                this.setupComlink()
            }

            ws.onclose = () => {
                // 连接断开后，重新进入探测循环
                // console.log("[RemoteCtxHost] 连接断开，正等待恢复...")
                setTimeout(connect, 2000)
            }

            ws.onerror = (err: any) => {
                // 忽略错误
            }
        }

        connect()
    }

    expose(obj: any) {
        const descriptors = Object.getOwnPropertyDescriptors(obj)
        Object.defineProperties(globalThis, descriptors)
    }

    private sanitize(value: any, path: string[]): any {
        if (value === null || value === undefined) return value

        if (typeof value === "function") {
            return { __type: "proxy_ref", type: "function", path }
        }

        if (typeof value === "object") {
            if (typeof value.then === "function") {
                return { __type: "proxy_ref", type: "promise", path }
            }

            if (Array.isArray(value)) {
                return value.map((item, index) => this.sanitize(item, [...path, index.toString()]))
            }

            // 使用 descriptors 捕获所有属性（包括不可枚举的和原型链上的）
            const sanitizedDescriptors: any = {}
            let currentObj = value

            // 遍历原型链收集所有属性
            while (currentObj && currentObj !== Object.prototype) {
                const descriptors = Object.getOwnPropertyDescriptors(currentObj)

                for (const key in descriptors) {
                    // 子类属性覆盖父类属性，如果已经存在则跳过
                    if (key in sanitizedDescriptors) continue
                    if (key === "constructor") continue // 跳过构造函数

                    const desc = descriptors[key]
                    const newPath = [...path, key]

                    if (desc.get || desc.set) {
                        // Accessor Descriptor
                        sanitizedDescriptors[key] = {
                            configurable: desc.configurable,
                            enumerable: desc.enumerable,
                            get: desc.get ? { __type: "remote_getter", path: newPath } : undefined,
                            set: desc.set ? { __type: "remote_setter", path: newPath } : undefined,
                        }
                    } else {
                        // Data Descriptor
                        sanitizedDescriptors[key] = {
                            configurable: desc.configurable,
                            enumerable: desc.enumerable,
                            writable: desc.writable,
                            value: this.sanitize(desc.value, newPath),
                        }
                    }
                }

                currentObj = Object.getPrototypeOf(currentObj)
            }

            return {
                __type: "object_descriptor",
                descriptors: sanitizedDescriptors,
            }
        }

        return value
    }

    private setupComlink() {
        const endpoint = websocketToComlink(this.ws)

        const service: IRemoteCtxService = {
            get: async (path: string[]) => {
                const val = this.resolvePath(path)
                return this.sanitize(val, path)
            },
            set: async (path: string[], value: any) => {
                const target = this.resolvePath(path.slice(0, -1))
                const prop = path[path.length - 1]
                target[prop] = value
            },
            apply: async (path: string[], args: any[]) => {
                const fn = this.resolvePath(path)
                const thisArg = path.length > 1 ? this.resolvePath(path.slice(0, -1)) : globalThis
                const result = await fn.apply(thisArg, args)
                // 这里的 result 可能是新的对象，它的路径是动态的，或者是临时的
                // 对于函数调用的返回值，我们没有很好的方式去追踪它的“路径”（因为它不是全局树上的节点）
                // 所以我们可能无法为其生成准确的 path，或者我们使用一个特殊的标记路径？
                // 暂时传空路径，这意味着返回的函数可能无法被正确再次调用（作为 host 方法）
                // 实际上，如果返回值是对象，我们希望它是即值的。
                return this.sanitize(result, [])
            },
            serialize: async (path: string[]) => {
                const val = this.resolvePath(path)
                // 直接返回原始值，comlink 会处理序列化
                // 注意：这里不使用 sanitize，因为我们不想返回代理引用
                return val
            },
        }

        Comlink.expose(service, endpoint)
    }

    private resolvePath(path: string[]) {
        let current = globalThis as any

        if (path.length === 0) return current

        for (const segment of path) {
            if (current === undefined || current === null) {
                // 如果中间路径丢失，抛出错误
                throw new Error(`Cannot resolve path ${path.join(".")} at ${segment}`)
            }
            current = current[segment]
        }
        return current
    }
}

;(globalThis as any).RemoteCtxHost = RemoteCtxHost
