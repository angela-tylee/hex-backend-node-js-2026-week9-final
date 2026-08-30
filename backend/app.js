const express = require('express')
const cors = require('cors')

const healthcheckRouter = require('./routes/healthcheck')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.use('/', healthcheckRouter)

// 404
app.use((req, res) => {
  res.status(404).json({ status: 'failed', message: '找不到此路由' })
})

// 錯誤處理
app.use((err, req, res, next) => {
  console.error(err)
  const statusCode = err.statusCode || 500
  res.status(statusCode).json({
    status: 'failed',
    message: err.message || '伺服器發生錯誤',
  })
})

module.exports = app
