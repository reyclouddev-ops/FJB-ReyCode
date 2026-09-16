const connectDB = require('../db')
const User = require('../../models/User')
const ActivityLog = require('../../models/ActivityLog')

const ROBOT_ID = 'g42d6t'
const ROBOT_USERNAME = 'robot-security'
const ROBOT_DISPLAY_NAME = 'Robot Security'

async function getOrCreateRobot() {
  let robot =
    await User.findOne({
      username: ROBOT_USERNAME,
      systemAccount: true
    })

  if (!robot) {
    robot =
      await User.create({
        username: ROBOT_USERNAME,
        email: 'robot-security@system.fjb',
        password: 'SYSTEM_ACCOUNT_NO_LOGIN',
        avatar: '🤖',
        bio: 'Asisten Keamanan Forum FJB ReyCode',
        role: 'system',
        verified: true,
        resellerStatus: 'none',
        accountStatus: 'active',
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        registrationIp: null,
        ipHistory: [],
        systemAccount: true,
        lastLoginAt: null
      })
  }

  return robot
}

function formatRobot(robot) {
  return {
    id: robot._id,
    systemId: ROBOT_ID,
    username:
      robot.username,
    displayName:
      ROBOT_DISPLAY_NAME,
    avatar:
      robot.avatar,
    bio:
      robot.bio,
    role:
      robot.role,
    verified:
      robot.verified,
    systemAccount:
      robot.systemAccount
  }
}

function formatSecurityEvent(event) {
  const metadata =
    event.metadata || {}

  return {
    id:
      event._id,
    type:
      'security',
    action:
      event.action,
    targetType:
      event.targetType,
    targetId:
      event.targetId,
    status:
      metadata.suspensionType ===
        'permanent'
        ? 'permanent'
        : metadata.suspendedUntil
          ? 'temporary'
          : 'active',
    suspensionType:
      metadata.suspensionType ||
      null,
    suspendedUntil:
      metadata.suspendedUntil ||
      null,
    message:
      metadata.suspensionType ===
      'permanent'
        ? 'Tindakan keamanan telah diberlakukan. Akun terkait ditangguhkan secara permanen.'
        : metadata.suspensionType
          ? 'Tindakan keamanan telah diberlakukan sesuai hasil pemeriksaan.'
          : 'Tindakan keamanan telah diberlakukan sesuai hasil pemeriksaan.',
    createdAt:
      event.createdAt
  }
}

module.exports = async function handler(req, res) {
  try {
    await connectDB()

    const robot =
      await getOrCreateRobot()

    if (
      req.method === 'GET'
    ) {
      const limit =
        Math.min(
          Math.max(
            Number(
              req.query?.limit || 20
            ),
            1
          ),
          50
        )

      const events =
        await ActivityLog.find({
          action:
            'account_suspend',
          success:
            true
        })
          .sort({
            createdAt: -1
          })
          .limit(limit)
          .lean()

      return res.status(200).json({
        status: true,
        robot:
          formatRobot(robot),
        announcements:
          events.map(
            formatSecurityEvent
          )
      })
    }

    if (
      req.method === 'POST'
    ) {
      return res.status(403).json({
        status: false,
        message: 'Security announcement dibuat melalui sistem keamanan'
      })
    }

    return res.status(405).json({
      status: false,
      message: 'Method tidak diizinkan'
    })
  } catch (error) {
    console.error(
      'ROBOT_SECURITY_ERROR:',
      error
    )

    if (!res.headersSent) {
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server'
      })
    }
  }
}