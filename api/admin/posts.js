const connectDB = require('../../api/db')
const Post = require('../../models/Post')
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
      const page = Math.max(
        1,
        Number.parseInt(req.query.page || '1', 10) || 1
      )

      const limit = Math.min(
        20,
        Math.max(
          1,
          Number.parseInt(req.query.limit || '20', 10) || 20
        )
      )

      const search = String(req.query.search || '').trim()
      const status = String(req.query.status || '').trim().toLowerCase()
      const type = String(req.query.type || '').trim().toLowerCase()
      const visibility = String(req.query.visibility || '').trim().toLowerCase()
      const category = String(req.query.category || '').trim().toLowerCase()
      const subcategory = String(req.query.subcategory || '').trim().toLowerCase()
      const username = String(req.query.username || '').trim().toLowerCase()

      const statuses = [
        'active',
        'hidden',
        'pending',
        'rejected',
        'deleted'
      ]

      const types = [
        'post',
        'product'
      ]

      const visibilities = [
        'public',
        'private'
      ]

      if (status && !statuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status post tidak valid'
        })
      }

      if (type && !types.includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Type post tidak valid'
        })
      }

      if (visibility && !visibilities.includes(visibility)) {
        return res.status(400).json({
          success: false,
          message: 'Visibility tidak valid'
        })
      }

      const filter = {}

      if (search) {
        const safeSearch = escapeRegex(search)

        filter.$or = [
          {
            title: {
              $regex: safeSearch,
              $options: 'i'
            }
          },
          {
            content: {
              $regex: safeSearch,
              $options: 'i'
            }
          },
          {
            category: {
              $regex: safeSearch,
              $options: 'i'
            }
          },
          {
            subcategory: {
              $regex: safeSearch,
              $options: 'i'
            }
          }
        ]
      }

      if (status) {
        filter.status = status
      }

      if (type) {
        filter.type = type
      }

      if (visibility) {
        filter.visibility = visibility
      }

      if (category) {
        filter.category = category
      }

      if (subcategory) {
        filter.subcategory = subcategory
      }

      let authorIds = null

      if (username) {
        const users = await User.find({
          username: {
            $regex: `^${escapeRegex(username)}$`,
            $options: 'i'
          }
        })
          .select('_id')
          .lean()

        authorIds = users.map(user => user._id)

        if (!authorIds.length) {
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
              total: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: page > 1
            },
            filters: {
              search: search || null,
              status: status || null,
              type: type || null,
              visibility: visibility || null,
              category: category || null,
              subcategory: subcategory || null,
              username: username || null
            },
            summary: {
              total: 0,
              active: 0,
              hidden: 0,
              pending: 0,
              rejected: 0,
              deleted: 0,
              post: 0,
              product: 0,
              public: 0,
              private: 0
            },
            posts: []
          })
        }

        filter.author = {
          $in: authorIds
        }
      }

      const skip = (page - 1) * limit

      const [
        posts,
        total,
        activeCount,
        hiddenCount,
        pendingCount,
        rejectedCount,
        deletedCount,
        postCount,
        productCount,
        publicCount,
        privateCount
      ] = await Promise.all([
        Post.find(filter)
          .populate({
            path: 'author',
            select: [
              '_id',
              'username',
              'avatar',
              'bio',
              'role',
              'verified',
              'resellerStatus',
              'accountStatus'
            ]
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        Post.countDocuments(filter),

        Post.countDocuments({
          ...filter,
          status: 'active'
        }),

        Post.countDocuments({
          ...filter,
          status: 'hidden'
        }),

        Post.countDocuments({
          ...filter,
          status: 'pending'
        }),

        Post.countDocuments({
          ...filter,
          status: 'rejected'
        }),

        Post.countDocuments({
          ...filter,
          status: 'deleted'
        }),

        Post.countDocuments({
          ...filter,
          type: 'post'
        }),

        Post.countDocuments({
          ...filter,
          type: 'product'
        }),

        Post.countDocuments({
          ...filter,
          visibility: 'public'
        }),

        Post.countDocuments({
          ...filter,
          visibility: 'private'
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
          status: status || null,
          type: type || null,
          visibility: visibility || null,
          category: category || null,
          subcategory: subcategory || null,
          username: username || null
        },
        summary: {
          total,
          active: activeCount,
          hidden: hiddenCount,
          pending: pendingCount,
          rejected: rejectedCount,
          deleted: deletedCount,
          post: postCount,
          product: productCount,
          public: publicCount,
          private: privateCount
        },
        posts
      })
    })
  } catch (error) {
    console.error('ADMIN_POSTS_ERROR:', error)

    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar post'
    })
  }
}