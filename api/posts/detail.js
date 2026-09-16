const mongoose = require('mongoose')
const crypto = require('crypto')
const connectDB = require('../db')
const Post = require('../../models/Post')
const User = require('../../models/User')
const Session = require('../../models/Session')

const SESSION_COOKIE = 'fjb_session'

function getQuery(req) {
  if (req.query && typeof req.query === 'object') {
    return req.query
  }

  return {}
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

    if (name === SESSION_COOKIE) {
      try {
        return decodeURIComponent(value)
      } catch {
        return null
      }
    }
  }

  return null
}

async function getCurrentUser(req) {
  const token = getSessionToken(req)

  if (!token) {
    return null
  }

  try {
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

    return user
  } catch {
    return null
  }
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

    const postId = String(
      query.id ||
      query.postId ||
      ''
    ).trim()

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

    const post = await Post.findById(postId)
      .populate({
        path: 'author',
        select: 'username avatar bio role verified resellerStatus accountStatus'
      })
      .lean()

    if (!post) {
      return res.status(404).json({
        status: false,
        message: 'Post tidak ditemukan'
      })
    }

    const currentUser = await getCurrentUser(req)

    const isAdmin =
      currentUser &&
      (
        currentUser.role === 'admin' ||
        currentUser.role === 'developer'
      )

    const isOwner =
      currentUser &&
      post.author &&
      String(currentUser._id) === String(post.author._id)

    if (post.status !== 'active') {
      if (!isAdmin) {
        return res.status(404).json({
          status: false,
          message: 'Post tidak ditemukan'
        })
      }
    }

    if (post.visibility === 'private') {
      if (!canViewPrivatePost(
        currentUser,
        post.author?._id
      )) {
        return res.status(403).json({
          status: false,
          message: 'Post ini bersifat private'
        })
      }
    }

    return res.status(200).json({
      status: true,
      post: getPostData(post),
      viewer: {
        loggedIn: Boolean(currentUser),
        isOwner: Boolean(isOwner),
        isAdmin: Boolean(isAdmin)
      }
    })
  } catch (error) {
    console.error('POST_DETAIL_ERROR:', error)

    return res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan pada server'
    })
  }
}