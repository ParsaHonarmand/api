const moment = require('moment')

const { Event } = require('../../models/event')
const logger = require('../../helpers/logger')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  const eventId = req.params.eventId

  let event
  try {
    event = await Event.findOne({ _id: eventId })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Event not found' })
    }

    logger.error(`Event ${eventId} failed to be found at leave-event`)
    return next(err)
  }

  if (!event) {
    return res.status(404).json({ general: 'Event not found' })
  }

  const endDate = moment(event.endDate).utc()
  const today = moment.utc()

  if (event.managers.find(m => m.toString() === req.user.id)) {
    if (endDate.isBefore(today) && event.reviews > 0) {
      return res.status(423).json({
        general:
          'You cannot leave this because it already ended and has one or more reviews'
      })
    }

    event.managers = event.managers.filter(m => m.toString() !== req.user.id)
    event.participants = event.participants.filter(
      p => p.toString() !== req.user.id
    )

    if (event.managers.length === 0) {
      return res.status(400).json({
        general: 'You cannot leave this because there will not be more managers'
      })
    }
  } else if (event.participants.find(p => p.toString() === req.user.id)) {
    if (endDate.isBefore(today) && event.reviews > 0) {
      return res.status(423).json({
        general:
          'You cannot leave this because it already ended and has one or more reviews'
      })
    }

    event.participants = event.participants.filter(
      p => p.toString() !== req.user.id
    )
  } else {
    return res.status(400).json({ general: "You don't participate in this" })
  }

  event.updatedAt = today.toDate()

  try {
    await event.save()
  } catch (err) {
    logger.error(`Event ${event.id} failed to be updated at leave-event`)
    return next(err)
  }

  req.user.events = req.user.events.filter(e => e.toString() !== event.id)
  req.user.updatedAt = today.toDate()

  try {
    await req.user.save()
  } catch (err) {
    logger.error(`User ${req.user.id} failed to be updated at leave-event`)
    return next(err)
  }

  return res.status(200).json({ general: 'Success' })
}
