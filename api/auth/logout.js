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

function getClientIp(req) {
  const realIp =
    req.headers['x-real-ip']

  if (realIp) {
    return normalizeIp(
      realIp
    )
  }

  const forwarded =
    req.headers['x-forwarded-for']

  if (forwarded) {
    const firstIp =
      forwarded
        .split(',')[0]
        .trim()

    if (firstIp) {
      return normalizeIp(
        firstIp
      )
    }
  }

  return normalizeIp(
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    'unknown'
  )
}

function normalizeIp(ip) {
  let value =
    String(
      ip || ''
    ).trim()

  if (!value) {
    return 'unknown'
  }

  if (
    value.startsWith('::ffff:')
  ) {
    value =
      value.substring(7)
  }

  if (value === '::1') {
    return '127.0.0.1'
  }

  return value
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
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
      clearSessionCookie(res)

      return res.status(200).json({
        status: true,
        message: 'Sudah logout'
      })
    }

    const tokenHash =
      hashToken(token)

    const session =
      await Session.findOne({
        tokenHash,
        revokedAt: null
      })

    if (!session) {
      clearSessionCookie(res)

      return res.status(200).json({
        status: true,
        message: 'Sudah logout'
      })
    }

    const ip =
      getClientIp(req)

    const user =
      await User.findById(
        session.user
      )

    if (user) {
      user.ipHistory.push({
        ip,
        type: 'logout',
        createdAt: new Date()
      })

      if (
        user.ipHistory.length > 50
      ) {
        user.ipHistory =
          user.ipHistory.slice(-50)
      }

      await user.save()
    }

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

    return res.status(200).json({
      status: true,
      message: 'Logout berhasil'
    })
  } catch (error) {
    console.error(
      'LOGOUT_ERROR:',
      error
    )

    clearSessionCookie(res)

    return res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan pada server'
    })
  }
}