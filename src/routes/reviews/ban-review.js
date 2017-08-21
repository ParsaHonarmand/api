const moment = require('moment')

const logger = require('../../helpers/logger')
const Review = require('../../models/review')

module.exports = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden action' })
  }

  const reviewID = req.params.reviewID

  let review
  try {
    review = await Review.findOne({ _id: reviewID })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Review not found' })
    }

    logger.error(`Review ${reviewID} failed to be found at ban-review`)
    return next(err)
  }

  if (!review) {
    return res.status(404).json({ message: 'Review not found' })
  }

  review.isBanned = true
  review.updatedAt = moment.utc().toDate()

  try {
    await review.save()
  } catch (err) {
    logger.error(`Review ${review.id} failed to be updated at ban-review`)
    return next(err)
  }

  return res.status(200).json({ message: 'Success' })
}