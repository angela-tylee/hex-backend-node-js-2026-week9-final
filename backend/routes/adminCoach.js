const express = require('express')

const { pool } = require('../db/pool')
const { authenticate, requireCoach } = require('../middlewares/auth')
const {
  isUuid,
  isNonEmptyString,
  isNonNegativeInteger,
  isHttpsUrl,
} = require('../utils/validators')

const router = express.Router()

const FIELD_ERROR = '欄位未填寫正確'

/** 取出某教練綁定的技能 id 清單（uuid 字串陣列，未設定時為空陣列） */
async function getSkillIds(coachId) {
  const { rows } = await pool.query(
    `SELECT cs.skill_id
       FROM coach_skill cs
       JOIN skill s ON s.id = cs.skill_id
      WHERE cs.coach_id = $1
      ORDER BY s.created_at ASC`,
    [coachId]
  )
  return rows.map((r) => r.skill_id)
}

/** 驗證開課／改課共用的課程欄位，合法回 null，不合法回錯誤訊息 */
function validateCourseBody(body) {
  const {
    skill_id: skillId,
    name,
    description,
    start_at: startAt,
    end_at: endAt,
    max_participants: maxParticipants,
    meeting_url: meetingUrl,
  } = body

  if (
    !isUuid(skillId) ||
    !isNonEmptyString(name) ||
    !isNonEmptyString(description) ||
    !isNonEmptyString(startAt) ||
    !isNonEmptyString(endAt) ||
    !isNonNegativeInteger(maxParticipants) ||
    !isHttpsUrl(meetingUrl)
  ) {
    return FIELD_ERROR
  }
  if (Number.isNaN(Date.parse(startAt)) || Number.isNaN(Date.parse(endAt))) {
    return FIELD_ERROR
  }
  return null
}

function serializeCourse(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    skill_id: row.skill_id,
    name: row.name,
    description: row.description,
    start_at: row.start_at,
    end_at: row.end_at,
    max_participants: row.max_participants,
    meeting_url: row.meeting_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ============================================================
// 教練個人資料
// ============================================================

// GET /api/admin/coaches：教練查看自己的後台資料（含技能清單）
router.get('/', authenticate, requireCoach, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, experience_years, description, profile_image_url
         FROM coach WHERE user_id = $1`,
      [req.user.id]
    )
    if (rows.length === 0) {
      return res.status(404).json({ status: 'failed', message: '找不到教練資料' })
    }
    const coach = rows[0]
    res.status(200).json({
      status: 'success',
      data: {
        id: coach.id,
        experience_years: coach.experience_years,
        description: coach.description,
        profile_image_url: coach.profile_image_url,
        skill_ids: await getSkillIds(coach.id),
      },
    })
  } catch (err) {
    next(err)
  }
})

// PUT /api/admin/coaches：教練更新自己的後台資料（含整批更換技能）
router.put('/', authenticate, requireCoach, async (req, res, next) => {
  const client = await pool.connect()
  try {
    const {
      experience_years: experienceYears,
      description,
      profile_image_url: profileImageUrl,
      skill_ids: skillIds,
    } = req.body

    if (
      !isNonNegativeInteger(experienceYears) ||
      !isNonEmptyString(description) ||
      !isHttpsUrl(profileImageUrl) ||
      !Array.isArray(skillIds) ||
      skillIds.length === 0 ||
      !skillIds.every((id) => isUuid(id))
    ) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const uniqueSkillIds = [...new Set(skillIds)]
    const skillCheck = await client.query(
      'SELECT id FROM skill WHERE id = ANY($1::uuid[])',
      [uniqueSkillIds]
    )
    if (skillCheck.rowCount !== uniqueSkillIds.length) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const coachRes = await client.query('SELECT id FROM coach WHERE user_id = $1', [
      req.user.id,
    ])
    if (coachRes.rowCount === 0) {
      return res.status(404).json({ status: 'failed', message: '找不到教練資料' })
    }
    const coachId = coachRes.rows[0].id

    await client.query('BEGIN')
    const { rows } = await client.query(
      `UPDATE coach
          SET experience_years = $1,
              description = $2,
              profile_image_url = $3,
              updated_at = now()
        WHERE id = $4
        RETURNING id, experience_years, description, profile_image_url`,
      [experienceYears, description.trim(), profileImageUrl.trim(), coachId]
    )
    await client.query('DELETE FROM coach_skill WHERE coach_id = $1', [coachId])
    await client.query(
      `INSERT INTO coach_skill (coach_id, skill_id)
       SELECT $1, UNNEST($2::uuid[])`,
      [coachId, uniqueSkillIds]
    )
    await client.query('COMMIT')

    const coach = rows[0]
    res.status(200).json({
      status: 'success',
      data: {
        id: coach.id,
        experience_years: coach.experience_years,
        description: coach.description,
        profile_image_url: coach.profile_image_url,
        skill_ids: await getSkillIds(coachId),
      },
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    next(err)
  } finally {
    client.release()
  }
})

// ============================================================
// 課程管理（開課教練 = token 裡的本人）
// ============================================================

// GET /api/admin/coaches/courses：教練本人開設的全部課程
router.get('/courses', authenticate, requireCoach, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, start_at, end_at, max_participants, meeting_url,
              CASE
                WHEN now() < start_at THEN '尚未開始'
                WHEN now() > end_at THEN '已結束'
                ELSE '進行中'
              END AS status
         FROM course
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [req.user.id]
    )
    res.status(200).json({
      status: 'success',
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        start_at: row.start_at,
        end_at: row.end_at,
        max_participants: row.max_participants,
        meeting_url: row.meeting_url,
        participants: 0,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/coaches/courses：教練開設新課程
router.post('/courses', authenticate, requireCoach, async (req, res, next) => {
  try {
    const invalid = validateCourseBody(req.body)
    if (invalid) {
      return res.status(400).json({ status: 'failed', message: invalid })
    }

    const {
      skill_id: skillId,
      name,
      description,
      start_at: startAt,
      end_at: endAt,
      max_participants: maxParticipants,
      meeting_url: meetingUrl,
    } = req.body

    const skillCheck = await pool.query('SELECT id FROM skill WHERE id = $1', [skillId])
    if (skillCheck.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const { rows } = await pool.query(
      `INSERT INTO course
         (user_id, skill_id, name, description, start_at, end_at, max_participants, meeting_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.user.id,
        skillId,
        name.trim(),
        description.trim(),
        startAt,
        endAt,
        maxParticipants,
        meetingUrl.trim(),
      ]
    )

    res.status(201).json({
      status: 'success',
      data: { course: serializeCourse(rows[0]) },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/coaches/courses/:courseId：單一課程詳情（owner-scoped，扁平物件）
router.get('/courses/:courseId', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params
    if (!isUuid(courseId)) {
      return res.status(400).json({ status: 'failed', message: '課程不存在' })
    }

    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.description, c.start_at, c.end_at,
              c.max_participants, c.meeting_url, c.skill_id, s.name AS skill_name
         FROM course c
         JOIN skill s ON s.id = c.skill_id
        WHERE c.id = $1 AND c.user_id = $2`,
      [courseId, req.user.id]
    )
    if (rows.length === 0) {
      return res.status(400).json({ status: 'failed', message: '課程不存在' })
    }

    const row = rows[0]
    res.status(200).json({
      status: 'success',
      data: {
        id: row.id,
        name: row.name,
        description: row.description,
        start_at: row.start_at,
        end_at: row.end_at,
        max_participants: row.max_participants,
        skill_name: row.skill_name,
        skill_id: row.skill_id,
        meeting_url: row.meeting_url,
      },
    })
  } catch (err) {
    next(err)
  }
})

// PUT /api/admin/coaches/courses/:courseId：更新單一課程（owner-scoped，先驗欄位再驗擁有者）
router.put('/courses/:courseId', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params

    const invalid = validateCourseBody(req.body)
    if (invalid) {
      return res.status(400).json({ status: 'failed', message: invalid })
    }
    if (!isUuid(courseId)) {
      return res.status(400).json({ status: 'failed', message: '課程不存在' })
    }

    const {
      skill_id: skillId,
      name,
      description,
      start_at: startAt,
      end_at: endAt,
      max_participants: maxParticipants,
      meeting_url: meetingUrl,
    } = req.body

    const owned = await pool.query(
      'SELECT id FROM course WHERE id = $1 AND user_id = $2',
      [courseId, req.user.id]
    )
    if (owned.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: '課程不存在' })
    }

    const skillCheck = await pool.query('SELECT id FROM skill WHERE id = $1', [skillId])
    if (skillCheck.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const { rows } = await pool.query(
      `UPDATE course
          SET skill_id = $1, name = $2, description = $3, start_at = $4,
              end_at = $5, max_participants = $6, meeting_url = $7, updated_at = now()
        WHERE id = $8 AND user_id = $9
        RETURNING *`,
      [
        skillId,
        name.trim(),
        description.trim(),
        startAt,
        endAt,
        maxParticipants,
        meetingUrl.trim(),
        courseId,
        req.user.id,
      ]
    )

    res.status(200).json({
      status: 'success',
      data: { course: serializeCourse(rows[0]) },
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// 升級教練（public 端點，課程簡化：不需登入）
// 需排在所有 /courses 路由之後，避免把 "courses" 當成 userId
// ============================================================

// POST /api/admin/coaches/:userId：把一般會員升級成教練
router.post('/:userId', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { userId } = req.params
    const {
      experience_years: experienceYears,
      description,
      profile_image_url: profileImageUrl,
    } = req.body

    if (!isNonNegativeInteger(experienceYears) || !isNonEmptyString(description)) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }
    const hasImage = profileImageUrl !== undefined && profileImageUrl !== null && profileImageUrl !== ''
    if (hasImage && !isHttpsUrl(profileImageUrl)) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }
    if (!isUuid(userId)) {
      return res.status(400).json({ status: 'failed', message: '使用者不存在' })
    }

    const userRes = await client.query(
      'SELECT id, name, role FROM users WHERE id = $1',
      [userId]
    )
    if (userRes.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: '使用者不存在' })
    }
    const user = userRes.rows[0]
    if (user.role === 'COACH') {
      return res.status(409).json({ status: 'failed', message: '使用者已經是教練' })
    }

    await client.query('BEGIN')
    const coachRes = await client.query(
      `INSERT INTO coach (user_id, experience_years, description, profile_image_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, experience_years, description, profile_image_url, created_at, updated_at`,
      [userId, experienceYears, description.trim(), hasImage ? profileImageUrl.trim() : null]
    )
    await client.query("UPDATE users SET role = 'COACH', updated_at = now() WHERE id = $1", [
      userId,
    ])
    await client.query('COMMIT')

    res.status(201).json({
      status: 'success',
      data: {
        user: { name: user.name, role: 'COACH' },
        coach: coachRes.rows[0],
      },
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    next(err)
  } finally {
    client.release()
  }
})

module.exports = router
