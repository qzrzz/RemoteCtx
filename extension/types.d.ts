// Minimal chrome type definitions to avoid install @types/chrome
declare namespace chrome {
    namespace storage {
        interface StorageArea {
            get(keys: string | string[], callback: (result: { [key: string]: any }) => void): void
            set(items: { [key: string]: any }, callback?: () => void): void
        }
        const local: StorageArea
    }

    namespace runtime {
        function getURL(path: string): string
    }

    namespace tabs {
        interface Tab {
            url?: string
            id?: number
        }
        function query(queryInfo: { active: boolean; currentWindow: boolean }, callback: (tabs: Tab[]) => void): void
        function reload(tabId: number, reloadProperties?: any, callback?: () => void): void
    }

    namespace scripting {
        function executeScript(injection: { target: { tabId: number }; func?: Function; args?: any[] }): void
    }
}

// Make files modules to avoid global scope pollution
export {}
