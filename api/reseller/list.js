const connectDB = require('../db')
const admin = require('../middleware/admin')
const ResellerApplication = require('../../models/ResellerApplication')
const User = require('../../models/User')

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

function getPage(req) {
  const page = Number(
    req.query?.page || 1
  )

  if (
    !Number.isInteger(page) ||
    page < 1
  ) {
    return 1
  }

  return page
}

function getLimit(req) {
  const limit = Number(
    req.query?.limit || 20
  )

  if (
    !Number.isInteger(limit) ||
    limit < 1
  ) {
    return 20
  }

  return Math.min(limit, 20)
}

function getFilter(req) {
  return String(
    req.query?.status || ''
  )
    .trim()
    .toLowerCase()
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
    resellerStatus:
      user.resellerStatus,
    accountStatus:
      user.accountStatus
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

    const page =
      getPage(req)

    const limit =
      getLimit(req)

    const status =
      getFilter(req)

    const allowedStatuses = [
      '',
      'pending',
      'approved',
      'rejected',
      'suspended'
    ]

    if (
      !allowedStatuses.includes(
        status
      )
    ) {
      return res.status(400).json({
        status: false,
        message: 'Status reseller tidak valid'
      })
    }

    const filter = {}

    if (status) {
      filter.status =
        status
    }

    const total =
      await ResellerApplication.countDocuments(
        filter
      )

    const totalPages =
      total > 0
        ? Math.ceil(
            total / limit
          )
        : 0

    const skip =
      (page - 1) * limit

    const applications =
      await ResellerApplication.find(
        filter
      )
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(limit)
        .lean()

    const userIds = [
      ...new Set(
        applications
          .map(item =>
            item.user
              ? String(item.user)
              : null
          )
          .filter(Boolean)
      )
    ]

    const adminIds = [
      ...new Set(
        applications
          .map(item =>
            item.admin
              ? String(item.admin)
              : null
          )
          .filter(Boolean)
      )
    ]

    const users =
      userIds.length ||
      adminIds.length
        ? await User.find({
            _id: {
              $in: [
                ...userIds,
                ...adminIds
              ]
            }
          })
            .select(
              '_id username avatar role verified resellerStatus accountStatus'
            )
            .lean()
        : []

    const userMap =
      new Map(
        users.map(user => [
          String(user._id),
          user
        ])
      )

    const result =
      applications.map(
        application => {
          const user =
            userMap.get(
              String(
                application.user
              )
            )

          const reviewer =
            application.admin
              ? userMap.get(
                  String(
                    application.admin
                  )
                )
              : null

          return {
            id:
              application._id,

            user:
              formatUser(user),

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

            admin:
              reviewer
                ? formatUser(
                    reviewer
                  )
                : null,

            adminNote:
              application.adminNote,

            reviewedAt:
              application.reviewedAt,

            suspendedAt:
              application.suspendedAt,

            suspensionReason:
              application.suspensionReason,

            createdAt:
              application.createdAt,

            updatedAt:
              application.updatedAt
          }
        }
      )

    const pendingCount =
      await ResellerApplication.countDocuments({
        status: 'pending'
      })

    const approvedCount =
      await ResellerApplication.countDocuments({
        status: 'approved'
      })

    const rejectedCount =
      await ResellerApplication.countDocuments({
        status: 'rejected'
      })

    const suspendedCount =
      await ResellerApplication.countDocuments({
        status: 'suspended'
      })

    return res.status(200).json({
      status: true,

      filters: {
        status:
          status || null
      },

      summary: {
        pending:
          pendingCount,
        approved:
          approvedCount,
        rejected:
          rejectedCount,
        suspended:
          suspendedCount,
        total:
          pendingCount +
          approvedCount +
          rejectedCount +
          suspendedCount
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

      applications:
        result
    })
  } catch (error) {
    console.error(
      'RESELLER_LIST_ERROR:',
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