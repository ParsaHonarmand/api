const bodyParser = require('body-parser')
const cors = require('cors')
const express = require('express')
const helmet = require('helmet')
const morgan = require('morgan')

// Fill process.env with environment variables
require('dotenv').config()

const connectToDB = require('./helpers/db-connector')
const logger = require('./helpers/logger')
const routes = require('./routes')

function connectedToDB() {
  const app = express()

  // Middlewares
  app.use(cors())
  app.use(morgan('combined', { stream: logger.stream }))
  app.use(bodyParser.json())
  app.use(helmet())

  // Routes
  app.set('strict routing', true)
  app.use('/', routes)

  // Error handling
  app.use((req, res, _next) => res.status(404).json({ message: 'Not found' }))
  app.use((err, req, res, _next) => {
    if (err instanceof SyntaxError) {
      return res.status(400).json({ message: 'Invalid JSON format' })
    }

    logger.error(err.stack)
    return res.status(500).json({ message: 'Something went wrong' })
  })

  process.on('uncaughtException', err =>
    logger.error('Uncaught exception:\n', err)
  )
  process.on('unhandledRejection', err =>
    logger.error('Unhandled rejection:\n', err)
  )

  // App Initialization
  app.listen(8000, () => logger.info('Listening on port 8000'))
}

connectToDB(connectedToDB)