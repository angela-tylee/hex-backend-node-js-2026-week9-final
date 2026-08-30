const path = require('path')

require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

function required(key) {
  const value = process.env[key]
  if (value === undefined || value === '') {
    throw new Error(`缺少必要的環境變數：${key}（請對照專案根目錄的 .env.example 設定 backend/.env）`)
  }
  return value
}

const config = {
  port: Number(process.env.PORT || 8080),
  db: {
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT || 5432),
    user: required('DB_USERNAME'),
    password: required('DB_PASSWORD'),
    database: required('DB_DATABASE'),
    ssl: process.env.DB_ENABLE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_DAY || '30d',
  },
}

module.exports = config
