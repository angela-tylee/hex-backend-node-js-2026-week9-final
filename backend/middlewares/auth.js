const { pool } = require('../db/pool')
const { verifyToken } = require('../utils/jwt')

/**
 * 驗證 Authorization: Bearer <token>。
 * 通過後把使用者資料掛在 req.user（含 id / name / email / role）。
 * 「請先登入」是四句固定錯誤訊息之一，不可更動。
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'failed', message: '請先登入' })
    }

    const token = header.slice(7).trim()
    if (!token) {
      return res.status(401).json({ status: 'failed', message: '請先登入' })
    }

    let payload
    try {
      payload = verifyToken(token)
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ status: 'failed', message: 'Token 已過期' })
      }
      return res.status(401).json({ status: 'failed', message: '無效的 token' })
    }

    const { rows } = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [payload.id]
    )
    if (rows.length === 0) {
      return res.status(401).json({ status: 'failed', message: '無效的 token' })
    }

    req.user = rows[0]
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * 需接在 authenticate 之後：確認登入者已是教練（role 為 COACH）。
 * 依 Swagger 規格，未成為教練時回 401「使用者尚未成為教練」（不是 403）。
 */
function requireCoach(req, res, next) {
  if (!req.user || req.user.role !== 'COACH') {
    return res.status(401).json({ status: 'failed', message: '使用者尚未成為教練' })
  }
  next()
}

module.exports = { authenticate, requireCoach }
