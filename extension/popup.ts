/**
 * RemoteCtx Host Extension Popup Logic
 *
 * @description 处理弹出面板的设置保存和加载逻辑
 */

interface Settings {
    hostUrl: string
    targetSites: string[]
}

const DEFAULT_SETTINGS: Settings = {
    hostUrl: "ws://localhost:16633",
    targetSites: ["localhost"],
}

document.addEventListener("DOMContentLoaded", () => {
    const hostUrlInput = document.getElementById("hostUrl") as HTMLInputElement
    const targetSitesInput = document.getElementById("targetSites") as HTMLTextAreaElement
    const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement
    const statusDiv = document.getElementById("status") as HTMLDivElement

    // 加载设置
    chrome.storage.local.get(["hostUrl", "targetSites"], (result) => {
        hostUrlInput.value = result.hostUrl || DEFAULT_SETTINGS.hostUrl
        const sites = result.targetSites || DEFAULT_SETTINGS.targetSites
        targetSitesInput.value = sites.join("\n")
    })

    // 保存设置
    const saveSettings = (callback?: () => void) => {
        const hostUrl = hostUrlInput.value.trim()
        const targetSites = targetSitesInput.value
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)

        chrome.storage.local.set(
            {
                hostUrl,
                targetSites,
            },
            () => {
                // 显示保存成功消息
                statusDiv.textContent = "设置已保存"
                statusDiv.className = "success"

                setTimeout(() => {
                    statusDiv.textContent = ""
                    statusDiv.className = ""
                }, 2000)

                if (callback) callback()
            },
        )
    }

    saveBtn.addEventListener("click", () => saveSettings())

    // 添加当前网站逻辑
    const addCurrentSiteBtn = document.getElementById("addCurrentSiteBtn") as HTMLButtonElement
    addCurrentSiteBtn.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0 || !tabs[0].url) return

            try {
                const url = new URL(tabs[0].url)
                const hostname = url.hostname // e.g., "example.com"

                // 读取当前输入框的值，或者从 storage 读取？使用输入框的值更符合用户即时修改
                const currentList = targetSitesInput.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)

                if (!currentList.includes(hostname)) {
                    currentList.push(hostname)
                    targetSitesInput.value = currentList.join("\n")

                    // 自动保存
                    saveSettings(() => {
                        // 提示重新加载
                        if (confirm(`已添加 ${hostname}。需要刷新页面以生效吗？`)) {
                            if (tabs[0].id) {
                                chrome.tabs.reload(tabs[0].id)
                                window.close() // 刷新后关闭弹窗
                            }
                        }
                    })
                } else {
                    statusDiv.textContent = "该域名已在列表中"
                    statusDiv.className = "error"
                }
            } catch (e) {
                console.error("Invalid URL:", tabs[0].url)
            }
        })
    })
})

export {}
