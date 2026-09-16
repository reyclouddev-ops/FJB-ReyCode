const mongoose = require('mongoose')
const connectDB = require('../db')
const User = require('../../models/User')
const Post = require('../../models/Post')
const Rating = require('../../models/Rating')
const Session = require('../../models/Session')
const crypto = require('crypto')

function getPostId(req) {
  return String(
    req.query?.postId ||
    req.query?.id ||
    req.query?.post ||
    ''
  ).trim()
}

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

function getSessionToken(req) {
  const cookie = String(
    req.headers?.cookie || ''
  )

  const parts = cookie
    .split(';')
    .map(item => item.trim())

  const sessionCookie = parts.find(
    item => item.startsWith('fjb_session=')
  )

  if (!sessionCookie) {
    return null
  }

  return sessionCookie
    .slice('fjb_session='.length)
    .trim()
}

async function getViewer(req) {
  const token = getSessionToken(req)

  if (!token) {
    return null
  }

  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')

  const session = await Session.findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: {
      $gt: new Date()
    }
  }).select('user')

  if (!session) {
    return null
  }

  return User.findOne({
    _id: session.user,
    accountStatus: 'active'
  }).select(
    '_id username avatar bio role verified resellerStatus'
  )
}

function canViewPrivatePost(user, authorId) {
  if (!user) {
    return false
  }

  if (
    user.role === 'admin' ||
    user.role === 'developer'
  ) {
    return true
  }

  return String(user._id) === String(authorId)
}

function formatUser(user) {
  if (!user) {
    return null
  }

  return {
    id: user._id,
    username: user.username,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role,
    verified: user.verified,
    resellerStatus: user.resellerStatus
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

    const postId = getPostId(req)
    const page = getPage(req)
    const limit = getLimit(req)

    if (!postId) {
      return res.status(400).json({
        status: false,
        message: 'Post ID wajib diisi'
      })
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        status: false,
        message: 'Post ID tidak valid'
      })
    }

    const post = await Post.findById(
      postId
    ).select(
      '_id author visibility status ratingsCount ratingAverage'
    )

    if (!post) {
      return res.status(404).json({
        status: false,
        message: 'Post tidak ditemukan'
      })
    }

    const viewer = await getViewer(req)

    const isAdmin =
      viewer &&
      (
        viewer.role === 'admin' ||
        viewer.role === 'developer'
      )

    if (
      post.status !== 'active' &&
      !isAdmin
    ) {
      return res.status(404).json({
        status: false,
        message: 'Post tidak ditemukan'
      })
    }

    if (
      post.visibility === 'private' &&
      !canViewPrivatePost(
        viewer,
        post.author
      )
    ) {
      return res.status(403).json({
        status: false,
        message: 'Anda tidak dapat melihat rating post ini'
      })
    }

    const filter = {
      post: post._id,
      status: 'active'
    }

    const total =
      await Rating.countDocuments(filter)

    const totalPages =
      total > 0
        ? Math.ceil(total / limit)
        : 0

    const skip =
      (page - 1) * limit

    const ratings =
      await Rating.find(filter)
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(limit)
        .select(
          '_id post user rating review status createdAt updatedAt'
        )
        .lean()

    const userIds = ratings.map(
      item => item.user
    )

    const users =
      userIds.length > 0
        ? await User.find({
            _id: {
              $in: userIds
            }
          })
            .select(
              '_id username avatar bio role verified resellerStatus'
            )
            .lean()
        : []

    const userMap = new Map(
      users.map(user => [
        String(user._id),
        user
      ])
    )

    const formattedRatings =
      ratings.map(item => ({
        id: item._id,
        post: item.post,
        user: formatUser(
          userMap.get(
            String(item.user)
          )
        ),
        rating: item.rating,
        review: item.review,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))

    const distributionResult =
      await Rating.aggregate([
        {
          $match: {
            post: post._id,
            status: 'active'
          }
        },
        {
          $group: {
            _id: '$rating',
            count: {
              $sum: 1
            }
          }
        }
      ])

    const distribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0
    }

    for (
      const item of distributionResult
    ) {
      distribution[item._id] =
        item.count
    }

    const viewerRating =
      viewer
        ? await Rating.findOne({
            post: post._id,
            user: viewer._id
          })
            .select(
              '_id rating review status createdAt updatedAt'
            )
            .lean()
        : null

    const calculatedAverage =
      total > 0
        ? await Rating.aggregate([
            {
              $match: {
                post: post._id,
                status: 'active'
              }
            },
            {
              $group: {
                _id: null,
                average: {
                  $avg: '$rating'
                }
              }
            }
          ])
        : []

    const ratingAverage =
      calculatedAverage.length > 0
        ? Number(
            Number(
              calculatedAverage[0].average
            ).toFixed(2)
          )
        : 0

    return res.status(200).json({
      status: true,
      post: {
        id: post._id,
        ratingsCount: total,
        ratingAverage,
        storedRatingsCount:
          post.ratingsCount || 0,
        storedRatingAverage:
          post.ratingAverage || 0
      },
      distribution,
      viewer: {
        loggedIn: Boolean(viewer),
        id: viewer
          ? viewer._id
          : null,
        rating: viewerRating
          ? {
              id: viewerRating._id,
              rating: viewerRating.rating,
              review: viewerRating.review,
              status: viewerRating.status,
              createdAt:
                viewerRating.createdAt,
              updatedAt:
                viewerRating.updatedAt
            }
          : null
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
      ratings: formattedRatings
    })
  } catch (error) {
    console.error(
      'RATING_LIST_ERROR:',
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