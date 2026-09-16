const mongoose = require('mongoose')
const connectDB = require('../db')
const auth = require('../middleware/auth')
const Post = require('../../models/Post')
const Like = require('../../models/Like')

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

function getAction(req, body) {
  return String(
    body.action ||
    req.query?.action ||
    'toggle'
  ).trim().toLowerCase()
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

module.exports = async function handler(req, res) {
  if (
    req.method !== 'POST' &&
    req.method !== 'PUT' &&
    req.method !== 'DELETE'
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
    const action = getAction(req, body)

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

    if (
      ![
        'like',
        'unlike',
        'toggle'
      ].includes(action)
    ) {
      return res.status(400).json({
        status: false,
        message: 'Action harus like, unlike, atau toggle'
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
        message: 'Post tidak dapat diberi like'
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
          message: 'Anda tidak dapat memberi like pada post private ini'
        })
      }
    }

    const existingLike = await Like.findOne({
      user: req.user._id,
      targetType: 'post',
      post: post._id,
      comment: null
    })

    let liked = Boolean(existingLike)

    if (action === 'like') {
      if (existingLike) {
        return res.status(200).json({
          status: true,
          message: 'Post sudah disukai',
          liked: true,
          likesCount: post.likesCount
        })
      }

      try {
        await Like.create({
          user: req.user._id,
          targetType: 'post',
          post: post._id,
          comment: null
        })

        const updatedPost = await Post.findOneAndUpdate(
          {
            _id: post._id,
            status: 'active'
          },
          {
            $inc: {
              likesCount: 1
            }
          },
          {
            new: true
          }
        )

        if (!updatedPost) {
          await Like.deleteOne({
            user: req.user._id,
            targetType: 'post',
            post: post._id,
            comment: null
          })

          return res.status(400).json({
            status: false,
            message: 'Post tidak dapat diberi like'
          })
        }

        return res.status(200).json({
          status: true,
          message: 'Post berhasil disukai',
          liked: true,
          likesCount: updatedPost.likesCount
        })
      } catch (error) {
        if (error && error.code === 11000) {
          const currentPost = await Post.findById(
            post._id
          ).select('likesCount')

          return res.status(200).json({
            status: true,
            message: 'Post sudah disukai',
            liked: true,
            likesCount: currentPost
              ? currentPost.likesCount
              : post.likesCount
          })
        }

        throw error
      }
    }

    if (action === 'unlike') {
      if (!existingLike) {
        return res.status(200).json({
          status: true,
          message: 'Post belum disukai',
          liked: false,
          likesCount: post.likesCount
        })
      }

      await Like.deleteOne({
        _id: existingLike._id
      })

      const updatedPost = await Post.findOneAndUpdate(
        {
          _id: post._id,
          likesCount: {
            $gt: 0
          }
        },
        {
          $inc: {
            likesCount: -1
          }
        },
        {
          new: true
        }
      )

      return res.status(200).json({
        status: true,
        message: 'Like berhasil dihapus',
        liked: false,
        likesCount: updatedPost
          ? updatedPost.likesCount
          : 0
      })
    }

    if (existingLike) {
      await Like.deleteOne({
        _id: existingLike._id
      })

      const updatedPost = await Post.findOneAndUpdate(
        {
          _id: post._id,
          likesCount: {
            $gt: 0
          }
        },
        {
          $inc: {
            likesCount: -1
          }
        },
        {
          new: true
        }
      )

      return res.status(200).json({
        status: true,
        message: 'Like berhasil dihapus',
        liked: false,
        likesCount: updatedPost
          ? updatedPost.likesCount
          : 0
      })
    }

    try {
      await Like.create({
        user: req.user._id,
        targetType: 'post',
        post: post._id,
        comment: null
      })

      const updatedPost = await Post.findOneAndUpdate(
        {
          _id: post._id,
          status: 'active'
        },
        {
          $inc: {
            likesCount: 1
          }
        },
        {
          new: true
        }
      )

      if (!updatedPost) {
        await Like.deleteOne({
          user: req.user._id,
          targetType: 'post',
          post: post._id,
          comment: null
        })

        return res.status(400).json({
          status: false,
          message: 'Post tidak dapat diberi like'
        })
      }

      return res.status(200).json({
        status: true,
        message: 'Post berhasil disukai',
        liked: true,
        likesCount: updatedPost.likesCount
      })
    } catch (error) {
      if (error && error.code === 11000) {
        const currentPost = await Post.findById(
          post._id
        ).select('likesCount')

        return res.status(200).json({
          status: true,
          message: 'Post sudah disukai',
          liked: true,
          likesCount: currentPost
            ? currentPost.likesCount
            : post.likesCount
        })
      }

      throw error
    }
  } catch (error) {
    console.error('POST_LIKE_ERROR:', error)

    if (!res.headersSent) {
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server'
      })
    }
  }
}