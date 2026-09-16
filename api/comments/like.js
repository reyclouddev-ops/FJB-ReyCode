const mongoose = require('mongoose')
const connectDB = require('../db')
const auth = require('../middleware/auth')
const Comment = require('../../models/Comment')
const Post = require('../../models/Post')
const Like = require('../../models/Like')

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

    const commentId = getCommentId(
      req,
      body
    )

    const action = getAction(
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

    const comment = await Comment.findById(
      commentId
    )

    if (!comment) {
      return res.status(404).json({
        status: false,
        message: 'Komentar tidak ditemukan'
      })
    }

    if (comment.status !== 'active') {
      return res.status(400).json({
        status: false,
        message: 'Komentar tidak dapat diberi like'
      })
    }

    const post = await Post.findById(
      comment.post
    ).select(
      '_id author visibility status'
    )

    if (!post) {
      return res.status(404).json({
        status: false,
        message: 'Post komentar tidak ditemukan'
      })
    }

    if (post.status !== 'active') {
      return res.status(400).json({
        status: false,
        message: 'Komentar tidak dapat diberi like'
      })
    }

    if (post.visibility === 'private') {
      if (
        !canViewPrivatePost(
          req.user,
          post.author
        )
      ) {
        return res.status(403).json({
          status: false,
          message: 'Anda tidak dapat memberi like pada komentar ini'
        })
      }
    }

    const existingLike = await Like.findOne({
      user: req.user._id,
      targetType: 'comment',
      post: null,
      comment: comment._id
    })

    if (action === 'like') {
      if (existingLike) {
        return res.status(200).json({
          status: true,
          message: 'Komentar sudah disukai',
          liked: true,
          likesCount: comment.likesCount
        })
      }

      try {
        await Like.create({
          user: req.user._id,
          targetType: 'comment',
          post: null,
          comment: comment._id
        })

        const updatedComment =
          await Comment.findOneAndUpdate(
            {
              _id: comment._id,
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

        if (!updatedComment) {
          await Like.deleteOne({
            user: req.user._id,
            targetType: 'comment',
            post: null,
            comment: comment._id
          })

          return res.status(400).json({
            status: false,
            message: 'Komentar tidak dapat diberi like'
          })
        }

        return res.status(200).json({
          status: true,
          message: 'Komentar berhasil disukai',
          liked: true,
          likesCount: updatedComment.likesCount
        })
      } catch (error) {
        if (error && error.code === 11000) {
          const currentComment =
            await Comment.findById(
              comment._id
            ).select('likesCount')

          return res.status(200).json({
            status: true,
            message: 'Komentar sudah disukai',
            liked: true,
            likesCount: currentComment
              ? currentComment.likesCount
              : comment.likesCount
          })
        }

        throw error
      }
    }

    if (action === 'unlike') {
      if (!existingLike) {
        return res.status(200).json({
          status: true,
          message: 'Komentar belum disukai',
          liked: false,
          likesCount: comment.likesCount
        })
      }

      await Like.deleteOne({
        _id: existingLike._id
      })

      const updatedComment =
        await Comment.findOneAndUpdate(
          {
            _id: comment._id,
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
        message: 'Like komentar berhasil dihapus',
        liked: false,
        likesCount: updatedComment
          ? updatedComment.likesCount
          : 0
      })
    }

    if (existingLike) {
      await Like.deleteOne({
        _id: existingLike._id
      })

      const updatedComment =
        await Comment.findOneAndUpdate(
          {
            _id: comment._id,
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
        message: 'Like komentar berhasil dihapus',
        liked: false,
        likesCount: updatedComment
          ? updatedComment.likesCount
          : 0
      })
    }

    try {
      await Like.create({
        user: req.user._id,
        targetType: 'comment',
        post: null,
        comment: comment._id
      })

      const updatedComment =
        await Comment.findOneAndUpdate(
          {
            _id: comment._id,
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

      if (!updatedComment) {
        await Like.deleteOne({
          user: req.user._id,
          targetType: 'comment',
          post: null,
          comment: comment._id
        })

        return res.status(400).json({
          status: false,
          message: 'Komentar tidak dapat diberi like'
        })
      }

      return res.status(200).json({
        status: true,
        message: 'Komentar berhasil disukai',
        liked: true,
        likesCount: updatedComment.likesCount
      })
    } catch (error) {
      if (error && error.code === 11000) {
        const currentComment =
          await Comment.findById(
            comment._id
          ).select('likesCount')

        return res.status(200).json({
          status: true,
          message: 'Komentar sudah disukai',
          liked: true,
          likesCount: currentComment
            ? currentComment.likesCount
            : comment.likesCount
        })
      }

      throw error
    }
  } catch (error) {
    console.error('COMMENT_LIKE_ERROR:', error)

    if (!res.headersSent) {
      return res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan pada server'
      })
    }
  }
}