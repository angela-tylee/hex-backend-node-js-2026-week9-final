const express = require('express')
const bcrypt = require('bcryptjs')

const { pool } = require('../db/pool')
const { signToken } = require('../utils/jwt')
const { authenticate } = require('../middlewares/auth')
const {
  isNonEmptyString,
  isValidPassword,
  PASSWORD_RULE_MESSAGE,
} = require('../utils/validators')

const router = express.Router()

const SALT_ROUNDS = 10

// POST /api/users/signup：註冊新會員（role 固定 USER）
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body

    if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ status: 'failed', message: '欄位未填寫正確' })
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ status: 'failed', message: PASSWORD_RULE_MESSAGE })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const dup = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
    if (dup.rowCount > 0) {
      return res.status(409).json({ status: 'failed', message: 'Email 已被使用' })
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS)
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name',
      [name.trim(), normalizedEmail, hash]
    )

    res.status(201).json({
      status: 'success',
      data: { user: { id: rows[0].id, name: rows[0].name } },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/users/login：登入，簽發 JWT（payload 含 id / role / exp）
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ status: 'failed', message: '欄位未填寫正確' })
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ status: 'failed', message: PASSWORD_RULE_MESSAGE })
    }

    const { rows } = await pool.query(
      'SELECT id, name, password, role FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    )

    const user = rows[0]
    const match = user ? await bcrypt.compare(password, user.password) : false
    if (!match) {
      return res.status(400).json({ status: 'failed', message: '使用者不存在或密碼輸入錯誤' })
    }

    const token = signToken({ id: user.id, role: user.role })
    res.status(201).json({
      status: 'success',
      data: { token, user: { name: user.name } },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/users/profile：取得本人的 name 與 email
router.get('/profile', authenticate, (req, res) => {
  res.status(200).json({
    status: 'success',
    data: { user: { name: req.user.name, email: req.user.email } },
  })
})

// PUT /api/users/profile：更新本人的暱稱（不可與目前名稱相同）
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body

    if (!isNonEmptyString(name)) {
      return res.status(400).json({ status: 'failed', message: '欄位未填寫正確' })
    }

    const trimmed = name.trim()
    if (trimmed === req.user.name) {
      return res.status(400).json({ status: 'failed', message: '使用者名稱未變更' })
    }

    const result = await pool.query(
      'UPDATE users SET name = $1, updated_at = now() WHERE id = $2',
      [trimmed, req.user.id]
    )
    if (result.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: '更新使用者資料失敗' })
    }

    res.status(200).json({ status: 'success', data: { user: { name: trimmed } } })
  } catch (err) {
    next(err)
  }
})

// PUT /api/users/password：用舊密碼換新密碼
router.put('/password', authenticate, async (req, res, next) => {
  try {
    const {
      password,
      new_password: newPassword,
      confirm_new_password: confirmNewPassword,
    } = req.body

    if (
      !isNonEmptyString(password) ||
      !isNonEmptyString(newPassword) ||
      !isNonEmptyString(confirmNewPassword)
    ) {
      return res.status(400).json({ status: 'failed', message: '欄位未填寫正確' })
    }
    if (
      !isValidPassword(password) ||
      !isValidPassword(newPassword) ||
      !isValidPassword(confirmNewPassword)
    ) {
      return res.status(400).json({ status: 'failed', message: PASSWORD_RULE_MESSAGE })
    }
    if (password === newPassword) {
      return res.status(400).json({ status: 'failed', message: '新密碼不能與舊密碼相同' })
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ status: 'failed', message: '新密碼與驗證新密碼不一致' })
    }

    const { rows } = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id])
    const match = await bcrypt.compare(password, rows[0].password)
    if (!match) {
      return res.status(400).json({ status: 'failed', message: '密碼輸入錯誤' })
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS)
    await pool.query(
      'UPDATE users SET password = $1, updated_at = now() WHERE id = $2',
      [hash, req.user.id]
    )

    res.status(200).json({ status: 'success', data: null })
  } catch (err) {
    next(err)
  }
})

// GET /api/users/credit-package：本人的購買方案紀錄（M5），data 直接是陣列
router.get('/credit-package', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT cp.name,
              pur.purchased_credits,
              pur.price_paid,
              pur.created_at AS purchase_at
         FROM credit_purchase pur
         JOIN credit_package cp ON cp.id = pur.credit_package_id
        WHERE pur.user_id = $1
        ORDER BY pur.created_at DESC`,
      [req.user.id]
    )

    res.status(200).json({
      status: 'success',
      data: rows.map((row) => ({
        name: row.name,
        purchased_credits: Number(row.purchased_credits),
        price_paid: Number(row.price_paid),
        purchase_at: row.purchase_at,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/users/courses：本人的課表與剩餘堂數（M5）
router.get('/courses', authenticate, async (req, res, next) => {
  try {
    const purchaseRes = await pool.query(
      'SELECT COALESCE(SUM(purchased_credits), 0) AS total FROM credit_purchase WHERE user_id = $1',
      [req.user.id]
    )
    const usageRes = await pool.query(
      'SELECT COUNT(*) AS used FROM course_booking WHERE user_id = $1 AND cancelled_at IS NULL',
      [req.user.id]
    )
    const bookingRes = await pool.query(
      `SELECT b.course_id,
              c.name,
              c.start_at,
              c.end_at,
              c.meeting_url,
              u.name AS coach_name,
              b.cancelled_at
         FROM course_booking b
         JOIN course c ON c.id = b.course_id
         JOIN users u ON u.id = c.user_id
        WHERE b.user_id = $1
        ORDER BY c.start_at ASC`,
      [req.user.id]
    )

    const creditUsage = Number(usageRes.rows[0].used)
    const creditRemain = Number(purchaseRes.rows[0].total) - creditUsage

    res.status(200).json({
      status: 'success',
      data: {
        credit_remain: creditRemain,
        credit_usage: creditUsage,
        course_booking: bookingRes.rows.map((row) => ({
          course_id: row.course_id,
          name: row.name,
          start_at: row.start_at,
          end_at: row.end_at,
          meeting_url: row.meeting_url,
          coach_name: row.coach_name,
          cancelled_at: row.cancelled_at,
        })),
      },
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
