const { pool } = require('./pool')

/**
 * 啟動時自動建表。
 * M0 階段還沒有任何業務資料表，之後 M1～M6 會在這裡補上對應的 CREATE TABLE。
 * 全部使用 IF NOT EXISTS，重複啟動不會出錯。
 */
async function ensureSchema() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  `)
}

module.exports = { ensureSchema }
