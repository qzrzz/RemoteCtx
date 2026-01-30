import { RemoteCtxHost } from "../src/index"

// Parse port from args
const port = parseInt(process.argv[2], 10)
if (!port) {
    console.error("No port provided")
    process.exit(1)
}

let hostEnv = {
    title: "Remote World",
    num: 0,
    calc: (a: number, b: number) => a + b,
    nested: {
        flag: true,
        echo: (msg: string) => msg,
    },
    asyncFn: async (x: number) => {
        await new Promise((r) => setTimeout(r, 10))
        return x * 2
    },

    _getter_value: 0,

    get getter() {
        return this._getter_value
    },
    set getter(val) {
        this._getter_value = val
    },

    get o1() {
        return {
            t1: 1,
        }
    },

    get o2() {
        return {
            get z1() {
                return { v: 1 }
            },
        }
    },
}

Object.defineProperty(hostEnv, "o3", {
    get() {
        let z1 = Object.defineProperty(
            {
                a: new A(),
            },
            "z1",
            {
                get() {
                    return { v: 1 }
                },
                enumerable: false,
            },
        )

        return z1
    },
    enumerable: false,
})

class Base {
    get name() {
        return "name1"
    }
}

class A extends Base {
    age: number = 1
}

const remoteHost = new RemoteCtxHost({
    url: `ws://localhost:${port}`,
})
remoteHost.expose(hostEnv)

console.log("Host Process Started on " + port)

// Keep alive
setInterval(() => {}, 1000)
