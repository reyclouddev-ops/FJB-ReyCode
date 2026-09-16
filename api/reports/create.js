const mongoose = require('mongoose')
const connectDB = require('../db')
const auth = require('../middleware/auth')
const User = require('../../models/User')
const Post = require('../../models/Post')
const Comment = require('../../models/Comment')
const Report = require('../../models/Report')

function getBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  return {}
}

function getTargetId(req, body) {
  return String(
    body.targetId ||
    body.userId ||
    body.postId ||
    body.commentId ||
    body.id ||
    req.query?.targetId ||
    req.query?.userId ||
    req.query?.postId ||
    req.query?.commentId ||
    req.query?.id ||
    ''
  ).trim()
}

function getTargetType(req, body) {
  return String(
    body.targetType ||
    body.type ||
    req.query?.targetType ||
    req.query?.type ||
    ''
  ).trim().toLowerCase()
}

function getReason(req, body) {
  return String(
    body.reason ||
    req.query?.reason ||
    ''
  ).trim().toLowerCase()
}

function getDetails(req, body) {
  return String(
    body.details ||
    req.query?.details ||
    ''
  ).trim()
}

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

    const targetId = getTargetId(
      req,
      body
    )

    const targetType = getTargetType(
      req,
      body
    )

    const reason = getReason(
      req,
      body
    )

    const details = getDetails(
      req,
      body
    )

    const allowedTargetTypes = [
      'user',
      'post',
      'comment'
    ]

    const allowedReasons = [
      'scam',
      'spam',
      'product_mismatch',
      'rule_violation',
      'suspicious',
      'other'
    ]

    if (!targetId) {
      return res.status(400).json({
        status: false,
        message: 'Target ID wajib diisi'
      })
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({
        status: false,
        message: 'Target ID tidak valid'
      })
    }

    if (
      !allowedTargetTypes.includes(
        targetType
      )
    ) {
      return res.status(400).json({
        status: false,
        message: 'Target type harus user, post, atau comment'
      })
    }

    if (
      !allowedReasons.includes(
        reason
      )
    ) {
      return res.status(400).json({
        status: false,
        message: 'Alasan report tidak valid'
      })
    }

    if (details.length > 3000) {
      return res.status(400).json({
        status: false,
        message: 'Detail report maksimal 3000 karakter'
      })
    }

    if (
      targetType === 'user' &&
      String(req.user._id) === String(targetId)
    ) {
      return res.status(400).json({
        status: false,
        message: 'Anda tidak dapat melaporkan akun sendiri'
      })
    }

    let targetUser = null
    let targetPost = null
    let targetComment = null

    if (targetType === 'user') {
      targetUser = await User.findById(
        targetId
      ).select(
        '_id username accountStatus'
      )

      if (!targetUser) {
        return res.status(404).json({
          status: false,
          message: 'User tidak ditemukan'
        })
      }
    }

    if (targetType === 'post') {
      targetPost = await Post.findById(
        targetId
      ).select(
        '_id author title status visibility'
      )

      if (!targetPost) {
        return res.status(404).json({
          status: false,
          message: 'Post tidak ditemukan'
        })
      }

      if (
        String(targetPost.author) ===
        String(req.user._id)
      ) {
        return res.status(400).json({
          status: false,
          message: 'Anda tidak dapat melaporkan post sendiri'
        })
      }
    }

    if (targetType === 'comment') {
      targetComment =
        await Comment.findById(
          targetId
        ).select(
          '_id post author content status'
        )

      if (!targetComment) {
        return res.status(404).json({
          status: false,
          message: 'Komentar tidak ditemukan'
        })
      }

      if (
        String(targetComment.author) ===
        String(req.user._id)
      ) {
        return res.status(400).json({
          status: false,
          message: 'Anda tidak dapat melaporkan komentar sendiri'
        })
      }

      if (
        targetComment.post
      ) {
        targetPost =
          await Post.findById(
            targetComment.post
          ).select(
            '_id author status visibility'
          )

        if (!targetPost) {
          return res.status(404).json({
            status: false,
            message: 'Post komentar tidak ditemukan'
          })
        }
      }
    }

    const existingReportQuery = {
      reporter: req.user._id,
      status: 'pending'
    }

    if (targetType === 'user') {
      existingReportQuery.targetType = 'user'
      existingReportQuery.targetUser = targetUser._id
    }

    if (targetType === 'post') {
      existingReportQuery.targetType = 'post'
      existingReportQuery.targetPost = targetPost._id
    }

    if (targetType === 'comment') {
      existingReportQuery.targetType = 'comment'
      existingReportQuery.targetComment =
        targetComment._id
    }

    const existingReport =
      await Report.findOne(
        existingReportQuery
      )

    if (existingReport) {
      return res.status(200).json({
        status: true,
        message: 'Report yang sama masih sedang diperiksa',
        alreadyReported: true,
        report: {
          id: existingReport._id,
          targetType:
            existingReport.targetType,
          status:
            existingReport.status,
          reason:
            existingReport.reason,
          createdAt:
            existingReport.createdAt
        }
      })
    }

    const reportData = {
      reporter: req.user._id,
      targetType,
      reason,
      details,
      status: 'pending',
      action: 'none',
      admin: null,
      adminNote: null,
      resolvedAt: null
    }

    if (targetType === 'user') {
      reportData.targetUser =
        targetUser._id
    }

    if (targetType === 'post') {
      reportData.targetPost =
        targetPost._id
    }

    if (targetType === 'comment') {
      reportData.targetComment =
        targetComment._id
    }

    const report =
      await Report.create(
        reportData
      )

    return res.status(201).json({
      status: true,
      message: 'Report berhasil dikirim dan menunggu pemeriksaan admin',
      alreadyReported: false,
      report: {
        id: report._id,
        targetType: report.targetType,
        reason: report.reason,
        details: report.details,
        status: report.status,
        action: report.action,
        createdAt: report.createdAt
      }
    })
  } catch (error) {
    console.error(
      'REPORT_CREATE_ERROR:',
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