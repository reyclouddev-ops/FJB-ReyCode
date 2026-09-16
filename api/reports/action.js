const mongoose = require('mongoose')
const connectDB = require('../db')
const admin = require('../middleware/admin')
const Report = require('../../models/Report')
const User = require('../../models/User')
const Post = require('../../models/Post')
const Comment = require('../../models/Comment')
const Session = require('../../models/Session')
const ActivityLog = require('../../models/ActivityLog')

function runAdmin(req, res) {
  return new Promise((resolve, reject) => {
    admin(req, res, error => {
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

function getReportId(req) {
  const body = getBody(req)

  return String(
    body.reportId ||
    body.id ||
    req.query?.reportId ||
    req.query?.id ||
    ''
  ).trim()
}

function getAction(req) {
  const body = getBody(req)

  return String(
    body.action ||
    ''
  ).trim().toLowerCase()
}

function getAdminNote(req) {
  const body = getBody(req)

  return String(
    body.adminNote ||
    body.reason ||
    ''
  ).trim()
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']

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

async function createActivity({
  user,
  actor,
  action,
  targetType,
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
      targetType: targetType || null,
      targetId: targetId || null,
      ip: ip || null,
      userAgent: userAgent || null,
      metadata: metadata || {},
      success: success !== false,
      reason: reason || null
    })
  } catch (error) {
    console.error(
      'REPORT_ACTIVITY_LOG_ERROR:',
      error
    )
  }
}

async function getTargetAccount(report) {
  if (
    report.targetType === 'user'
  ) {
    if (!report.targetUser) {
      return null
    }

    return User.findById(
      report.targetUser
    )
  }

  if (
    report.targetType === 'post'
  ) {
    if (!report.targetPost) {
      return null
    }

    const post =
      await Post.findById(
        report.targetPost
      )

    if (!post) {
      return null
    }

    return User.findById(
      post.author
    )
  }

  if (
    report.targetType === 'comment'
  ) {
    if (!report.targetComment) {
      return null
    }

    const comment =
      await Comment.findById(
        report.targetComment
      )

    if (!comment) {
      return null
    }

    return User.findById(
      comment.author
    )
  }

  return null
}

async function hideTarget(report) {
  if (
    report.targetType === 'post'
  ) {
    if (!report.targetPost) {
      throw new Error(
        'Post target tidak ditemukan'
      )
    }

    const post =
      await Post.findById(
        report.targetPost
      )

    if (!post) {
      throw new Error(
        'Post target tidak ditemukan'
      )
    }

    if (
      post.status === 'deleted'
    ) {
      throw new Error(
        'Post sudah dihapus'
      )
    }

    post.status = 'hidden'
    post.moderationReason =
      'Disembunyikan setelah laporan diproses'
    post.moderatedBy = null
    post.moderatedAt =
      new Date()

    await post.save()

    return {
      targetType: 'post',
      targetId: post._id,
      authorId: post.author
    }
  }

  if (
    report.targetType === 'comment'
  ) {
    if (!report.targetComment) {
      throw new Error(
        'Comment target tidak ditemukan'
      )
    }

    const comment =
      await Comment.findById(
        report.targetComment
      )

    if (!comment) {
      throw new Error(
        'Comment target tidak ditemukan'
      )
    }

    if (
      comment.status === 'deleted'
    ) {
      throw new Error(
        'Comment sudah dihapus'
      )
    }

    comment.status = 'hidden'
    comment.deletedAt = null
    comment.deletedBy = null

    await comment.save()

    return {
      targetType: 'comment',
      targetId: comment._id,
      authorId: comment.author
    }
  }

  throw new Error(
    'Action hide_content hanya berlaku untuk post atau comment'
  )
}

async function suspendAccount(user, permanent, reason) {
  const now = new Date()

  user.accountStatus =
    'suspended'

  user.suspensionType =
    permanent
      ? 'permanent'
      : 'temporary'

  user.suspendedUntil =
    permanent
      ? null
      : new Date(
          now.getTime() +
          30 * 24 * 60 * 60 * 1000
        )

  user.suspensionReason =
    reason ||
    'Akun ditangguhkan setelah proses laporan'

  if (
    user.resellerStatus === 'approved' ||
    user.resellerStatus === 'pending'
  ) {
    user.resellerStatus =
      'suspended'
  }

  await user.save()

  await Session.updateMany(
    {
      user: user._id,
      revokedAt: null
    },
    {
      $set: {
        revokedAt: now
      }
    }
  )

  return user
}

module.exports = async function handler(req, res) {
  if (
    ![
      'POST',
      'PUT',
      'PATCH'
    ].includes(req.method)
  ) {
    return res.status(405).json({
      status: false,
      message: 'Method tidak diizinkan'
    })
  }

  try {
    await connectDB()

    await runAdmin(req, res)

    if (res.headersSent) {
      return
    }

    const reportId =
      getReportId(req)

    const action =
      getAction(req)

    const adminNote =
      getAdminNote(req)

    if (
      !mongoose.Types.ObjectId.isValid(
        reportId
      )
    ) {
      return res.status(400).json({
        status: false,
        message: 'Report ID tidak valid'
      })
    }

    const allowedActions = [
      'none',
      'warning',
      'hide_content',
      'suspend_30d',
      'suspend_permanent'
    ]

    if (
      !allowedActions.includes(action)
    ) {
      return res.status(400).json({
        status: false,
        message: 'Action tidak valid'
      })
    }

    if (
      adminNote.length > 3000
    ) {
      return res.status(400).json({
        status: false,
        message: 'Admin note maksimal 3000 karakter'
      })
    }

    const report =
      await Report.findById(
        reportId
      )

    if (!report) {
      return res.status(404).json({
        status: false,
        message: 'Report tidak ditemukan'
      })
    }

    if (
      report.status !== 'pending'
    ) {
      return res.status(400).json({
        status: false,
        message: 'Report sudah diproses'
      })
    }

    const ip =
      getClientIp(req)

    const userAgent =
      req.headers['user-agent'] ||
      null

    const now =
      new Date()

    let targetUser = null
    let targetType =
      report.targetType
    let targetId = null

    if (
      report.targetType === 'user'
    ) {
      targetId =
        report.targetUser

      targetUser =
        await User.findById(
          report.targetUser
        )

      if (!targetUser) {
        return res.status(404).json({
          status: false,
          message: 'Target user tidak ditemukan'
        })
      }
    }

    if (
      report.targetType === 'post'
    ) {
      targetId =
        report.targetPost

      const post =
        await Post.findById(
          report.targetPost
        )

      if (!post) {
        return res.status(404).json({
          status: false,
          message: 'Target post tidak ditemukan'
        })
      }

      targetUser =
        await User.findById(
          post.author
        )

      if (!targetUser) {
        return res.status(404).json({
          status: false,
          message: 'Pemilik post tidak ditemukan'
        })
      }
    }

    if (
      report.targetType === 'comment'
    ) {
      targetId =
        report.targetComment

      const comment =
        await Comment.findById(
          report.targetComment
        )

      if (!comment) {
        return res.status(404).json({
          status: false,
          message: 'Target comment tidak ditemukan'
        })
      }

      targetUser =
        await User.findById(
          comment.author
        )

      if (!targetUser) {
        return res.status(404).json({
          status: false,
          message: 'Pemilik comment tidak ditemukan'
        })
      }
    }

    if (
      action === 'none'
    ) {
      report.status =
        'rejected'

      report.action =
        'none'

      report.admin =
        req.user._id

      report.adminNote =
        adminNote ||
        'Tidak ditemukan pelanggaran yang memerlukan tindakan'

      report.resolvedAt =
        now

      await report.save()

      await createActivity({
        actor: req.user._id,
        action: 'report_review',
        targetType,
        targetId,
        ip,
        userAgent,
        metadata: {
          reportId:
            report._id,
          action,
          targetType
        },
        success: true,
        reason:
          report.adminNote
      })

      return res.status(200).json({
        status: true,
        message: 'Report ditolak tanpa tindakan',
        report: {
          id: report._id,
          status: report.status,
          action: report.action,
          admin: report.admin,
          adminNote: report.adminNote,
          resolvedAt: report.resolvedAt
        }
      })
    }

    if (
      action === 'warning'
    ) {
      report.status =
        'resolved'

      report.action =
        'warning'

      report.admin =
        req.user._id

      report.adminNote =
        adminNote ||
        'Peringatan diberikan kepada akun terkait'

      report.resolvedAt =
        now

      await report.save()

      await createActivity({
        user: targetUser._id,
        actor: req.user._id,
        action: 'account_warning',
        targetType: 'user',
        targetId: targetUser._id,
        ip,
        userAgent,
        metadata: {
          reportId:
            report._id,
          reportTargetType:
            report.targetType
        },
        success: true,
        reason:
          report.adminNote
      })

      await createActivity({
        actor: req.user._id,
        action: 'report_review',
        targetType,
        targetId,
        ip,
        userAgent,
        metadata: {
          reportId:
            report._id,
          action,
          targetType
        },
        success: true,
        reason:
          report.adminNote
      })

      return res.status(200).json({
        status: true,
        message: 'Warning berhasil diberikan',
        report: {
          id: report._id,
          status: report.status,
          action: report.action,
          admin: report.admin,
          adminNote: report.adminNote,
          resolvedAt: report.resolvedAt
        },
        targetUser: {
          id: targetUser._id,
          username: targetUser.username,
          accountStatus:
            targetUser.accountStatus
        }
      })
    }

    if (
      action === 'hide_content'
    ) {
      if (
        report.targetType === 'user'
      ) {
        return res.status(400).json({
          status: false,
          message: 'Hide content tidak dapat digunakan untuk report user'
        })
      }

      const hidden =
        await hideTarget(
          report
        )

      report.status =
        'resolved'

      report.action =
        'hide_content'

      report.admin =
        req.user._id

      report.adminNote =
        adminNote ||
        'Konten disembunyikan setelah proses laporan'

      report.resolvedAt =
        now

      await report.save()

      await createActivity({
        actor: req.user._id,
        action: 'content_hide',
        targetType:
          hidden.targetType,
        targetId:
          hidden.targetId,
        ip,
        userAgent,
        metadata: {
          reportId:
            report._id,
          authorId:
            hidden.authorId
        },
        success: true,
        reason:
          report.adminNote
      })

      await createActivity({
        actor: req.user._id,
        action: 'report_review',
        targetType,
        targetId,
        ip,
        userAgent,
        metadata: {
          reportId:
            report._id,
          action,
          targetType
        },
        success: true,
        reason:
          report.adminNote
      })

      return res.status(200).json({
        status: true,
        message: 'Konten berhasil disembunyikan',
        report: {
          id: report._id,
          status: report.status,
          action: report.action,
          admin: report.admin,
          adminNote: report.adminNote,
          resolvedAt: report.resolvedAt
        },
        content: {
          targetType:
            hidden.targetType,
          targetId:
            hidden.targetId
        }
      })
    }

    if (
      action === 'suspend_30d' ||
      action === 'suspend_permanent'
    ) {
      const permanent =
        action ===
        'suspend_permanent'

      const suspended =
        await suspendAccount(
          targetUser,
          permanent,
          adminNote
        )

      report.status =
        'resolved'

      report.action =
        action

      report.admin =
        req.user._id

      report.adminNote =
        adminNote ||
        (
          permanent
            ? 'Akun ditangguhkan secara permanen'
            : 'Akun ditangguhkan selama 30 hari'
        )

      report.resolvedAt =
        now

      await report.save()

      await createActivity({
        user: suspended._id,
        actor: req.user._id,
        action: 'account_suspend',
        targetType: 'user',
        targetId: suspended._id,
        ip,
        userAgent,
        metadata: {
          reportId:
            report._id,
          reportTargetType:
            report.targetType,
          suspensionType:
            suspended.suspensionType,
          suspendedUntil:
            suspended.suspendedUntil
        },
        success: true,
        reason:
          report.adminNote
      })

      await createActivity({
        actor: req.user._id,
        action: 'report_review',
        targetType,
        targetId,
        ip,
        userAgent,
        metadata: {
          reportId:
            report._id,
          action,
          targetType,
          targetUserId:
            suspended._id
        },
        success: true,
        reason:
          report.adminNote
      })

      return res.status(200).json({
        status: true,
        message:
          permanent
            ? 'Akun berhasil ditangguhkan permanen'
            : 'Akun berhasil ditangguhkan selama 30 hari',
        report: {
          id: report._id,
          status: report.status,
          action: report.action,
          admin: report.admin,
          adminNote: report.adminNote,
          resolvedAt: report.resolvedAt
        },
        targetUser: {
          id: suspended._id,
          username: suspended.username,
          accountStatus:
            suspended.accountStatus,
          suspensionType:
            suspended.suspensionType,
          suspendedUntil:
            suspended.suspendedUntil,
          resellerStatus:
            suspended.resellerStatus
        }
      })
    }

    return res.status(400).json({
      status: false,
      message: 'Action tidak dapat diproses'
    })
  } catch (error) {
    console.error(
      'REPORT_ACTION_ERROR:',
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