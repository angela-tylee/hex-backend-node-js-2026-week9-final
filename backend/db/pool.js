const { Pool } = require('pg')
const config = require('../config')

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: config.db.ssl,
})

pool.on('error', (err) => {
  console.error('[db] 連線池發生非預期錯誤', err)
})

/**
 * 等待資料庫就緒（容器剛啟動時 Postgres 可能還沒接受連線）。
 * 每次間隔重試，直到成功或超過重試上限。
 */
async function waitForDatabase({ retries = 30, delayMs = 1000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query('SELECT 1')
      return
    } catch (err) {
      if (attempt === retries) throw err
      console.log(`[db] 資料庫尚未就緒，${delayMs}ms 後重試（${attempt}/${retries}）`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

module.exports = { pool, waitForDatabase }
