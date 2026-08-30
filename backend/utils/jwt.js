const jwt = require('jsonwebtoken')
const config = require('../config')

/** 簽發 JWT，payload 至少含 { id, role }，exp 由 expiresIn 自動帶上 */
function signToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn })
}

/** 驗證並解出 payload，失敗會 throw（TokenExpiredError / JsonWebTokenError） */
function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret)
}

module.exports = { signToken, verifyToken }
