const express = require('express')

const { pool } = require('../db/pool')

const router = express.Router()

// GET /api/courses：全站「進行中」的課程（start_at <= now < end_at）
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT co.id, co.name, co.description, co.start_at, co.end_at,
              co.max_participants, u.name AS coach_name, s.name AS skill_name
         FROM course co
         JOIN users u ON u.id = co.user_id
         JOIN skill s ON s.id = co.skill_id
        WHERE co.start_at <= now() AND now() < co.end_at
        ORDER BY co.start_at ASC`
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
