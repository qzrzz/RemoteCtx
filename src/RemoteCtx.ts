import { createSyncFn } from "synckit"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 总是优先使用构建好的 worker.js，因为通用的 Node worker 无法直接处理 .ts 文件（除非使用 loader）
// 如果我们在 'src' 目录运行，构建好的 worker 通常在 '../dist/worker.js'
// 如果我们在 'dist' 目录运行，构建好的 worker 在当前目录 './worker.js'

import { existsSync } from "fs"

const distWorker = join(__dirname, "../dist/worker.js")
const localWorker = join(__dirname, "./worker.js")

const WORKER_PATH = existsSync(distWorker) ? distWorker : localWorker

export interface RemoteCtxOptions {
    port?: number
}

// 内部用于获取代理路径的 Symbol
const INTERNAL_PATH = Symbol("INTERNAL_PATH")

export class RemoteCtx {
    private syncFn: (message: any) => any
    public port: number
    public host: any

    constructor(options: RemoteCtxOptions = {}) {
        this.syncFn = createSyncFn(WORKER_PATH) as any

        // Start the server
        this.port = this.syncFn({ type: "listen", payload: options.port })

        this.host = this.createProxy([])
    }

    /**
     * 获取远程对象的序列化值（绕过 Proxy）
     */
    serialize(proxy: any) {
        if (!proxy || typeof proxy !== "function") {
            // 如果不是代理对象（或者是普通值），直接返回
            return proxy
        }

        const path = proxy[INTERNAL_PATH]
        if (!path) {
            // 如果没有内部路径，说明可能不是我们的代理，或者是一个普通函数
            // 尝试直接返回
            return proxy
        }

        // 调用远程 serialize 方法
        return this.syncFn({ type: "serialize", payload: { path } })
    }

    get ready(): Promise<void> {
        return new Promise(async (resolve) => {
            // Poll for connection
            while (true) {
                const connected = this.syncFn({ type: "wait-connection" })
                if (connected) {
                    resolve()
                    return
                }
                await new Promise((r) => setTimeout(r, 100))
            }
        })
    }

    private hydrate(value: any, path: string[]): any {
        if (value && typeof value === "object") {
            if (value.__type === "proxy_ref") {
                // 如果是代理引用，重建代理
                // 注意：服务端返回了 path (如果是函数/promise)，但我们在这里主要依赖上层传入的 path 或者重建
                // 如果 value.path 存在，使用它（通常用于函数/Promise）
                // 如果不存在，可能需要根据上下文推断，但目前我们的设计是基于 path 访问的，所以 hydrate 应该是递归的
                return this.createProxy(value.path || path)
            }

            if (value.__type === "object_descriptor") {
                const descriptors = value.descriptors
                const result: any = {}
                const props: PropertyDescriptorMap = {}

                for (const key in descriptors) {
                    const desc = descriptors[key]
                    const newPath = [...path, key]

                    if (
                        (desc.get && desc.get.__type === "remote_getter") ||
                        (desc.set && desc.set.__type === "remote_setter")
                    ) {
                        // Accessor Descriptor
                        props[key] = {
                            configurable: desc.configurable,
                            enumerable: desc.enumerable,
                            get:
                                desc.get && desc.get.__type === "remote_getter"
                                    ? () => {
                                          const val = this.syncFn({ type: "get", payload: { path: newPath } })
                                          return this.hydrate(val, newPath)
                                      }
                                    : undefined,
                            set:
                                desc.set && desc.set.__type === "remote_setter"
                                    ? (v: any) => {
                                          this.syncFn({ type: "set", payload: { path: newPath, value: v } })
                                      }
                                    : undefined,
                        }
                    } else {
                        // Data Descriptor
                        props[key] = {
                            configurable: desc.configurable,
                            enumerable: desc.enumerable,
                            writable: desc.writable,
                            value: desc.value !== undefined ? this.hydrate(desc.value, newPath) : undefined,
                        }
                    }
                }

                Object.defineProperties(result, props)
                return result
            }

            if (Array.isArray(value)) {
                return value.map((item, index) => this.hydrate(item, [...path, index.toString()]))
            }

            // Fallback for simple objects (should be rare if Host sends descriptors)
            const result: any = {}
            for (const key in value) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    result[key] = this.hydrate(value[key], [...path, key])
                }
            }
            return result
        }
        return value
    }

    // 创建代理以拦截属性访问
    private createProxy(path: string[]): any {
        // 我们返回一个函数代理，以同时处理调用 (apply) 和属性访问 (get)
        const proxy = new Proxy(() => {}, {
            get: (_target, prop) => {
                if (prop === INTERNAL_PATH) return path
                if (prop === "then") return undefined // 不处理 Promise 的 then 方法，避免被误认为是 Promise
                if (typeof prop === "string") {
                    const newPath = [...path, prop]

                    try {
                        // 策略：所有的属性访问都是同步的 RPC 调用
                        // JavaScript 的属性访问 (Property Access) 是即时的，所以我们需要通过 synckit 同步获取值

                        // 发起同步请求获取路径对应的值
                        const result = this.syncFn({ type: "get", payload: { path: newPath } })

                        // 如果返回值是一个特殊标记对象（表示它是一个引用、函数或复杂对象）
                        // 我们返回一个新的代理，以便继续链式访问
                        if (result && typeof result === "object" && result.__type === "proxy_ref") {
                            return this.createProxy(result.path || newPath)
                        }

                        // 使用 hydrate 处理可能的对象/数组，将其中的 proxy_ref 转换为代理，
                        // 其他保持为普通对象
                        if (result && typeof result === "object") {
                            return this.hydrate(result, newPath)
                        }

                        // 如果是基本类型（string, number, boolean），直接返回该值
                        return result
                    } catch (e) {
                        // 如果发生错误（例如路径不存在），抛出异常
                        throw e
                    }
                }
                return undefined
            },

            set: (_target, prop, value) => {
                if (typeof prop === "string") {
                    const newPath = [...path, prop]
                    // 同步设置远程属性的值
                    this.syncFn({ type: "set", payload: { path: newPath, value } })
                    return true
                }
                return false
            },

            apply: (_target, _thisArg, args) => {
                // 处理函数调用
                // 同步发送调用请求，并返回结果
                return this.syncFn({ type: "apply", payload: { path, args } })
            },
        })

        return proxy
    }
}
