const bcrypt = require('bcryptjs')
const connectDB = require('../db')
const User = require('../../models/User')

const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'developer',
  'dev',
  'system',
  'robot',
  'robot-security',
  'security',
  'support',
  'moderator',
  'mod',
  'official',
  'reycode',
  'reycloud',
  'fjb',
  'api'
]

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

function normalizeUsername(username) {
  return String(username || '')
    .trim()
    .toLowerCase()
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

function isValidUsername(username) {
  return /^[a-z0-9_]{3,30}$/.test(username)
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isReservedUsername(username) {
  return RESERVED_USERNAMES.includes(username)
}

function getAvatar(username) {
  return username.charAt(0).toUpperCase()
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: false,
      message: 'Method tidak diizinkan'
    })
  }

  try {
    await connectDB()

    const body = getBody(req)

    const username = normalizeUsername(body.username)
    const email = normalizeEmail(body.email)
    const password = String(body.password || '')

    if (!username || !email || !password) {
      return res.status(400).json({
        status: false,
        message: 'Username, email, dan password wajib diisi'
      })
    }

    if (!isValidUsername(username)) {
      return res.status(400).json({
        status: false,
        message: 'Username hanya boleh menggunakan huruf kecil, angka, dan underscore dengan panjang 3-30 karakter'
      })
    }

    if (isReservedUsername(username)) {
      return res.status(400).json({
        status: false,
        message: 'Username tersebut tidak dapat digunakan'
      })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        status: false,
        message: 'Format email tidak valid'
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: false,
        message: 'Password minimal 8 karakter'
      })
    }

    if (password.length > 128) {
      return res.status(400).json({
        status: false,
        message: 'Password maksimal 128 karakter'
      })
    }

    const ip = getClientIp(req)

    const existingUsername = await User.findOne({
      username
    }).select('_id accountStatus suspensionType suspendedUntil')

    if (existingUsername) {
      return res.status(409).json({
        status: false,
        message: 'Username sudah digunakan'
      })
    }

    const existingEmail = await User.findOne({
      email
    }).select('_id accountStatus suspensionType suspendedUntil')

    if (existingEmail) {
      return res.status(409).json({
        status: false,
        message: 'Email sudah terdaftar'
      })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const now = new Date()

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      avatar: getAvatar(username),
      bio: '',
      role: 'user',
      verified: false,
      resellerStatus: 'none',
      accountStatus: 'active',
      suspensionType: null,
      suspendedUntil: null,
      suspensionReason: null,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      registrationIp: ip,
      lastLoginIp: null,
      ipHistory: [
        {
          ip,
          type: 'register',
          createdAt: now
        }
      ],
      systemAccount: false,
      lastLoginAt: null
    })

    return res.status(201).json({
      status: true,
      message: 'Akun berhasil dibuat',
      user: getPublicUser(user)
    })
  } catch (error) {
    console.error('REGISTER_ERROR:', error)

    if (error.code === 11000) {
      const duplicateField = Object.keys(
        error.keyPattern || {}
      )[0]

      return res.status(409).json({
        status: false,
        message:
          duplicateField === 'username'
            ? 'Username sudah digunakan'
            : duplicateField === 'email'
              ? 'Email sudah terdaftar'
              : 'Data akun sudah digunakan'
      })
    }

    return res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan pada server'
    })
  }
}