const connectDB = require('../../api/db')
const User = require('../../models/User')
const admin = require('../../api/middleware/admin')

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        message: 'Method tidak diizinkan'
      })
    }

    await connectDB()
    await admin(req, res, async () => {
      const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1)
      const limit = Math.min(
        20,
        Math.max(1, Number.parseInt(req.query.limit || '20', 10) || 20)
      )

      const search = String(req.query.search || '').trim()
      const role = String(req.query.role || '').trim().toLowerCase()
      const accountStatus = String(req.query.accountStatus || '').trim().toLowerCase()
      const resellerStatus = String(req.query.resellerStatus || '').trim().toLowerCase()
      const verified = String(req.query.verified || '').trim().toLowerCase()

      const roles = ['user', 'admin', 'developer', 'system']
      const accountStatuses = ['active', 'suspended']
      const resellerStatuses = ['none', 'pending', 'approved', 'rejected', 'suspended']
      const verifiedValues = ['true', 'false']

      if (role && !roles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Role tidak valid'
        })
      }

      if (accountStatus && !accountStatuses.includes(accountStatus)) {
        return res.status(400).json({
          success: false,
          message: 'accountStatus tidak valid'
        })
      }

      if (resellerStatus && !resellerStatuses.includes(resellerStatus)) {
        return res.status(400).json({
          success: false,
          message: 'resellerStatus tidak valid'
        })
      }

      if (verified && !verifiedValues.includes(verified)) {
        return res.status(400).json({
          success: false,
          message: 'verified harus true atau false'
        })
      }

      const filter = {}

      if (search) {
        const safeSearch = escapeRegex(search)

        filter.$or = [
          {
            username: {
              $regex: safeSearch,
              $options: 'i'
            }
          },
          {
            email: {
              $regex: safeSearch,
              $options: 'i'
            }
          }
        ]
      }

      if (role) {
        filter.role = role
      }

      if (accountStatus) {
        filter.accountStatus = accountStatus
      }

      if (resellerStatus) {
        filter.resellerStatus = resellerStatus
      }

      if (verified) {
        filter.verified = verified === 'true'
      }

      const skip = (page - 1) * limit

      const [
        users,
        total,
        activeCount,
        suspendedCount,
        userCount,
        adminCount,
        developerCount,
        systemCount,
        resellerNoneCount,
        resellerPendingCount,
        resellerApprovedCount,
        resellerRejectedCount,
        resellerSuspendedCount,
        verifiedCount
      ] = await Promise.all([
        User.find(filter)
          .select([
            '_id',
            'username',
            'email',
            'avatar',
            'bio',
            'role',
            'verified',
            'resellerStatus',
            'accountStatus',
            'suspensionType',
            'suspendedUntil',
            'suspensionReason',
            'followersCount',
            'followingCount',
            'postsCount',
            'registrationIp',
            'lastLoginIp',
            'lastLoginAt',
            'systemAccount',
            'createdAt',
            'updatedAt'
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        User.countDocuments(filter),

        User.countDocuments({
          ...filter,
          accountStatus: 'active'
        }),

        User.countDocuments({
          ...filter,
          accountStatus: 'suspended'
        }),

        User.countDocuments({
          ...filter,
          role: 'user'
        }),

        User.countDocuments({
          ...filter,
          role: 'admin'
        }),

        User.countDocuments({
          ...filter,
          role: 'developer'
        }),

        User.countDocuments({
          ...filter,
          role: 'system'
        }),

        User.countDocuments({
          ...filter,
          resellerStatus: 'none'
        }),

        User.countDocuments({
          ...filter,
          resellerStatus: 'pending'
        }),

        User.countDocuments({
          ...filter,
          resellerStatus: 'approved'
        }),

        User.countDocuments({
          ...filter,
          resellerStatus: 'rejected'
        }),

        User.countDocuments({
          ...filter,
          resellerStatus: 'suspended'
        }),

        User.countDocuments({
          ...filter,
          verified: true
        })
      ])

      const totalPages = Math.ceil(total / limit)

      return res.status(200).json({
        success: true,
        viewer: {
          id: req.user._id,
          username: req.user.username,
          role: req.user.role,
          isAdmin: true,
          isDeveloper: req.user.role === 'developer'
        },
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        },
        filters: {
          search: search || null,
          role: role || null,
          accountStatus: accountStatus || null,
          resellerStatus: resellerStatus || null,
          verified: verified ? verified === 'true' : null
        },
        summary: {
          total,
          active: activeCount,
          suspended: suspendedCount,
          verified: verifiedCount,
          roles: {
            user: userCount,
            admin: adminCount,
            developer: developerCount,
            system: systemCount
          },
          reseller: {
            none: resellerNoneCount,
            pending: resellerPendingCount,
            approved: resellerApprovedCount,
            rejected: resellerRejectedCount,
            suspended: resellerSuspendedCount
          }
        },
        users
      })
    })
  } catch (error) {
    console.error('ADMIN_USERS_ERROR:', error)

    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar pengguna'
    })
  }
}