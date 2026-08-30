const express = require('express')
const { pool } = require('../db/pool')

const router = express.Router()

// M0：確認後端服務啟動。資料庫就緒才回 200，否則回 503。
router.get('/healthcheck', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.status(200).json({ status: 'success', message: 'ok' })
  } catch (err) {
    res.status(503).json({ status: 'failed', message: '資料庫尚未就緒' })
  }
})

module.exports = router
