const { pool } = require('./pool')

/**
 * 啟動時自動建表。
 * 全部使用 IF NOT EXISTS，重複啟動不會出錯。
 * M1～M6 會在這裡逐步補上對應的資料表。
 */
async function ensureSchema() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`)

  // M1：教練技能
  await pool.query(`
    CREATE TABLE IF NOT EXISTS skill (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name varchar(50) NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `)

  // M1：購買方案（堂數包）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS credit_package (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name varchar(50) NOT NULL UNIQUE,
      credit_amount integer NOT NULL CHECK (credit_amount >= 0),
      price numeric(10, 2) NOT NULL CHECK (price >= 0),
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `)

  // M2：會員（role 預設 USER，M3 升級教練時改成 COACH）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name varchar(50) NOT NULL,
      email varchar(320) NOT NULL UNIQUE,
      password varchar(72) NOT NULL,
      role varchar(20) NOT NULL DEFAULT 'USER',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `)
}

module.exports = { ensureSchema }
