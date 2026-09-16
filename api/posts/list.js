const connectDB = require('../db')
const Post = require('../../models/Post')
const User = require('../../models/User')

const MAX_LIMIT = 20

function getQuery(req) {
  if (req.query && typeof req.query === 'object') {
    return req.query
  }

  return {}
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeLowercase(value) {
  return normalizeString(value).toLowerCase()
}

function parsePositiveInteger(value, fallback) {
  const number = Number.parseInt(value, 10)

  if (!Number.isFinite(number) || number < 1) {
    return fallback
  }

  return number
}

function getSessionToken(req) {
  const cookies = String(req.headers.cookie || '')

  const parts = cookies
    .split(';')
    .map(item => item.trim())

  for (const part of parts) {
    const index = part.indexOf('=')

    if (index === -1) {
      continue
    }

    const name = part.substring(0, index)
    const value = part.substring(index + 1)

    if (name === 'fjb_session') {
      try {
        return decodeURIComponent(value)
      } catch {
        return null
      }
    }
  }

  return null
}

async function getOptionalUser(req) {
  const token = getSessionToken(req)

  if (!token) {
    return null
  }

  try {
    const crypto = require('crypto')
    const Session = require('../../models/Session')

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
    })

    if (!session) {
      return null
    }

    const user = await User.findById(session.user)

    if (!user) {
      return null
    }

    if (user.accountStatus !== 'active') {
      return null
    }

    if (
      user.accountStatus === 'suspended' &&
      user.suspensionType === 'permanent'
    ) {
      return null
    }

    if (
      user.accountStatus === 'suspended' &&
      user.suspendedUntil &&
      new Date(user.suspendedUntil) > new Date()
    ) {
      return null
    }

    return user
  } catch {
    return null
  }
}

function getAuthor(author) {
  if (!author) {
    return null
  }

  return {
    id: author._id,
    username: author.username,
    avatar: author.avatar,
    bio: author.bio,
    role: author.role,
    verified: author.verified,
    resellerStatus: author.resellerStatus
  }
}

function getPostData(post) {
  return {
    id: post._id,
    author: getAuthor(post.author),
    type: post.type,
    title: post.title,
    content: post.content,
    images: post.images,
    visibility: post.visibility,
    category: post.category,
    subcategory: post.subcategory,
    price: post.price,
    currency: post.currency,
    stock: post.stock,
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    ratingsCount: post.ratingsCount,
    ratingAverage: post.ratingAverage,
    status: post.status,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt
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

    const query = getQuery(req)

    const page = parsePositiveInteger(
      query.page,
      1
    )

    const requestedLimit = parsePositiveInteger(
      query.limit,
      20
    )

    const limit = Math.min(
      requestedLimit,
      MAX_LIMIT
    )

    const skip = (page - 1) * limit

    const category = normalizeLowercase(
      query.category
    )

    const subcategory = normalizeLowercase(
      query.subcategory
    )

    const type = normalizeLowercase(
      query.type
    )

    const authorUsername = normalizeLowercase(
      query.username
    )

    const currentUser = await getOptionalUser(req)

    const filter = {
      status: 'active'
    }

    if (category) {
      filter.category = category
    }

    if (subcategory) {
      filter.subcategory = subcategory
    }

    if (
      type &&
      ['post', 'product'].includes(type)
    ) {
      filter.type = type
    }

    if (authorUsername) {
      const author = await User.findOne({
        username: authorUsername
      }).select('_id')

      if (!author) {
        return res.status(200).json({
          status: true,
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: page > 1,
          posts: []
        })
      }

      filter.author = author._id
    }

    if (
      currentUser &&
      (
        currentUser.role === 'admin' ||
        currentUser.role === 'developer'
      )
    ) {
      filter.$or = [
        {
          visibility: 'public'
        },
        {
          visibility: 'private'
        }
      ]
    } else if (currentUser) {
      filter.$or = [
        {
          visibility: 'public'
        },
        {
          visibility: 'private',
          author: currentUser._id
        }
      ]
    } else {
      filter.visibility = 'public'
    }

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate({
          path: 'author',
          select: 'username avatar bio role verified resellerStatus accountStatus'
        })
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Post.countDocuments(filter)
    ])

    const totalPages = Math.ceil(
      total / limit
    )

    return res.status(200).json({
      status: true,
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      filters: {
        category: category || null,
        subcategory: subcategory || null,
        type: type || null,
        username: authorUsername || null
      },
      posts: posts.map(getPostData)
    })
  } catch (error) {
    console.error('LIST_POSTS_ERROR:', error)

    return res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan pada server'
    })
  }
}