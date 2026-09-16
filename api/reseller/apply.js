const mongoose = require('mongoose')
const connectDB = require('../db')
const auth = require('../middleware/auth')
const ResellerApplication = require('../../models/ResellerApplication')
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const body = getBody(req)

    const businessName =
      String(
        body.businessName ||
        body.name ||
        ''
      ).trim()

    const description =
      String(
        body.description ||
        ''
      ).trim()

    const contact =
      String(
        body.contact ||
        ''
      ).trim()

    let evidence =
      body.evidence

    if (
      evidence === undefined ||
      evidence === null
    ) {
      evidence = []
    }

    if (
      typeof evidence === 'string'
    ) {
      evidence = evidence
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean)
    }

    if (!Array.isArray(evidence)) {
      return res.status(400).json({
        status: false,
        message: 'Evidence harus berupa array atau daftar URL'
      })
    }

    if (
      !businessName
    ) {
      return res.status(400).json({
        status: false,
        message: 'Nama bisnis wajib diisi'
      })
    }

    if (
      businessName.length > 150
    ) {
      return res.status(400).json({
        status: false,
        message: 'Nama bisnis maksimal 150 karakter'
      })
    }

    if (
      !description
    ) {
      return res.status(400).json({
        status: false,
        message: 'Deskripsi bisnis wajib diisi'
      })
    }

    if (
      description.length > 3000
    ) {
      return res.status(400).json({
        status: false,
        message: 'Deskripsi maksimal 3000 karakter'
      })
    }

    if (
      !contact
    ) {
      return res.status(400).json({
        status: false,
        message: 'Kontak wajib diisi'
      })
    }

    if (
      contact.length > 150
    ) {
      return res.status(400).json({
        status: false,
        message: 'Kontak maksimal 150 karakter'
      })
    }

    if (
      evidence.length > 10
    ) {
      return res.status(400).json({
        status: false,
        message: 'Evidence maksimal 10 item'
      })
    }

    for (const item of evidence) {
      if (
        typeof item !== 'string' ||
        item.length > 1000
      ) {
        return res.status(400).json({
          status: false,
          message: 'Evidence tidak valid'
        })
      }

      if (
        !/^https?:\/\//i.test(item)
      ) {
        return res.status(400).json({
          status: false,
          message: 'Evidence harus berupa URL HTTP atau HTTPS'
        })
      }
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
      user.accountStatus !== 'active'
    ) {
      return res.status(403).json({
        status: false,
        message: 'Akun tidak aktif'
      })
    }

    if (
      user.role === 'system'
    ) {
      return res.status(403).json({
        status: false,
        message: 'System account tidak dapat mengajukan reseller'
      })
    }

    if (
      user.resellerStatus === 'approved'
    ) {
      return res.status(400).json({
        status: false,
        message: 'Akun sudah menjadi reseller terverifikasi'
      })
    }

    if (
      user.resellerStatus === 'suspended'
    ) {
      return res.status(403).json({
        status: false,
        message: 'Status reseller akun sedang ditangguhkan'
      })
    }

    const existing =
      await ResellerApplication.findOne({
        user: user._id,
        status: 'pending'
      }).sort({
        createdAt: -1
      })

    if (existing) {
      return res.status(409).json({
        status: false,
        message: 'Masih ada pengajuan reseller yang sedang diproses',
        application: {
          id: existing._id,
          status: existing.status,
          createdAt: existing.createdAt
        }
      })
    }

    const application =
      await ResellerApplication.create({
        user: user._id,
        businessName,
        description,
        contact,
        evidence,
        status: 'pending',
        admin: null,
        adminNote: null,
        reviewedAt: null,
        suspendedAt: null,
        suspensionReason: null
      })

    user.resellerStatus =
      'pending'

    await user.save()

    const ip =
      getClientIp(req)

    const userAgent =
      req.headers['user-agent'] ||
      null

    await createActivity({
      user: user._id,
      actor: user._id,
      action: 'reseller_apply',
      targetId: application._id,
      ip,
      userAgent,
      metadata: {
        businessName,
        evidenceCount:
          evidence.length
      },
      success: true,
      reason:
        'Pengajuan reseller dibuat'
    })

    return res.status(201).json({
      status: true,
      message: 'Pengajuan reseller berhasil dikirim',
      application: {
        id: application._id,
        businessName:
          application.businessName,
        description:
          application.description,
        contact:
          application.contact,
        evidence:
          application.evidence,
        status:
          application.status,
        createdAt:
          application.createdAt
      },
      user: {
        id: user._id,
        username: user.username,
        resellerStatus:
          user.resellerStatus,
        verified:
          user.verified
      }
    })
  } catch (error) {
    console.error(
      'RESELLER_APPLY_ERROR:',
      error
    )

    if (
      error?.code === 11000
    ) {
      return res.status(409).json({
        status: false,
        message: 'Pengajuan reseller sudah ada'
      })
    }

    if (!res.headersSent) {
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server'
      })
    }
  }
}