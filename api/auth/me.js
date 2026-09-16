const crypto = require('crypto')
const connectDB = require('../db')
const User = require('../../models/User')
const Session = require('../../models/Session')

const SESSION_COOKIE = 'fjb_session'

function getSessionToken(req) {
  const cookies =
    String(
      req.headers.cookie || ''
    )

  const parts =
    cookies
      .split(';')
      .map(item => item.trim())

  for (const part of parts) {
    const index =
      part.indexOf('=')

    if (index === -1) {
      continue
    }

    const name =
      part.substring(
        0,
        index
      )

    const value =
      part.substring(
        index + 1
      )

    if (name === SESSION_COOKIE) {
      try {
        return decodeURIComponent(
          value
        )
      } catch {
        return value
      }
    }
  }

  return null
}

function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')
}

function getPublicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role,
    verified: user.verified,
    resellerStatus: user.resellerStatus,
    accountStatus: user.accountStatus,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    postsCount: user.postsCount,
    createdAt: user.createdAt
  }
}

function isSuspended(user) {
  if (
    user.accountStatus !== 'suspended'
  ) {
    return false
  }

  if (
    user.suspensionType === 'permanent'
  ) {
    return true
  }

  if (
    user.suspensionType === 'temporary' &&
    user.suspendedUntil &&
    new Date(
      user.suspendedUntil
    ) > new Date()
  ) {
    return true
  }

  return false
}

function setExpiredCookie(res) {
  const secure =
    process.env.NODE_ENV === 'production'
      ? '; Secure'
      : ''

  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`
  )
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      status: false,
      message: 'Method tidak diizinkan'
    })
  }

  try {
    await connectDB()

    const token =
      getSessionToken(req)

    if (!token) {
      return res.status(401).json({
        status: false,
        message: 'Belum login'
      })
    }

    const tokenHash =
      hashToken(token)

    const session =
      await Session.findOne({
        tokenHash,
        revokedAt: null,
        expiresAt: {
          $gt: new Date()
        }
      })

    if (!session) {
      setExpiredCookie(res)

      return res.status(401).json({
        status: false,
        message: 'Session tidak valid'
      })
    }

    const user =
      await User.findById(
        session.user
      )

    if (!user) {
      await Session.updateOne(
        {
          _id: session._id
        },
        {
          $set: {
            revokedAt: new Date()
          }
        }
      )

      setExpiredCookie(res)

      return res.status(401).json({
        status: false,
        message: 'User tidak ditemukan'
      })
    }

    if (isSuspended(user)) {
      await Session.updateMany(
        {
          user: user._id,
          revokedAt: null
        },
        {
          $set: {
            revokedAt: new Date()
          }
        }
      )

      setExpiredCookie(res)

      return res.status(403).json({
        status: false,
        message: 'Akun sedang ditangguhkan'
      })
    }

    if (
      user.accountStatus !== 'active'
    ) {
      await Session.updateMany(
        {
          user: user._id,
          revokedAt: null
        },
        {
          $set: {
            revokedAt: new Date()
          }
        }
      )

      setExpiredCookie(res)

      return res.status(403).json({
        status: false,
        message: 'Akun tidak dapat digunakan'
      })
    }

    await Session.updateOne(
      {
        _id: session._id
      },
      {
        $set: {
          lastUsedAt: new Date()
        }
      }
    )

    return res.status(200).json({
      status: true,
      loggedIn: true,
      user: getPublicUser(user)
    })
  } catch (error) {
    console.error(
      'ME_ERROR:',
      error
    )

    return res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan pada server'
    })
  }
}