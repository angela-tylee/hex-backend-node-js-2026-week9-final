const express = require('express')

const { pool } = require('../db/pool')
const { isUuid } = require('../utils/validators')

const router = express.Router()

const FIELD_ERROR = '欄位未填寫正確'
const COACH_NOT_FOUND = '找不到該教練'

/** 可轉成非負整數的字串（例如 "6"、"0"）；"test"、"-1"、"1.5"、空字串都不算 */
function parseNonNegativeInt(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  if (!/^\d+$/.test(value.trim())) return null
  return Number(value.trim())
}

// GET /api/coaches：教練分頁列表（公開，per 與 page 必填）
router.get('/', async (req, res, next) => {
  try {
    const per = parseNonNegativeInt(req.query.per)
    const page = parseNonNegativeInt(req.query.page)
    if (per === null || page === null) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const offset = Math.max(0, (page - 1) * per)
    const { rows } = await pool.query(
      `SELECT c.id, c.user_id, u.name
         FROM coach c
         JOIN users u ON u.id = c.user_id
        ORDER BY c.created_at ASC
        LIMIT $1 OFFSET $2`,
      [per, offset]
    )

    res.status(200).json({
      status: 'success',
      data: rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        name: row.name,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/coaches/:coachId：單一教練詳情（公開）
router.get('/:coachId', async (req, res, next) => {
  try {
    const { coachId } = req.params
    if (!isUuid(coachId)) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const { rows } = await pool.query(
      `SELECT c.id, c.user_id, c.experience_years, c.description,
              c.profile_image_url, c.created_at, c.updated_at,
              u.name AS user_name, u.role AS user_role
         FROM coach c
         JOIN users u ON u.id = c.user_id
        WHERE c.id = $1`,
      [coachId]
    )
    if (rows.length === 0) {
      return res.status(400).json({ status: 'failed', message: COACH_NOT_FOUND })
    }
    const row = rows[0]

    const { rows: skillRows } = await pool.query(
      `SELECT s.name
         FROM coach_skill cs
         JOIN skill s ON s.id = cs.skill_id
        WHERE cs.coach_id = $1
        ORDER BY s.created_at ASC`,
      [coachId]
    )

    res.status(200).json({
      status: 'success',
      data: {
        user: { name: row.user_name, role: row.user_role },
        coach: {
          id: row.id,
          user_id: row.user_id,
          experience_years: row.experience_years,
          description: row.description,
          profile_image_url: row.profile_image_url,
          created_at: row.created_at,
          updated_at: row.updated_at,
          skills: skillRows.map((s) => s.name),
        },
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/coaches/:coachId/courses：指定教練「未結束」的課程（end_at > now）
router.get('/:coachId/courses', async (req, res, next) => {
  try {
    const { coachId } = req.params
    if (!isUuid(coachId)) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const coachRes = await pool.query('SELECT id FROM coach WHERE id = $1', [coachId])
    if (coachRes.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: COACH_NOT_FOUND })
    }

    const { rows } = await pool.query(
      `SELECT co.id, co.name, co.description, co.start_at, co.end_at,
              co.max_participants, u.name AS coach_name, s.name AS skill_name
         FROM course co
         JOIN coach c ON c.user_id = co.user_id
         JOIN users u ON u.id = co.user_id
         JOIN skill s ON s.id = co.skill_id
        WHERE c.id = $1 AND co.end_at > now()
        ORDER BY co.start_at ASC`,
      [coachId]
    )

    res.status(200).json({
      status: 'success',
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        start_at: row.start_at,
        end_at: row.end_at,
        max_participants: row.max_participants,
        coach_name: row.coach_name,
        skill_name: row.skill_name,
      })),
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
