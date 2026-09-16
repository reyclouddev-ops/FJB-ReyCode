const crypto = require('crypto')
const connectDB = require('../db')
const User = require('../../models/User')
const Session = require('../../models/Session')

const SESSION_COOKIE = 'fjb_session'

function getSessionToken(req) {
  const cookies = String(req.headers.cookie || '')

  const parts = cookies
    .split(';')
    .map(item => item.trim())

  for (const part of parts) {
    const index = part.indexOf('=')

    if (index === -1) {
      continue
    }

    const name = part.substring(0, index)
    const value = part.substring(index + 1)

    if (name === SESSION_COOKIE) {
      try {
        return decodeURIComponent(value)
      } catch {
        return null
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

function clearSessionCookie(res) {
  const secure =
    process.env.NODE_ENV === 'production'
      ? '; Secure'
      : ''

  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`
  )
}

function isSuspended(user) {
  if (user.accountStatus !== 'suspended') {
    return false
  }

  if (user.suspensionType === 'permanent') {
    return true
  }

  if (
    user.suspensionType === 'temporary' &&
    user.suspendedUntil &&
    new Date(user.suspendedUntil) > new Date()
  ) {
    return true
  }

  return false
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

async function auth(req, res, next) {
  try {
    await connectDB()

    const token = getSessionToken(req)

    if (!token) {
      return res.status(401).json({
        status: false,
        message: 'Belum login'
      })
    }

    const tokenHash = hashToken(token)

    const session = await Session.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: {
        $gt: new Date()
      }
    })

    if (!session) {
      clearSessionCookie(res)

      return res.status(401).json({
        status: false,
        message: 'Session tidak valid atau telah kedaluwarsa'
      })
    }

    const user = await User.findById(session.user)

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

      clearSessionCookie(res)

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

      clearSessionCookie(res)

      return res.status(403).json({
        status: false,
        message: 'Akun sedang ditangguhkan'
      })
    }

    if (user.accountStatus !== 'active') {
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

      clearSessionCookie(res)

      return res.status(403).json({
        status: false,
        message: 'Akun tidak dapat digunakan'
      })
    }

    session.lastUsedAt = new Date()
    await session.save()

    req.user = user
    req.session = session
    req.sessionToken = token
    req.sessionTokenHash = tokenHash

    return next()
  } catch (error) {
    console.error('AUTH_MIDDLEWARE_ERROR:', error)

    return res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan pada server'
    })
  }
}

auth.getPublicUser = getPublicUser
auth.getSessionToken = getSessionToken
auth.hashToken = hashToken
auth.clearSessionCookie = clearSessionCookie

module.exports = auth