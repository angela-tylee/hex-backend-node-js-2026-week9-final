const express = require('express')
const { pool } = require('../db/pool')
const { authenticate } = require('../middlewares/auth')
const { isUuid, isNonEmptyString, isNonNegativeInteger } = require('../utils/validators')

const router = express.Router()

// GET /api/credit-package：取得全部購買方案（不需登入）
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, credit_amount, price FROM credit_package ORDER BY created_at ASC'
    )
    res.status(200).json({ status: 'success', data: rows })
  } catch (err) {
    next(err)
  }
})

// POST /api/credit-package：新增方案（不需登入），名稱不可重複
router.post('/', async (req, res, next) => {
  try {
    const { name, credit_amount: creditAmount, price } = req.body

    if (
      !isNonEmptyString(name) ||
      !isNonNegativeInteger(creditAmount) ||
      !isNonNegativeInteger(price)
    ) {
      return res.status(400).json({ status: 'failed', message: '欄位未填寫正確' })
    }

    const trimmed = name.trim()
    const dup = await pool.query('SELECT id FROM credit_package WHERE name = $1', [trimmed])
    if (dup.rowCount > 0) {
      return res.status(409).json({ status: 'failed', message: '資料重複' })
    }

    const { rows } = await pool.query(
      `INSERT INTO credit_package (name, credit_amount, price)
       VALUES ($1, $2, $3)
       RETURNING id, name, credit_amount, price, created_at`,
      [trimmed, creditAmount, price]
    )
    const pkg = rows[0]
    res.status(200).json({
      status: 'success',
      data: {
        id: pkg.id,
        name: pkg.name,
        credit_amount: pkg.credit_amount,
        price: pkg.price,
        createdAt: pkg.created_at,
      },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/credit-package/:creditPackageId：登入會員購買指定方案（M5）
// body 完全留空，堂數與金額由後端依方案帶入
router.post('/:creditPackageId', authenticate, async (req, res, next) => {
  try {
    const { creditPackageId } = req.params

    if (!isUuid(creditPackageId)) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    const { rows } = await pool.query(
      'SELECT credit_amount, price FROM credit_package WHERE id = $1',
      [creditPackageId]
    )
    if (rows.length === 0) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    const pkg = rows[0]
    await pool.query(
      `INSERT INTO credit_purchase (user_id, credit_package_id, purchased_credits, price_paid)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, creditPackageId, pkg.credit_amount, pkg.price]
    )

    res.status(200).json({ status: 'success', data: null })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/credit-package/:creditPackageId：依 id 刪除方案（不需登入）
router.delete('/:creditPackageId', async (req, res, next) => {
  try {
    const { creditPackageId } = req.params

    if (!isUuid(creditPackageId)) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    const result = await pool.query('DELETE FROM credit_package WHERE id = $1', [
      creditPackageId,
    ])
    if (result.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    res.status(200).json({ status: 'success', data: { raw: [], affected: result.rowCount } })
  } catch (err) {
    next(err)
  }
})

module.exports = router
