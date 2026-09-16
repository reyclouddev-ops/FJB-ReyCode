const mongoose = require('mongoose')
const crypto = require('crypto')
const connectDB = require('../db')
const Post = require('../../models/Post')
const Comment = require('../../models/Comment')
const User = require('../../models/User')
const Session = require('../../models/Session')

const SESSION_COOKIE = 'fjb_session'
const MAX_LIMIT = 10000

function getQuery(req) {
  if (req.query && typeof req.query === 'object') {
    return req.query
  }

  return {}
}

function normalizeString(value) {
  return String(value || '').trim()
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

function getCommentData(comment, replies = []) {
  return {
    id: comment._id,
    post: comment.post,
    author: getAuthor(comment.author),
    parent: comment.parent,
    content: comment.content,
    likesCount: comment.likesCount,
    status: comment.status,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    replies
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

    const postId = normalizeString(
      query.postId ||
      query.post
    )

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
      .select(
        '_id author visibility status'
      )
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
      String(currentUser._id) ===
      String(post.author)

    if (post.status !== 'active' && !isAdmin) {
      return res.status(404).json({
        status: false,
        message: 'Post tidak ditemukan'
      })
    }

    if (post.visibility === 'private') {
      if (
        !canViewPrivatePost(
          currentUser,
          post.author
        )
      ) {
        return res.status(403).json({
          status: false,
          message: 'Post ini bersifat private'
        })
      }
    }

    const commentFilter = {
      post: post._id,
      parent: null,
      status: 'active'
    }

    const [comments, total] = await Promise.all([
      Comment.find(commentFilter)
        .populate({
          path: 'author',
          select:
            'username avatar bio role verified resellerStatus'
        })
        .sort({
          createdAt: 1
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Comment.countDocuments(
        commentFilter
      )
    ])

    const commentIds = comments.map(
      comment => comment._id
    )

    let replies = []

    if (commentIds.length) {
      replies = await Comment.find({
        post: post._id,
        parent: {
          $in: commentIds
        },
        status: 'active'
      })
        .populate({
          path: 'author',
          select:
            'username avatar bio role verified resellerStatus'
        })
        .sort({
          createdAt: 1
        })
        .lean()
    }

    const replyMap = new Map()

    for (const reply of replies) {
      const parentId = String(
        reply.parent
      )

      if (!replyMap.has(parentId)) {
        replyMap.set(parentId, [])
      }

      replyMap.get(parentId).push(
        getCommentData(reply)
      )
    }

    const result = comments.map(
      comment => {
        const commentReplies =
          replyMap.get(
            String(comment._id)
          ) || []

        return getCommentData(
          comment,
          commentReplies
        )
      }
    )

    const totalPages = Math.ceil(
      total / limit
    )

    return res.status(200).json({
      status: true,
      post: {
        id: post._id,
        author: post.author,
        visibility: post.visibility,
        status: post.status
      },
      viewer: {
        loggedIn: Boolean(currentUser),
        isOwner: Boolean(isOwner),
        isAdmin: Boolean(isAdmin)
      },
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      comments: result
    })
  } catch (error) {
    console.error('LIST_COMMENTS_ERROR:', error)

    return res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan pada server'
    })
  }
}