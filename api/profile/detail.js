const mongoose = require('mongoose')
const connectDB = require('../db')
const User = require('../../models/User')
const Post = require('../../models/Post')
const Follow = require('../../models/Follow')
const Session = require('../../models/Session')

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

function getUsername(req) {
  return String(
    req.query?.username ||
    ''
  )
    .trim()
    .toLowerCase()
}

function getUserId(req) {
  return String(
    req.query?.userId ||
    req.query?.id ||
    ''
  ).trim()
}

function getTab(req) {
  const tab = String(
    req.query?.tab ||
    'all'
  )
    .trim()
    .toLowerCase()

  const allowed = [
    'all',
    'products',
    'media'
  ]

  return allowed.includes(tab)
    ? tab
    : 'all'
}

function getCategory(req) {
  return String(
    req.query?.category ||
    ''
  )
    .trim()
    .toLowerCase()
}

function getSubcategory(req) {
  return String(
    req.query?.subcategory ||
    ''
  )
    .trim()
    .toLowerCase()
}

function parseSessionToken(req) {
  const cookie =
    req.headers.cookie || ''

  const parts =
    cookie.split(';')

  for (const part of parts) {
    const [rawName, ...rawValue] =
      part.trim().split('=')

    if (
      rawName ===
      'fjb_session'
    ) {
      return decodeURIComponent(
        rawValue.join('=')
      )
    }
  }

  return null
}

async function getViewer(req) {
  const token =
    parseSessionToken(req)

  if (!token) {
    return null
  }

  const crypto =
    require('crypto')

  const tokenHash =
    crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')

  const session =
    await Session.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: {
        $gt: new Date()
      }
    }).lean()

  if (!session) {
    return null
  }

  const user =
    await User.findOne({
      _id: session.user,
      accountStatus: 'active'
    }).lean()

  return user || null
}

function formatUser(user) {
  return {
    id: user._id,
    username: user.username,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role,
    verified: user.verified,
    resellerStatus:
      user.resellerStatus,
    accountStatus:
      user.accountStatus,
    followersCount:
      user.followersCount,
    followingCount:
      user.followingCount,
    postsCount:
      user.postsCount,
    createdAt:
      user.createdAt
  }
}

function formatPost(post) {
  return {
    id: post._id,
    author: post.author,
    type: post.type,
    title: post.title,
    content: post.content,
    images: post.images,
    visibility:
      post.visibility,
    category:
      post.category,
    subcategory:
      post.subcategory,
    price:
      post.price,
    currency:
      post.currency,
    stock:
      post.stock,
    likesCount:
      post.likesCount,
    commentsCount:
      post.commentsCount,
    ratingsCount:
      post.ratingsCount,
    ratingAverage:
      post.ratingAverage,
    status:
      post.status,
    createdAt:
      post.createdAt,
    updatedAt:
      post.updatedAt
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

    const username =
      getUsername(req)

    const userId =
      getUserId(req)

    if (
      !username &&
      !userId
    ) {
      return res.status(400).json({
        status: false,
        message: 'Username atau userId wajib diisi'
      })
    }

    if (
      userId &&
      !mongoose.Types.ObjectId.isValid(
        userId
      )
    ) {
      return res.status(400).json({
        status: false,
        message: 'User ID tidak valid'
      })
    }

    const viewer =
      await getViewer(req)

    let profileQuery = {
      accountStatus: 'active'
    }

    if (userId) {
      profileQuery._id =
        userId
    } else {
      profileQuery.username =
        username
    }

    const profile =
      await User.findOne(
        profileQuery
      ).lean()

    if (!profile) {
      return res.status(404).json({
        status: false,
        message: 'Profile tidak ditemukan'
      })
    }

    const isOwner =
      Boolean(
        viewer &&
        String(
          viewer._id
        ) ===
          String(
            profile._id
          )
      )

    const isAdmin =
      Boolean(
        viewer &&
        (
          viewer.role ===
            'admin' ||
          viewer.role ===
            'developer'
        )
      )

    const following =
      viewer
        ? Boolean(
            await Follow.exists({
              follower:
                viewer._id,
              following:
                profile._id,
              status:
                'active'
            })
          )
        : false

    const page =
      getPage(req)

    const limit =
      getLimit(req)

    const tab =
      getTab(req)

    const category =
      getCategory(req)

    const subcategory =
      getSubcategory(req)

    const postFilter = {
      author:
        profile._id,
      status:
        'active'
    }

    if (
      !isOwner &&
      !isAdmin
    ) {
      postFilter.visibility =
        'public'
    }

    if (
      tab === 'products'
    ) {
      postFilter.type =
        'product'
    }

    if (
      tab === 'media'
    ) {
      postFilter.images = {
        $exists: true,
        $ne: []
      }
    }

    if (category) {
      postFilter.category =
        category
    }

    if (subcategory) {
      postFilter.subcategory =
        subcategory
    }

    const total =
      await Post.countDocuments(
        postFilter
      )

    const totalPages =
      total > 0
        ? Math.ceil(
            total / limit
          )
        : 0

    const skip =
      (page - 1) * limit

    const posts =
      await Post.find(
        postFilter
      )
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'author',
          select:
            'username avatar role verified resellerStatus'
        })
        .lean()

    const followerCount =
      await Follow.countDocuments({
        following:
          profile._id,
        status:
          'active'
      })

    const followingCount =
      await Follow.countDocuments({
        follower:
          profile._id,
        status:
          'active'
      })

    const responseProfile = {
      ...formatUser(profile),
      followersCount:
        followerCount,
      followingCount:
        followingCount
    }

    return res.status(200).json({
      status: true,

      profile:
        responseProfile,

      viewer: {
        loggedIn:
          Boolean(viewer),
        isOwner,
        isAdmin,
        following
      },

      filters: {
        tab,
        category:
          category || null,
        subcategory:
          subcategory || null
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

      posts:
        posts.map(
          formatPost
        )
    })
  } catch (error) {
    console.error(
      'PROFILE_DETAIL_ERROR:',
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