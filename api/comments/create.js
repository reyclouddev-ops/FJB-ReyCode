const mongoose = require('mongoose')
const connectDB = require('../db')
const auth = require('../middleware/auth')
const Post = require('../../models/Post')
const Comment = require('../../models/Comment')

function getBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  return {}
}

function normalizeString(value) {
  return String(value || '').trim()
}

function getPostId(req, body) {
  return String(
    body.postId ||
    body.post ||
    req.query?.postId ||
    req.query?.post ||
    ''
  ).trim()
}

function getParentId(req, body) {
  return String(
    body.parentId ||
    body.parent ||
    req.query?.parentId ||
    req.query?.parent ||
    ''
  ).trim()
}

function runAuth(req, res) {
  return new Promise((resolve, reject) => {
    auth(req, res, error => {
      if (error) {
        return reject(error)
      }

      resolve()
    })
  })
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

function getCommentData(comment) {
  return {
    id: comment._id,
    post: comment.post,
    author: comment.author
      ? {
          id: comment.author._id,
          username: comment.author.username,
          avatar: comment.author.avatar,
          bio: comment.author.bio,
          role: comment.author.role,
          verified: comment.author.verified,
          resellerStatus: comment.author.resellerStatus
        }
      : null,
    parent: comment.parent,
    content: comment.content,
    likesCount: comment.likesCount,
    status: comment.status,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: false,
      message: 'Method tidak diizinkan'
    })
  }

  try {
    await connectDB()

    await runAuth(req, res)

    if (res.headersSent) {
      return
    }

    const body = getBody(req)

    const postId = getPostId(req, body)
    const parentId = getParentId(req, body)
    const content = normalizeString(body.content)

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

    if (!content) {
      return res.status(400).json({
        status: false,
        message: 'Content komentar wajib diisi'
      })
    }

    if (content.length > 3000) {
      return res.status(400).json({
        status: false,
        message: 'Komentar maksimal 3000 karakter'
      })
    }

    if (
      parentId &&
      !mongoose.Types.ObjectId.isValid(parentId)
    ) {
      return res.status(400).json({
        status: false,
        message: 'Parent comment ID tidak valid'
      })
    }

    const post = await Post.findById(postId)

    if (!post) {
      return res.status(404).json({
        status: false,
        message: 'Post tidak ditemukan'
      })
    }

    if (post.status !== 'active') {
      return res.status(400).json({
        status: false,
        message: 'Post tidak dapat dikomentari'
      })
    }

    if (post.visibility === 'private') {
      const allowed = canViewPrivatePost(
        req.user,
        post.author
      )

      if (!allowed) {
        return res.status(403).json({
          status: false,
          message: 'Anda tidak dapat mengomentari post private ini'
        })
      }
    }

    let parent = null

    if (parentId) {
      parent = await Comment.findById(parentId)

      if (!parent) {
        return res.status(404).json({
          status: false,
          message: 'Komentar parent tidak ditemukan'
        })
      }

      if (
        String(parent.post) !==
        String(post._id)
      ) {
        return res.status(400).json({
          status: false,
          message: 'Komentar parent bukan milik post ini'
        })
      }

      if (parent.status !== 'active') {
        return res.status(400).json({
          status: false,
          message: 'Komentar parent tidak aktif'
        })
      }
    }

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      parent: parent
        ? parent._id
        : null,
      content,
      likesCount: 0,
      status: 'active',
      deletedAt: null,
      deletedBy: null
    })

    await Post.updateOne(
      {
        _id: post._id
      },
      {
        $inc: {
          commentsCount: 1
        }
      }
    )

    const populatedComment =
      await Comment.findById(comment._id)
        .populate({
          path: 'author',
          select: 'username avatar bio role verified resellerStatus'
        })

    return res.status(201).json({
      status: true,
      message: 'Komentar berhasil dibuat',
      comment: getCommentData(
        populatedComment
      )
    })
  } catch (error) {
    console.error('CREATE_COMMENT_ERROR:', error)

    if (!res.headersSent) {
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server'
      })
    }
  }
}