const http = require('http')

const app = require('../app')
const config = require('../config')
const { pool, waitForDatabase } = require('../db/pool')
const { ensureSchema } = require('../db/schema')

const port = config.port
const server = http.createServer(app)

async function start() {
  await waitForDatabase()
  await ensureSchema()
  console.log('[db] 資料庫已就緒，資料表已建立')

  server.listen(port)
  server.on('listening', () => {
    console.log(`[server] 後端已啟動，監聽 http://localhost:${port}`)
  })
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[server] port ${port} 已被占用，請先關閉占用的程式`)
    } else {
      console.error('[server] 啟動失敗', error)
    }
    process.exit(1)
  })
}

start().catch((error) => {
  console.error('[server] 無法啟動：', error.message)
  process.exit(1)
})

async function shutdown(signal) {
  console.log(`\n[server] 收到 ${signal}，正在關閉…`)
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
