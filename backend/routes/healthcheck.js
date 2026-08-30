const express = require('express')
const { pool } = require('../db/pool')

const router = express.Router()

// M0：確認後端服務啟動。資料庫就緒才回 200，否則回 503。
router.get('/healthcheck', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.status(200).type('text/plain').send('OK')
  } catch (err) {
    res.status(503).type('text/plain').send('database not ready')
  }
})

module.exports = router
