const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** 非空字串（不可為空字串或全空白） */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/** 0 以上的整數（數字型別，不接受字串、負數、小數） */
function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

module.exports = { isUuid, isNonEmptyString, isNonNegativeInteger }
