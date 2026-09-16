const mongoose = require('mongoose')
const connectDB = require('../db')
const auth = require('../middleware/auth')
const Post = require('../../models/Post')
const User = require('../../models/User')

function getBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  return {}
}

function getPostId(req, body) {
  return String(
    body.id ||
    body.postId ||
    req.query?.id ||
    req.query?.postId ||
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

    const postId = getPostId(req, body)

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

    if (!post) {
      return res.status(404).json({
        status: false,
        message: 'Post tidak ditemukan'
      })
    }

    if (post.status === 'deleted') {
      return res.status(400).json({
        status: false,
        message: 'Post sudah dihapus'
      })
    }

    const isOwner =
      String(post.author) === String(req.user._id)

    const isAdmin =
      req.user.role === 'admin' ||
      req.user.role === 'developer'

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        status: false,
        message: 'Anda tidak memiliki akses untuk menghapus post ini'
      })
    }

    const now = new Date()

    post.status = 'deleted'
    post.moderationReason = isAdmin && !isOwner
      ? 'Post dihapus oleh moderator'
      : 'Post dihapus oleh pemilik'

    if (isAdmin && !isOwner) {
      post.moderatedBy = req.user._id
      post.moderatedAt = now
    }

    await post.save()

    await User.updateOne(
      {
        _id: post.author,
        postsCount: {
          $gt: 0
        }
      },
      {
        $inc: {
          postsCount: -1
        }
      }
    )

    return res.status(200).json({
      status: true,
      message: 'Post berhasil dihapus',
      post: {
        id: post._id,
        status: post.status,
        moderationReason: post.moderationReason,
        moderatedBy: post.moderatedBy,
        moderatedAt: post.moderatedAt,
        deletedAt: now
      }
    })
  } catch (error) {
    console.error('DELETE_POST_ERROR:', error)

    if (!res.headersSent) {
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server'
      })
    }
  }
}