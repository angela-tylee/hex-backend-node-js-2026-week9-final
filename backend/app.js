const express = require('express')
const cors = require('cors')

const healthcheckRouter = require('./routes/healthcheck')
const skillRouter = require('./routes/skill')
const creditPackageRouter = require('./routes/creditPackage')
const userRouter = require('./routes/user')
const adminCoachRouter = require('./routes/adminCoach')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.use('/', healthcheckRouter)
// M1：種資料（技能與方案，皆為 public 管理端點）
// 注意：/api/coaches/skill 未來須排在 /api/coaches/:coachId（M4）之前
app.use('/api/coaches/skill', skillRouter)
app.use('/api/credit-package', creditPackageRouter)
// M2：會員系統（註冊、登入、個人資料、修改密碼）
app.use('/api/users', userRouter)
// M3：升級教練 + 教練後台（個人資料、課程管理）
app.use('/api/admin/coaches', adminCoachRouter)

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
