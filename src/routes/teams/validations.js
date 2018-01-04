const { isEmpty } = require('lodash')
const { isBase64, isMongoId } = require('validator')

module.exports = {
  validateCreateTeam(data) {
    const errors = {}

    if (data.avatar) {
      if (typeof data.avatar !== 'string') {
        errors.avatar = 'Should be a string'
      } else if (!isBase64(data.avatar.split(',')[1])) {
        errors.avatar = 'Should be a valid base 64 string'
      }
    }

    if (data.description && typeof data.description !== 'string') {
      errors.description = 'Should be a string'
    }

    if (!data.name) {
      errors.name = 'Is required'
    } else if (typeof data.name !== 'string') {
      errors.name = 'Should be a string'
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateEditTeam(data) {
    const errors = {}

    if (data.managers) {
      if (!Array.isArray(data.managers)) {
        errors.managers = 'Should be an array of users Ids'
      } else if (data.managers.length > 0) {
        data.managers.forEach(m => {
          if (typeof m !== 'string') {
            errors.managers = `${m} should be a string`
          } else {
            if (m && m.startsWith('-')) {
              m = m.substring(1)
            }

            if (!m || !isMongoId(m)) {
              errors.managers = `${m} should be an user Id`
            }
          }
        })
      }
    }

    if (data.members) {
      if (!Array.isArray(data.members)) {
        errors.members = 'Should be an array of users Ids'
      } else if (data.members.length > 0) {
        data.members.forEach(m => {
          if (!m) {
            errors.members = `${m} should not be null`
          } else if (typeof m !== 'string') {
            errors.members = `${m} should be a string`
          } else if (!m.startsWith('-')) {
            errors.members = `${m} should start with -`
          } else if (!isMongoId(m.substring(1))) {
            errors.members = `${m} should be an user Id`
          }
        })
      }
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateListTeams(queryParams) {
    const errors = {}

    if (queryParams.managers) {
      const managers = [...new Set(queryParams.managers.split(','))]

      if (managers.length === 0) {
        errors.managers = 'Should have at least one user id'
      } else {
        managers.forEach(m => {
          if (!m || !isMongoId(m)) {
            errors.managers = `${m} should be an user id`
          }
        })
      }
    }

    if (queryParams.members) {
      const members = [...new Set(queryParams.members.split(','))]

      if (members.length === 0) {
        errors.members = 'Should have at least one user Id'
      } else {
        members.forEach(m => {
          if (!m || !isMongoId(m)) {
            errors.members = `${m} should be an user Id`
          }
        })
      }
    }

    return { errors, isValid: isEmpty(errors) }
  }
}
