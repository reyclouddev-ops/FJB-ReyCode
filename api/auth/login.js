const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const connectDB = require('../db')
const User = require('../../models/User')
const Session = require('../../models/Session')

const SESSION_COOKIE = 'fjb_session'
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000

function getClientIp(req) {
  const realIp = req.headers['x-real-ip']

  if (realIp) {
    return normalizeIp(realIp)
  }

  const forwarded = req.headers['x-forwarded-for']

  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim()

    if (firstIp) {
      return normalizeIp(firstIp)
    }
  }

  return normalizeIp(
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    'unknown'
  )
}

function normalizeIp(ip) {
  let value = String(ip || '').trim()

  if (!value) {
    return 'unknown'
  }

  if (value.startsWith('::ffff:')) {
    value = value.substring(7)
  }

  if (value === '::1') {
    return '127.0.0.1'
  }

  return value
}

function getBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  return {}
}

function normalizeLogin(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')
}

function getUserAgent(req) {
  return String(
    req.headers['user-agent'] ||
    ''
  ).slice(0, 1000)
}

function createSessionToken() {
  return crypto
    .randomBytes(48)
    .toString('hex')
}

async function createSession(userId, req) {
  const token =
    createSessionToken()

  const now =
    new Date()

  const expiresAt =
    new Date(
      Date.now() +
      SESSION_MAX_AGE
    )

  await Session.create({
    user: userId,
    tokenHash: hashToken(token),
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
    createdAt: now,
    lastUsedAt: now,
    expiresAt,
    revokedAt: null
  })

  return token
}

function setSessionCookie(res, token) {
  const secure =
    process.env.NODE_ENV === 'production'
      ? '; Secure'
      : ''

  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Max-Age=${Math.floor(SESSION_MAX_AGE / 1000)}; Path=/; HttpOnly; SameSite=Lax${secure}`
  )
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: false,
      message: 'Method tidak diizinkan'
    })
  }

  try {
    await connectDB()

    const body =
      getBody(req)

    const login =
      normalizeLogin(
        body.username ||
        body.email ||
        body.login
      )

    const password =
      String(
        body.password || ''
      )

    if (!login || !password) {
      return res.status(400).json({
        status: false,
        message: 'Username/email dan password wajib diisi'
      })
    }

    const user =
      await User.findOne({
        $or: [
          {
            username: login
          },
          {
            email: login
          }
        ]
      }).select('+password')

    if (!user) {
      return res.status(401).json({
        status: false,
        message: 'Username/email atau password salah'
      })
    }

    if (isSuspended(user)) {
      return res.status(403).json({
        status: false,
        message: 'Akun sedang ditangguhkan'
      })
    }

    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        status: false,
        message: 'Akun tidak dapat digunakan'
      })
    }

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      )

    if (!passwordMatch) {
      return res.status(401).json({
        status: false,
        message: 'Username/email atau password salah'
      })
    }

    const ip =
      getClientIp(req)

    const now =
      new Date()

    user.lastLoginIp =
      ip

    user.lastLoginAt =
      now

    user.ipHistory.push({
      ip,
      type: 'login',
      createdAt: now
    })

    if (user.ipHistory.length > 50) {
      user.ipHistory =
        user.ipHistory.slice(-50)
    }

    await user.save()

    const sessionToken =
      await createSession(
        user._id,
        req
      )

    setSessionCookie(
      res,
      sessionToken
    )

    return res.status(200).json({
      status: true,
      message: 'Login berhasil',
      user: getPublicUser(user)
    })
  } catch (error) {
    console.error(
      'LOGIN_ERROR:',
      error
    )

    return res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan pada server'
    })
  }
}