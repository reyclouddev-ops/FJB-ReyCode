const connectDB = require('../db')
const admin = require('../middleware/admin')
const Report = require('../../models/Report')
const User = require('../../models/User')
const Post = require('../../models/Post')
const Comment = require('../../models/Comment')

function getPage(req) {
  const page = Number(req.query?.page || 1)

  if (!Number.isInteger(page) || page < 1) {
    return 1
  }

  return page
}

function getLimit(req) {
  const limit = Number(req.query?.limit || 20)

  if (!Number.isInteger(limit) || limit < 1) {
    return 20
  }

  return Math.min(limit, 20)
}

function getFilter(req, name) {
  return String(
    req.query?.[name] || ''
  ).trim().toLowerCase()
}

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

function formatUser(user) {
  if (!user) {
    return null
  }

  return {
    id: user._id,
    username: user.username,
    avatar: user.avatar,
    role: user.role,
    verified: user.verified,
    resellerStatus: user.resellerStatus,
    accountStatus: user.accountStatus
  }
}

function formatPost(post) {
  if (!post) {
    return null
  }

  return {
    id: post._id,
    title: post.title,
    content: post.content,
    type: post.type,
    category: post.category,
    subcategory: post.subcategory,
    visibility: post.visibility,
    status: post.status,
    author: post.author
  }
}

function formatComment(comment) {
  if (!comment) {
    return null
  }

  return {
    id: comment._id,
    post: comment.post,
    author: comment.author,
    content: comment.content,
    status: comment.status,
    createdAt: comment.createdAt
  }
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

    await runAdmin(req, res)

    if (res.headersSent) {
      return
    }

    const page = getPage(req)
    const limit = getLimit(req)

    const status = getFilter(
      req,
      'status'
    )

    const targetType = getFilter(
      req,
      'targetType'
    )

    const reason = getFilter(
      req,
      'reason'
    )

    const allowedStatuses = [
      '',
      'pending',
      'rejected',
      'resolved'
    ]

    const allowedTargetTypes = [
      '',
      'user',
      'post',
      'comment'
    ]

    const allowedReasons = [
      '',
      'scam',
      'spam',
      'product_mismatch',
      'rule_violation',
      'suspicious',
      'other'
    ]

    if (
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        status: false,
        message: 'Status report tidak valid'
      })
    }

    if (
      !allowedTargetTypes.includes(
        targetType
      )
    ) {
      return res.status(400).json({
        status: false,
        message: 'Target type tidak valid'
      })
    }

    if (
      !allowedReasons.includes(reason)
    ) {
      return res.status(400).json({
        status: false,
        message: 'Reason tidak valid'
      })
    }

    const filter = {}

    if (status) {
      filter.status = status
    }

    if (targetType) {
      filter.targetType = targetType
    }

    if (reason) {
      filter.reason = reason
    }

    const total =
      await Report.countDocuments(
        filter
      )

    const totalPages =
      total > 0
        ? Math.ceil(total / limit)
        : 0

    const skip =
      (page - 1) * limit

    const reports =
      await Report.find(filter)
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(limit)
        .lean()

    const reporterIds = []
    const targetUserIds = []
    const targetPostIds = []
    const targetCommentIds = []

    for (const report of reports) {
      if (report.reporter) {
        reporterIds.push(
          report.reporter
        )
      }

      if (
        report.targetType === 'user' &&
        report.targetUser
      ) {
        targetUserIds.push(
          report.targetUser
        )
      }

      if (
        report.targetType === 'post' &&
        report.targetPost
      ) {
        targetPostIds.push(
          report.targetPost
        )
      }

      if (
        report.targetType === 'comment' &&
        report.targetComment
      ) {
        targetCommentIds.push(
          report.targetComment
        )
      }
    }

    const uniqueReporterIds = [
      ...new Set(
        reporterIds.map(
          id => String(id)
        )
      )
    ]

    const uniqueTargetUserIds = [
      ...new Set(
        targetUserIds.map(
          id => String(id)
        )
      )
    ]

    const uniqueTargetPostIds = [
      ...new Set(
        targetPostIds.map(
          id => String(id)
        )
      )
    ]

    const uniqueTargetCommentIds = [
      ...new Set(
        targetCommentIds.map(
          id => String(id)
        )
      )
    ]

    const users =
      uniqueReporterIds.length ||
      uniqueTargetUserIds.length
        ? await User.find({
            _id: {
              $in: [
                ...uniqueReporterIds,
                ...uniqueTargetUserIds
              ]
            }
          })
            .select(
              '_id username avatar role verified resellerStatus accountStatus'
            )
            .lean()
        : []

    const posts =
      uniqueTargetPostIds.length
        ? await Post.find({
            _id: {
              $in: uniqueTargetPostIds
            }
          })
            .select(
              '_id title content type category subcategory visibility status author'
            )
            .lean()
        : []

    const comments =
      uniqueTargetCommentIds.length
        ? await Comment.find({
            _id: {
              $in: uniqueTargetCommentIds
            }
          })
            .select(
              '_id post author content status createdAt'
            )
            .lean()
        : []

    const userMap = new Map(
      users.map(user => [
        String(user._id),
        user
      ])
    )

    const postMap = new Map(
      posts.map(post => [
        String(post._id),
        post
      ])
    )

    const commentMap = new Map(
      comments.map(comment => [
        String(comment._id),
        comment
      ])
    )

    const result = reports.map(
      report => {
        const reporter =
          userMap.get(
            String(report.reporter)
          )

        let target = null

        if (
          report.targetType === 'user'
        ) {
          target =
            formatUser(
              userMap.get(
                String(
                  report.targetUser
                )
              )
            )
        }

        if (
          report.targetType === 'post'
        ) {
          target =
            formatPost(
              postMap.get(
                String(
                  report.targetPost
                )
              )
            )
        }

        if (
          report.targetType === 'comment'
        ) {
          target =
            formatComment(
              commentMap.get(
                String(
                  report.targetComment
                )
              )
            )
        }

        return {
          id: report._id,
          reporter:
            formatUser(reporter),
          targetType:
            report.targetType,
          target,
          reason:
            report.reason,
          details:
            report.details,
          status:
            report.status,
          action:
            report.action,
          admin:
            report.admin,
          adminNote:
            report.adminNote,
          resolvedAt:
            report.resolvedAt,
          createdAt:
            report.createdAt,
          updatedAt:
            report.updatedAt
        }
      }
    )

    const pendingCount =
      await Report.countDocuments({
        status: 'pending'
      })

    const resolvedCount =
      await Report.countDocuments({
        status: 'resolved'
      })

    const rejectedCount =
      await Report.countDocuments({
        status: 'rejected'
      })

    return res.status(200).json({
      status: true,
      filters: {
        status: status || null,
        targetType:
          targetType || null,
        reason: reason || null
      },
      summary: {
        pending: pendingCount,
        resolved: resolvedCount,
        rejected: rejectedCount,
        total:
          pendingCount +
          resolvedCount +
          rejectedCount
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage:
          page < totalPages,
        hasPrevPage:
          page > 1
      },
      reports: result
    })
  } catch (error) {
    console.error(
      'REPORT_LIST_ERROR:',
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