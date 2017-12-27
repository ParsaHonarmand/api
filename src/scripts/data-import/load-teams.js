const aws = require('aws-sdk')
const jimp = require('jimp')
const mongoose = require('mongoose')
const randomstring = require('randomstring')

require('dotenv').config({ path: '../../../.env' })

const logger = require('../../helpers/logger')
const { teamSchema } = require('../../models/team')

const oldTeamSchema = require('./old-schemas/team')

mongoose.Promise = global.Promise

const s3 = new aws.S3()

async function closeConnections(db, oldDb) {
  try {
    await oldDb.close()
  } catch (error) {
    logger.error(error)
    process.exit(0)
  }

  try {
    await db.close()
  } catch (error) {
    logger.error(error)
    process.exit(0)
  }

  process.exit(0)
}

const uri = process.env.MONGODB_URI
const options = {
  useMongoClient: true,
  socketTimeoutMS: 0,
  keepAlive: 2000
}
const db = mongoose.createConnection(uri, options)

db.on('connected', async () => {
  logger.info('Connection to DB established successfully')

  const oldUri = process.env.OLD_DB_URI
  const oldDb = mongoose.createConnection(oldUri, options)

  oldDb.on('connected', async () => {
    logger.info('Connection to old DB established successfully')

    const OldTeam = oldDb.model('teams', oldTeamSchema)

    let totalOldTeams
    try {
      totalOldTeams = await OldTeam.count()
    } catch (error) {
      logger.info('Old teams failed to be count')
      logger.error(error)
      await closeConnections(db, oldDb)
    }

    logger.info(`Total old teams: ${totalOldTeams}`)

    console.time('createTeams')

    let page = 0
    const pageLimit = 100
    let i = 0
    do {
      let oldTeams
      try {
        oldTeams = await OldTeam.find({})
          .skip(page * pageLimit)
          .limit(pageLimit)
      } catch (error) {
        logger.info('Old teams failed to be found')
        logger.error(error)
        await closeConnections(db, oldDb)
      }

      const Team = db.model('Team', teamSchema)

      const createTeams = []
      const uploadTeamsAvatars = []
      for (let oldTeam of oldTeams) {
        if (oldTeam.name) {
          const members = oldTeam.members.filter(
            m => m.toString() !== oldTeam.creator.toString()
          )
          const teamData = {
            _id: oldTeam.id,
            createdAt: oldTeam.created_at,
            events: oldTeam.events,
            managers: [oldTeam.creator],
            members: members,
            name:
              oldTeam.name.length > 35
                ? oldTeam.name.substring(0, 35)
                : oldTeam.name,
            updatedAt: oldTeam.updated_at
          }

          if (oldTeam.description && oldTeam.description.length <= 300) {
            teamData.description = oldTeam.description
          }

          if (oldTeam.image && !oldTeam.image.includes('icon_team.png')) {
            let avatarImage
            try {
              avatarImage = await jimp.read(encodeURI(oldTeam.image))
            } catch (err) {
              logger.info('Old team avatar image failed to be read')
              logger.error(err)
              await closeConnections(db, oldDb)
            }

            if (avatarImage) {
              const avatarExtension = avatarImage.getExtension()
              const avatarFileName = `${Date.now()}${randomstring.generate({
                length: 5,
                capitalization: 'lowercase'
              })}.${avatarExtension}`
              teamData.avatar = `https://s3.amazonaws.com/${process.env
                .AWS_S3_BUCKET}/teams/avatars/${avatarFileName}`

              if (
                avatarExtension === 'png' ||
                avatarExtension === 'jpeg' ||
                avatarExtension === 'jpg' ||
                avatarExtension === 'bmp'
              ) {
                avatarImage
                  .cover(400, 400)
                  .quality(85)
                  .getBuffer(
                    avatarImage.getMIME(),
                    async (err, avatarBuffer) => {
                      if (err) {
                        logger.info('Old team avatar buffer failed to be read')
                        logger.error(err)
                        await closeConnections(db, oldDb)
                      }

                      uploadTeamsAvatars.push(
                        s3
                          .putObject({
                            ACL: 'public-read',
                            Body: avatarBuffer,
                            Bucket: process.env.AWS_S3_BUCKET,
                            ContentType: avatarImage.getMIME(),
                            Key: `teams/avatars/${avatarFileName}`
                          })
                          .promise()
                      )
                    }
                  )
              }
            }
          }

          createTeams.push(Team.create(teamData))
        }
      }

      try {
        await Promise.all([...createTeams, ...uploadTeamsAvatars])
      } catch (error) {
        logger.info(
          `Teams failed to be created.\nData: ${JSON.stringify({
            page,
            i
          })}`
        )
        logger.error(error)
        await closeConnections(db, oldDb)
      }

      page = page + 1
      i = i + oldTeams.length
      logger.info(i)
    } while (i < totalOldTeams)

    console.timeEnd('createTeams')

    await closeConnections(db, oldDb)
  })

  oldDb.on('error', err => {
    logger.error('Connection to old DB failed ' + err)
    process.exit(0)
  })

  oldDb.on('disconnected', () => {
    logger.info('Connection from old DB closed')
  })
})

db.on('error', err => {
  logger.error('Connection to DB failed ' + err)
  process.exit(0)
})

db.on('disconnected', () => {
  logger.info('Connection from DB closed')
})
