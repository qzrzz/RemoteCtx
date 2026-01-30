/**
 * RemoteCtx Host Injected Script
 *
 * @description 被注入到页面主世界的脚本，负责初始化 RemoteCtxHost
 */

import { RemoteCtxHost } from "../src/RemoteCtxHost"

// 获取当前 script 标签传递的参数
// 在 type=module 中，import.meta.url 指向当前脚本 URL，但我们无法直接访问 script 标签的 dataset
// 所以我们使用 document.currentScript (但在 module 中通常为 null) 或者通过约定好的全局变量/DOM 元素传递
// 这里我们在 content script 中通过 data attribute 传递到了 script 标签上，
// 但是 script 标签被移除或者我们在 module 中难以获取到它自身。
//
// 修正策略：content.ts 可以在注入前，先注入一段代码设置 window.__REMOTE_CTX_CONFIG__
// 或者简单点，我们遍历 document.scripts 找到 src 包含 injected.js 的标签 (如果还没被移除)
// 实际上 content.ts 中 script.onload 移除标签可能太快了。
//
// 更稳健的方式：
// content script 发送 postMessage 给页面，injected script 监听消息。
// 但为了简单，我们让 content script 直接把配置写入到一个临时全局变量，injected script 读取后删除。

// 定义配置接口
interface RemoteCtxConfig {
    hostUrl: string
}

// 扩展 window 接口
declare global {
    interface Window {
        __REMOTE_CTX_CONFIG__?: RemoteCtxConfig
    }
}

// 获取配置
function getConfig(): string {
    const config = window.__REMOTE_CTX_CONFIG__
    if (config && config.hostUrl) {
        return config.hostUrl
    }
    return "ws://localhost:16633"
}

// 主逻辑
async function main() {
    const hostUrl = getConfig()

    // 清理全局配置 (可选)
    // delete window.__REMOTE_CTX_CONFIG__;

    console.log(`[RemoteCtx] Initializing Host connection to ${hostUrl}...`)

    try {
        const host = new RemoteCtxHost({
            url: hostUrl,
        })

        // 默认暴露 window
        host.expose({
            window,
        })

        console.log("[RemoteCtx] Host initialized and exposing `window`.")

        // 暴露给全局以便调试
        ;(window as any).__remoteCtxHost = host
    } catch (error) {
        console.error("[RemoteCtx] Failed to initialize host:", error)
    }
}

main()
