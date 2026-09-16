const mongoose = require('mongoose')
const connectDB = require('../db')
const admin = require('../middleware/admin')
const ResellerApplication = require('../../models/ResellerApplication')
const User = require('../../models/User')
const VerificationHistory = require('../../models/VerificationHistory')
const ActivityLog = require('../../models/ActivityLog')
const Session = require('../../models/Session')

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

function getApplicationId(req) {
  const body = getBody(req)

  return String(
    body.applicationId ||
    body.id ||
    req.query?.applicationId ||
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
      targetType: 'reseller',
      targetId: targetId || null,
      ip: ip || null,
      userAgent: userAgent || null,
      metadata: metadata || {},
      success: success !== false,
      reason: reason || null
    })
  } catch (error) {
    console.error(
      'RESELLER_ACTIVITY_LOG_ERROR:',
      error
    )
  }
}

async function createHistory({
  user,
  application,
  action,
  previousStatus,
  newStatus,
  adminId,
  reason,
  note
}) {
  return VerificationHistory.create({
    user,
    application,
    action,
    previousStatus,
    newStatus,
    admin: adminId,
    reason: reason || null,
    note: note || null
  })
}

async function revokeSessions(userId) {
  await Session.updateMany(
    {
      user: userId,
      revokedAt: null
    },
    {
      $set: {
        revokedAt: new Date()
      }
    }
  )
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

    const applicationId =
      getApplicationId(req)

    const action =
      getAction(req)

    const adminNote =
      getAdminNote(req)

    if (
      !mongoose.Types.ObjectId.isValid(
        applicationId
      )
    ) {
      return res.status(400).json({
        status: false,
        message: 'Application ID tidak valid'
      })
    }

    const allowedActions = [
      'approve',
      'reject',
      'suspend',
      'reinstate'
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

    const application =
      await ResellerApplication.findById(
        applicationId
      )

    if (!application) {
      return res.status(404).json({
        status: false,
        message: 'Pengajuan reseller tidak ditemukan'
      })
    }

    const user =
      await User.findById(
        application.user
      )

    if (!user) {
      return res.status(404).json({
        status: false,
        message: 'User reseller tidak ditemukan'
      })
    }

    const previousStatus =
      application.status

    const now =
      new Date()

    const ip =
      getClientIp(req)

    const userAgent =
      req.headers['user-agent'] ||
      null

    if (
      action === 'approve'
    ) {
      if (
        application.status ===
        'suspended'
      ) {
        return res.status(400).json({
          status: false,
          message: 'Reseller sedang suspended. Gunakan action reinstate terlebih dahulu'
        })
      }

      if (
        application.status ===
        'approved'
      ) {
        return res.status(400).json({
          status: false,
          message: 'Pengajuan reseller sudah approved'
        })
      }

      application.status =
        'approved'

      application.admin =
        req.user._id

      application.adminNote =
        adminNote ||
        'Pengajuan reseller disetujui'

      application.reviewedAt =
        now

      application.suspendedAt =
        null

      application.suspensionReason =
        null

      await application.save()

      user.resellerStatus =
        'approved'

      user.verified =
        true

      await user.save()

      await createHistory({
        user: user._id,
        application:
          application._id,
        action: 'approved',
        previousStatus,
        newStatus: 'approved',
        adminId:
          req.user._id,
        reason:
          adminNote ||
          'Pengajuan reseller disetujui',
        note:
          application.adminNote
      })

      await createActivity({
        user: user._id,
        actor: req.user._id,
        action: 'reseller_approve',
        targetId:
          application._id,
        ip,
        userAgent,
        metadata: {
          previousStatus,
          newStatus: 'approved',
          verified: true
        },
        success: true,
        reason:
          application.adminNote
      })

      return res.status(200).json({
        status: true,
        message: 'Reseller berhasil disetujui',
        application: {
          id:
            application._id,
          status:
            application.status,
          admin:
            application.admin,
          adminNote:
            application.adminNote,
          reviewedAt:
            application.reviewedAt
        },
        user: {
          id:
            user._id,
          username:
            user.username,
          resellerStatus:
            user.resellerStatus,
          verified:
            user.verified
        }
      })
    }

    if (
      action === 'reject'
    ) {
      if (
        application.status ===
        'approved'
      ) {
        return res.status(400).json({
          status: false,
          message: 'Reseller yang sudah approved tidak dapat direject'
        })
      }

      if (
        application.status ===
        'suspended'
      ) {
        return res.status(400).json({
          status: false,
          message: 'Pengajuan sedang suspended. Gunakan reinstate atau proses sesuai status reseller'
        })
      }

      if (
        application.status ===
        'rejected'
      ) {
        return res.status(400).json({
          status: false,
          message: 'Pengajuan reseller sudah direject'
        })
      }

      application.status =
        'rejected'

      application.admin =
        req.user._id

      application.adminNote =
        adminNote ||
        'Pengajuan reseller ditolak'

      application.reviewedAt =
        now

      await application.save()

      user.resellerStatus =
        'rejected'

      user.verified =
        false

      await user.save()

      await createHistory({
        user: user._id,
        application:
          application._id,
        action: 'rejected',
        previousStatus,
        newStatus: 'rejected',
        adminId:
          req.user._id,
        reason:
          adminNote ||
          'Pengajuan reseller ditolak',
        note:
          application.adminNote
      })

      await createActivity({
        user: user._id,
        actor: req.user._id,
        action: 'reseller_reject',
        targetId:
          application._id,
        ip,
        userAgent,
        metadata: {
          previousStatus,
          newStatus: 'rejected',
          verified: false
        },
        success: true,
        reason:
          application.adminNote
      })

      return res.status(200).json({
        status: true,
        message: 'Pengajuan reseller ditolak',
        application: {
          id:
            application._id,
          status:
            application.status,
          admin:
            application.admin,
          adminNote:
            application.adminNote,
          reviewedAt:
            application.reviewedAt
        },
        user: {
          id:
            user._id,
          username:
            user.username,
          resellerStatus:
            user.resellerStatus,
          verified:
            user.verified
        }
      })
    }

    if (
      action === 'suspend'
    ) {
      if (
        application.status !==
        'approved'
      ) {
        return res.status(400).json({
          status: false,
          message: 'Hanya reseller approved yang dapat disuspend'
        })
      }

      application.status =
        'suspended'

      application.admin =
        req.user._id

      application.adminNote =
        adminNote ||
        'Status reseller ditangguhkan'

      application.reviewedAt =
        now

      application.suspendedAt =
        now

      application.suspensionReason =
        adminNote ||
        'Status reseller ditangguhkan'

      await application.save()

      user.resellerStatus =
        'suspended'

      user.verified =
        false

      await user.save()

      await revokeSessions(
        user._id
      )

      await createHistory({
        user: user._id,
        application:
          application._id,
        action: 'suspended',
        previousStatus,
        newStatus: 'suspended',
        adminId:
          req.user._id,
        reason:
          application.suspensionReason,
        note:
          application.adminNote
      })

      await createActivity({
        user: user._id,
        actor: req.user._id,
        action: 'reseller_suspend',
        targetId:
          application._id,
        ip,
        userAgent,
        metadata: {
          previousStatus,
          newStatus: 'suspended',
          verified: false
        },
        success: true,
        reason:
          application.suspensionReason
      })

      return res.status(200).json({
        status: true,
        message: 'Status reseller berhasil disuspend',
        application: {
          id:
            application._id,
          status:
            application.status,
          admin:
            application.admin,
          adminNote:
            application.adminNote,
          suspendedAt:
            application.suspendedAt,
          suspensionReason:
            application.suspensionReason
        },
        user: {
          id:
            user._id,
          username:
            user.username,
          resellerStatus:
            user.resellerStatus,
          verified:
            user.verified
        }
      })
    }

    if (
      action === 'reinstate'
    ) {
      if (
        application.status !==
        'suspended'
      ) {
        return res.status(400).json({
          status: false,
          message: 'Hanya reseller suspended yang dapat direinstate'
        })
      }

      application.status =
        'approved'

      application.admin =
        req.user._id

      application.adminNote =
        adminNote ||
        'Status reseller dipulihkan'

      application.reviewedAt =
        now

      application.suspendedAt =
        null

      application.suspensionReason =
        null

      await application.save()

      user.resellerStatus =
        'approved'

      user.verified =
        true

      await user.save()

      await createHistory({
        user: user._id,
        application:
          application._id,
        action: 'reinstated',
        previousStatus,
        newStatus: 'approved',
        adminId:
          req.user._id,
        reason:
          adminNote ||
          'Status reseller dipulihkan',
        note:
          application.adminNote
      })

      await createActivity({
        user: user._id,
        actor: req.user._id,
        action: 'reseller_approve',
        targetId:
          application._id,
        ip,
        userAgent,
        metadata: {
          previousStatus,
          newStatus: 'approved',
          reinstated: true,
          verified: true
        },
        success: true,
        reason:
          application.adminNote
      })

      return res.status(200).json({
        status: true,
        message: 'Status reseller berhasil dipulihkan',
        application: {
          id:
            application._id,
          status:
            application.status,
          admin:
            application.admin,
          adminNote:
            application.adminNote,
          reviewedAt:
            application.reviewedAt
        },
        user: {
          id:
            user._id,
          username:
            user.username,
          resellerStatus:
            user.resellerStatus,
          verified:
            user.verified
        }
      })
    }

    return res.status(400).json({
      status: false,
      message: 'Action tidak dapat diproses'
    })
  } catch (error) {
    console.error(
      'RESELLER_ACTION_ERROR:',
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