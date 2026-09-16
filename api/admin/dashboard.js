const connectDB = require('../../api/db')
const User = require('../../models/User')
const Post = require('../../models/Post')
const Comment = require('../../models/Comment')
const Rating = require('../../models/Rating')
const Report = require('../../models/Report')
const ResellerApplication = require('../../models/ResellerApplication')
const Follow = require('../../models/Follow')
const Like = require('../../models/Like')
const ActivityLog = require('../../models/ActivityLog')
const admin = require('../../api/middleware/admin')

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
      const [
        totalUsers,
        activeUsers,
        suspendedUsers,
        verifiedUsers,
        developerUsers,
        adminUsers,
        systemUsers,
        resellerPending,
        resellerApproved,
        resellerRejected,
        resellerSuspended,
        totalPosts,
        activePosts,
        hiddenPosts,
        pendingPosts,
        rejectedPosts,
        deletedPosts,
        productPosts,
        normalPosts,
        publicPosts,
        privatePosts,
        totalComments,
        activeComments,
        hiddenComments,
        deletedComments,
        totalRatings,
        activeRatings,
        totalReports,
        pendingReports,
        resolvedReports,
        rejectedReports,
        totalFollows,
        activeFollows,
        totalLikes,
        postLikes,
        commentLikes,
        recentUsers,
        recentPosts,
        recentReports,
        recentActivities
      ] = await Promise.all([
        User.countDocuments(),

        User.countDocuments({
          accountStatus: 'active'
        }),

        User.countDocuments({
          accountStatus: 'suspended'
        }),

        User.countDocuments({
          verified: true
        }),

        User.countDocuments({
          role: 'developer'
        }),

        User.countDocuments({
          role: 'admin'
        }),

        User.countDocuments({
          role: 'system'
        }),

        User.countDocuments({
          resellerStatus: 'pending'
        }),

        User.countDocuments({
          resellerStatus: 'approved'
        }),

        User.countDocuments({
          resellerStatus: 'rejected'
        }),

        User.countDocuments({
          resellerStatus: 'suspended'
        }),

        Post.countDocuments(),

        Post.countDocuments({
          status: 'active'
        }),

        Post.countDocuments({
          status: 'hidden'
        }),

        Post.countDocuments({
          status: 'pending'
        }),

        Post.countDocuments({
          status: 'rejected'
        }),

        Post.countDocuments({
          status: 'deleted'
        }),

        Post.countDocuments({
          type: 'product'
        }),

        Post.countDocuments({
          type: 'post'
        }),

        Post.countDocuments({
          visibility: 'public'
        }),

        Post.countDocuments({
          visibility: 'private'
        }),

        Comment.countDocuments(),

        Comment.countDocuments({
          status: 'active'
        }),

        Comment.countDocuments({
          status: 'hidden'
        }),

        Comment.countDocuments({
          status: 'deleted'
        }),

        Rating.countDocuments(),

        Rating.countDocuments({
          status: 'active'
        }),

        Report.countDocuments(),

        Report.countDocuments({
          status: 'pending'
        }),

        Report.countDocuments({
          status: 'resolved'
        }),

        Report.countDocuments({
          status: 'rejected'
        }),

        Follow.countDocuments(),

        Follow.countDocuments({
          status: 'active'
        }),

        Like.countDocuments(),

        Like.countDocuments({
          targetType: 'post'
        }),

        Like.countDocuments({
          targetType: 'comment'
        }),

        User.find()
          .select([
            '_id',
            'username',
            'avatar',
            'role',
            'verified',
            'resellerStatus',
            'accountStatus',
            'createdAt'
          ])
          .sort({
            createdAt: -1
          })
          .limit(10)
          .lean(),

        Post.find()
          .populate({
            path: 'author',
            select: [
              '_id',
              'username',
              'avatar',
              'role',
              'verified',
              'resellerStatus'
            ]
          })
          .select([
            '_id',
            'title',
            'content',
            'type',
            'category',
            'subcategory',
            'visibility',
            'status',
            'likesCount',
            'commentsCount',
            'ratingsCount',
            'ratingAverage',
            'createdAt'
          ])
          .sort({
            createdAt: -1
          })
          .limit(10)
          .lean(),

        Report.find()
          .populate({
            path: 'reporter',
            select: [
              '_id',
              'username',
              'avatar',
              'role',
              'verified'
            ]
          })
          .populate({
            path: 'targetUser',
            select: [
              '_id',
              'username',
              'avatar',
              'role',
              'verified',
              'resellerStatus',
              'accountStatus'
            ]
          })
          .populate({
            path: 'targetPost',
            select: [
              '_id',
              'title',
              'type',
              'status'
            ]
          })
          .populate({
            path: 'targetComment',
            select: [
              '_id',
              'content',
              'status'
            ]
          })
          .select([
            '_id',
            'reporter',
            'targetType',
            'targetUser',
            'targetPost',
            'targetComment',
            'reason',
            'details',
            'status',
            'action',
            'adminNote',
            'resolvedAt',
            'createdAt'
          ])
          .sort({
            createdAt: -1
          })
          .limit(10)
          .lean(),

        ActivityLog.find()
          .populate({
            path: 'user',
            select: [
              '_id',
              'username',
              'avatar',
              'role',
              'verified'
            ]
          })
          .populate({
            path: 'actor',
            select: [
              '_id',
              'username',
              'avatar',
              'role',
              'verified'
            ]
          })
          .select([
            '_id',
            'user',
            'actor',
            'action',
            'targetType',
            'targetId',
            'metadata',
            'success',
            'reason',
            'createdAt'
          ])
          .sort({
            createdAt: -1
          })
          .limit(20)
          .lean()
      ])

      return res.status(200).json({
        success: true,
        viewer: {
          id: req.user._id,
          username: req.user.username,
          role: req.user.role,
          isAdmin: true,
          isDeveloper: req.user.role === 'developer'
        },
        stats: {
          users: {
            total: totalUsers,
            active: activeUsers,
            suspended: suspendedUsers,
            verified: verifiedUsers,
            developer: developerUsers,
            admin: adminUsers,
            system: systemUsers
          },
          reseller: {
            pending: resellerPending,
            approved: resellerApproved,
            rejected: resellerRejected,
            suspended: resellerSuspended
          },
          posts: {
            total: totalPosts,
            active: activePosts,
            hidden: hiddenPosts,
            pending: pendingPosts,
            rejected: rejectedPosts,
            deleted: deletedPosts,
            products: productPosts,
            posts: normalPosts,
            public: publicPosts,
            private: privatePosts
          },
          comments: {
            total: totalComments,
            active: activeComments,
            hidden: hiddenComments,
            deleted: deletedComments
          },
          ratings: {
            total: totalRatings,
            active: activeRatings
          },
          reports: {
            total: totalReports,
            pending: pendingReports,
            resolved: resolvedReports,
            rejected: rejectedReports
          },
          follows: {
            total: totalFollows,
            active: activeFollows
          },
          likes: {
            total: totalLikes,
            post: postLikes,
            comment: commentLikes
          }
        },
        recent: {
          users: recentUsers,
          posts: recentPosts,
          reports: recentReports,
          activities: recentActivities
        },
        generatedAt: new Date()
      })
    })
  } catch (error) {
    console.error('ADMIN_DASHBOARD_ERROR:', error)

    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil dashboard admin'
    })
  }
}