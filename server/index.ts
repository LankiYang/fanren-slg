import 'dotenv/config'
import { startApiServer } from './app'

const server = await startApiServer()
const address = server.address()
const port = typeof address === 'object' && address ? address.port : 5181
console.log(`多人服务已启动：http://${process.env.FANREN_API_HOST || '127.0.0.1'}:${port}`)

const close = () => server.close(() => process.exit(0))
process.once('SIGINT', close)
process.once('SIGTERM', close)
