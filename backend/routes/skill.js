const express = require('express')
const { pool } = require('../db/pool')
const { isUuid, isNonEmptyString } = require('../utils/validators')

const router = express.Router()

// GET /api/coaches/skill：取得全部技能（不需登入）
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name FROM skill ORDER BY created_at ASC'
    )
    res.status(200).json({ status: 'success', data: rows })
  } catch (err) {
    next(err)
  }
})

// POST /api/coaches/skill：新增技能（不需登入），名稱不可重複
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body

    if (!isNonEmptyString(name)) {
      return res.status(400).json({ status: 'failed', message: '欄位未填寫正確' })
    }

    const trimmed = name.trim()
    const dup = await pool.query('SELECT id FROM skill WHERE name = $1', [trimmed])
    if (dup.rowCount > 0) {
      return res.status(409).json({ status: 'failed', message: '資料重複' })
    }

    const { rows } = await pool.query(
      'INSERT INTO skill (name) VALUES ($1) RETURNING id, name, created_at',
      [trimmed]
    )
    const skill = rows[0]
    res.status(200).json({
      status: 'success',
      data: { id: skill.id, name: skill.name, createdAt: skill.created_at },
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/coaches/skill/:skillId：依 id 刪除技能（不需登入）
router.delete('/:skillId', async (req, res, next) => {
  try {
    const { skillId } = req.params

    if (!isUuid(skillId)) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    const result = await pool.query('DELETE FROM skill WHERE id = $1', [skillId])
    if (result.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    res.status(200).json({ status: 'success', data: { raw: [], affected: result.rowCount } })
  } catch (err) {
    next(err)
  }
})

module.exports = router
