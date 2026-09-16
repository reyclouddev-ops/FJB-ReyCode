const connectDB = require('../db')
const auth = require('../middleware/auth')
const User = require('../../models/User')
const ActivityLog = require('../../models/ActivityLog')

function runAuth(req, res) {
  return new Promise((resolve, reject) => {
    auth(req, res, error => {
      if (error) {
        return reject(error)
      }

      resolve()
    })
  })
}

function getBody(req) {
  return req.body || {}
}

function getClientIp(req) {
  const forwarded =
    req.headers['x-forwarded-for']

  if (forwarded) {
    return String(forwarded)
      .split(',')[0]
      .trim()
  }

  return (
    req.socket?.remoteAddress ||
    req.ip ||
    null
  )
}

function isValidAvatar(value) {
  if (
    typeof value !== 'string'
  ) {
    return false
  }

  if (
    value.length < 1 ||
    value.length > 1000
  ) {
    return false
  }

  return /^https?:\/\//i.test(
    value
  )
}

async function createActivity({
  user,
  actor,
  action,
  targetId,
  ip,
  userAgent,
  metadata,
  success,
  reason
}) {
  try {
    await ActivityLog.create({
      user: user || null,
      actor: actor || null,
      action,
      targetType: 'user',
      targetId:
        targetId || null,
      ip: ip || null,
      userAgent:
        userAgent || null,
      metadata:
        metadata || {},
      success:
        success !== false,
      reason:
        reason || null
    })
  } catch (error) {
    console.error(
      'PROFILE_ACTIVITY_LOG_ERROR:',
      error
    )
  }
}

module.exports = async function handler(req, res) {
  if (
    ![
      'PUT',
      'PATCH',
      'POST'
    ].includes(req.method)
  ) {
    return res.status(405).json({
      status: false,
      message: 'Method tidak diizinkan'
    })
  }

  try {
    await connectDB()

    await runAuth(req, res)

    if (res.headersSent) {
      return
    }

    const body =
      getBody(req)

    const hasAvatar =
      Object.prototype.hasOwnProperty.call(
        body,
        'avatar'
      )

    const hasBio =
      Object.prototype.hasOwnProperty.call(
        body,
        'bio'
      )

    const hasUsername =
      Object.prototype.hasOwnProperty.call(
        body,
        'username'
      )

    const hasEmail =
      Object.prototype.hasOwnProperty.call(
        body,
        'email'
      )

    if (
      hasUsername ||
      hasEmail
    ) {
      return res.status(400).json({
        status: false,
        message: 'Username dan email tidak dapat diubah melalui endpoint ini'
      })
    }

    if (
      !hasAvatar &&
      !hasBio
    ) {
      return res.status(400).json({
        status: false,
        message: 'Tidak ada data profil yang diubah'
      })
    }

    const user =
      await User.findById(
        req.user._id
      )

    if (!user) {
      return res.status(404).json({
        status: false,
        message: 'User tidak ditemukan'
      })
    }

    if (
      user.accountStatus !==
      'active'
    ) {
      return res.status(403).json({
        status: false,
        message: 'Akun tidak aktif'
      })
    }

    const changes = {}

    if (hasBio) {
      if (
        body.bio === null
      ) {
        user.bio = ''
      } else {
        if (
          typeof body.bio !==
          'string'
        ) {
          return res.status(400).json({
            status: false,
            message: 'Bio harus berupa teks'
          })
        }

        const bio =
          body.bio.trim()

        if (
          bio.length > 500
        ) {
          return res.status(400).json({
            status: false,
            message: 'Bio maksimal 500 karakter'
          })
        }

        if (
          user.bio !== bio
        ) {
          changes.bio = {
            changed: true
          }
        }

        user.bio =
          bio
      }
    }

    if (hasAvatar) {
      if (
        body.avatar === null ||
        body.avatar === ''
      ) {
        const fallback =
          user.username
            ? user.username
                .charAt(0)
                .toUpperCase()
            : 'U'

        if (
          user.avatar !==
          fallback
        ) {
          changes.avatar = {
            changed: true
          }
        }

        user.avatar =
          fallback
      } else {
        if (
          !isValidAvatar(
            body.avatar
          )
        ) {
          return res.status(400).json({
            status: false,
            message: 'Avatar harus berupa URL HTTP atau HTTPS yang valid'
          })
        }

        if (
          user.avatar !==
          body.avatar
        ) {
          changes.avatar = {
            changed: true
          }
        }

        user.avatar =
          body.avatar
      }
    }

    await user.save()

    const ip =
      getClientIp(req)

    const userAgent =
      req.headers['user-agent'] ||
      null

    await createActivity({
      user:
        user._id,
      actor:
        user._id,
      action:
        'profile_update',
      targetId:
        user._id,
      ip,
      userAgent,
      metadata:
        changes,
      success:
        true,
      reason:
        'Profil diperbarui'
    })

    return res.status(200).json({
      status: true,
      message: 'Profil berhasil diperbarui',
      user: {
        id:
          user._id,
        username:
          user.username,
        avatar:
          user.avatar,
        bio:
          user.bio,
        role:
          user.role,
        verified:
          user.verified,
        resellerStatus:
          user.resellerStatus,
        accountStatus:
          user.accountStatus,
        followersCount:
          user.followersCount,
        followingCount:
          user.followingCount,
        postsCount:
          user.postsCount
      }
    })
  } catch (error) {
    console.error(
      'PROFILE_UPDATE_ERROR:',
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