const mongoose = require('mongoose')
const connectDB = require('../db')
const auth = require('../middleware/auth')
const Comment = require('../../models/Comment')
const Post = require('../../models/Post')

function getBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  return {}
}

function getCommentId(req, body) {
  return String(
    body.id ||
    body.commentId ||
    body.comment ||
    req.query?.id ||
    req.query?.commentId ||
    req.query?.comment ||
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

module.exports = async function handler(req, res) {
  if (
    req.method !== 'DELETE' &&
    req.method !== 'POST'
  ) {
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

    const commentId = getCommentId(
      req,
      body
    )

    if (!commentId) {
      return res.status(400).json({
        status: false,
        message: 'Comment ID wajib diisi'
      })
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        status: false,
        message: 'Comment ID tidak valid'
      })
    }

    const comment = await Comment.findById(
      commentId
    )

    if (!comment) {
      return res.status(404).json({
        status: false,
        message: 'Komentar tidak ditemukan'
      })
    }

    if (comment.status === 'deleted') {
      return res.status(400).json({
        status: false,
        message: 'Komentar sudah dihapus'
      })
    }

    const isOwner =
      String(comment.author) ===
      String(req.user._id)

    const isAdmin =
      req.user.role === 'admin' ||
      req.user.role === 'developer'

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        status: false,
        message: 'Anda tidak memiliki akses untuk menghapus komentar ini'
      })
    }

    const post = await Post.findById(
      comment.post
    ).select(
      '_id status commentsCount'
    )

    if (!post) {
      return res.status(404).json({
        status: false,
        message: 'Post komentar tidak ditemukan'
      })
    }

    if (
      post.status !== 'active' &&
      !isAdmin
    ) {
      return res.status(400).json({
        status: false,
        message: 'Komentar dari post yang tidak aktif tidak dapat dihapus'
      })
    }

    const now = new Date()

    comment.status = 'deleted'
    comment.deletedAt = now
    comment.deletedBy = req.user._id

    await comment.save()

    let deletedReplies = 0

    if (!comment.parent) {
      const replyResult = await Comment.updateMany(
        {
          post: comment.post,
          parent: comment._id,
          status: 'active'
        },
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: req.user._id
          }
        }
      )

      deletedReplies = replyResult.modifiedCount || 0
    }

    const totalDeleted =
      1 + deletedReplies

    const updatedPost =
      await Post.findOneAndUpdate(
        {
          _id: comment.post,
          commentsCount: {
            $gte: totalDeleted
          }
        },
        {
          $inc: {
            commentsCount: -totalDeleted
          }
        },
        {
          new: true
        }
      )

    if (!updatedPost) {
      await Post.updateOne(
        {
          _id: comment.post
        },
        {
          $set: {
            commentsCount: 0
          }
        }
      )
    }

    return res.status(200).json({
      status: true,
      message: 'Komentar berhasil dihapus',
      comment: {
        id: comment._id,
        post: comment.post,
        status: comment.status,
        deletedAt: comment.deletedAt,
        deletedBy: comment.deletedBy
      },
      deletedReplies,
      commentsCount: updatedPost
        ? updatedPost.commentsCount
        : 0
    })
  } catch (error) {
    console.error('DELETE_COMMENT_ERROR:', error)

    if (!res.headersSent) {
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server'
      })
    }
  }
}