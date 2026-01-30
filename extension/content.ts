/**
 * RemoteCtx Host Content Script
 *
 * @description 运行在页面上下文中，负责检查当前 URL 是否匹配并通过 injection 注入主脚本
 */

const DEFAULT_SETTINGS = {
    hostUrl: "ws://localhost:16633",
    targetSites: ["localhost"],
}

// 检查当前页面是否需要注入
function shouldInject(url: string, targetSites: string[]): boolean {
    return targetSites.some((site) => url.includes(site))
}

// 注入脚本
function injectScript(file: string, hostUrl: string) {
    const container = document.head || document.documentElement

    // 1. 先注入配置
    const configScript = document.createElement("script")
    configScript.textContent = `window.__REMOTE_CTX_CONFIG__ = { hostUrl: "${hostUrl}" };`
    container.insertBefore(configScript, container.children[0])
    configScript.remove() // 执行完立即移除

    // 2. 再注入主脚本
    const script = document.createElement("script")
    script.setAttribute("type", "module")
    script.setAttribute("src", chrome.runtime.getURL(file))

    container.insertBefore(script, container.children[0])

    // 注入后移除标签
    script.onload = () => {
        script.remove()
    }
    script.onerror = () => {
        console.error("[RemoteCtx]Failed to load injected script:", file)
    }
}

// 主逻辑
chrome.storage.local.get(["hostUrl", "targetSites"], (result) => {
    const hostUrl = result.hostUrl || DEFAULT_SETTINGS.hostUrl
    const targetSites = result.targetSites || DEFAULT_SETTINGS.targetSites

    if (shouldInject(window.location.href, targetSites)) {
        console.log(`[RemoteCtx] Injecting host into ${window.location.href} (Host: ${hostUrl})`)
        injectScript("injected.js", hostUrl)
    }
})

export {}
