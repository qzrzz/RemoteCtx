import { RemoteCtx } from "../src"
import util from "node:util"

//  new RemoteCtxHost({url:"ws://localhost:6633"})
let remoteCtx = new RemoteCtx({ port: 6633 })

console.log(remoteCtx)

await remoteCtx.ready
let host = remoteCtx.host

console.log(host.figma.apiVersion)

console.log(host.figma.currentPage)

// console.log(show(host.figma.currentPage.selection))

function show(ob: any) {
    return util.inspect(ob, { showHidden: true, depth: null })
}
