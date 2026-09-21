import 'dotenv/config'
import { createServer as createViteServer } from 'vite'
import { startApiServer } from './app'

const api = await startApiServer()
const vite = await createViteServer({ server: { host: '127.0.0.1', port: 5180 } })
await vite.listen()
vite.printUrls()
const apiAddress = api.address()
const apiPort = typeof apiAddress === 'object' && apiAddress ? apiAddress.port : Number(process.env.FANREN_API_PORT || 5181)
console.log(`多人 API：http://127.0.0.1:${apiPort}/api/health`)

const close = async () => {
  await vite.close()
  await new Promise<void>(resolve => api.close(() => resolve()))
  process.exit(0)
}
process.once('SIGINT', close)
process.once('SIGTERM', close)
