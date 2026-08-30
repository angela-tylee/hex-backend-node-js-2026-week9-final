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

  // M3：教練個人檔案（一位使用者最多一筆）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coach (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      experience_years integer NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
      description text NOT NULL DEFAULT '',
      profile_image_url text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `)

  // M3：教練 ↔ 技能（多對多，PUT 個人資料時整批覆蓋）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coach_skill (
      coach_id uuid NOT NULL REFERENCES coach(id) ON DELETE CASCADE,
      skill_id uuid NOT NULL REFERENCES skill(id) ON DELETE CASCADE,
      PRIMARY KEY (coach_id, skill_id)
    );
  `)

  // M3：課程（user_id 為開課教練的使用者 id）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS course (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      skill_id uuid NOT NULL REFERENCES skill(id),
      name varchar(100) NOT NULL,
      description text NOT NULL,
      start_at timestamptz NOT NULL,
      end_at timestamptz NOT NULL,
      max_participants integer NOT NULL CHECK (max_participants >= 0),
      meeting_url text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `)

  // M5：會員購買方案的紀錄（一筆一次購買，堂數與金額於購買當下由方案帶入）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS credit_purchase (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credit_package_id uuid NOT NULL REFERENCES credit_package(id),
      purchased_credits integer NOT NULL CHECK (purchased_credits >= 0),
      price_paid numeric(10, 2) NOT NULL CHECK (price_paid >= 0),
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `)

  // M5：課程報名（軟刪除：取消時只標記 cancelled_at，紀錄保留）
  // 剩餘堂數沒有欄位，靠「Σ購買堂數 − 未取消報名數」即時計算
  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_booking (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id uuid NOT NULL REFERENCES course(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      cancelled_at timestamptz
    );
  `)
}

module.exports = { ensureSchema }
