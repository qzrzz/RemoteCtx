import type { Endpoint } from "comlink"

// 定义一个最小化的 WebSocket 接口，同时涵盖 Node 的 'ws' 和浏览器的 'WebSocket'
// 意图：统一不同环境下的 WebSocket 接口差异，方便后续统一处理
export interface IWebSocket {
    send(data: any): void
    addEventListener?: (type: string, listener: any) => void
    on?: (type: string, listener: any) => void
    close?: () => void
}

export function websocketToComlink(ws: any): Endpoint {
    return {
        postMessage: (message: any, transfer: any[]) => {
            const data = JSON.stringify(message)
            ws.send(data)
        },
        addEventListener: (
            type: string,
            listener: EventListenerOrEventListenerObject,
            options?: boolean | AddEventListenerOptions,
        ) => {
            if (type !== "message") {
                return
            }
            // 包装器：处理接收到的消息
            const wrapper = (event: { data: any }) => {
                try {
                    const data = JSON.parse(event.data as string)
                    if (typeof listener === "function") {
                        listener({ data } as MessageEvent)
                    } else {
                        listener.handleEvent({ data } as MessageEvent)
                    }
                } catch (e) {
                    // 忽略非 JSON 消息或解析错误，因为可能会收到非 RPC 相关的消息
                }
            }
            // 保存包装器以便稍后移除（此处为了简化未实现移除逻辑）
            // 根据环境不同，使用不同的事件监听方式
            if (typeof ws.addEventListener === "function") {
                ws.addEventListener("message", wrapper)
            } else if (typeof ws.on === "function") {
                ws.on("message", (data: any) => {
                    wrapper({ data })
                })
            }
        },
        removeEventListener: (
            type: string,
            listener: EventListenerOrEventListenerObject,
            options?: boolean | EventListenerOptions,
        ) => {
            // Not readily supported with 'ws' simple 'on' API without keeping references
            // For this use case, we might not strictly need removal if connection is short-lived or static
        },
    }
}
