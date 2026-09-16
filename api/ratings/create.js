const mongoose = require('mongoose')
const connectDB = require('../db')
const auth = require('../middleware/auth')
const User = require('../../models/User')
const Post = require('../../models/Post')
const Rating = require('../../models/Rating')

function getBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  return {}
}

function getPostId(req, body) {
  return String(
    body.postId ||
    body.id ||
    body.post ||
    req.query?.postId ||
    req.query?.id ||
    req.query?.post ||
    ''
  ).trim()
}

function getRating(body, req) {
  const value =
    body.rating ??
    req.query?.rating

  const rating = Number(value)

  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return null
  }

  return rating
}

function getReview(body, req) {
  return String(
    body.review ??
    req.query?.review ??
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

async function recalculatePostRating(postId) {
  const result = await Rating.aggregate([
    {
      $match: {
        post: new mongoose.Types.ObjectId(postId),
        status: 'active'
      }
    },
    {
      $group: {
        _id: '$post',
        count: {
          $sum: 1
        },
        average: {
          $avg: '$rating'
        }
      }
    }
  ])

  const count =
    result.length > 0
      ? result[0].count
      : 0

  const average =
    result.length > 0
      ? Number(
          Number(
            result[0].average
          ).toFixed(2)
        )
      : 0

  await Post.updateOne(
    {
      _id: postId
    },
    {
      $set: {
        ratingsCount: count,
        ratingAverage: average
      }
    }
  )

  return {
    count,
    average
  }
}

module.exports = async function handler(req, res) {
  if (
    req.method !== 'POST' &&
    req.method !== 'PUT' &&
    req.method !== 'PATCH'
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

    const postId = getPostId(
      req,
      body
    )

    const rating = getRating(
      body,
      req
    )

    const review = getReview(
      body,
      req
    )

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

    if (rating === null) {
      return res.status(400).json({
        status: false,
        message: 'Rating harus berupa angka 1 sampai 5'
      })
    }

    if (review.length > 2000) {
      return res.status(400).json({
        status: false,
        message: 'Review maksimal 2000 karakter'
      })
    }

    const post = await Post.findById(
      postId
    ).select(
      '_id author visibility status title'
    )

    if (!post) {
      return res.status(404).json({
        status: false,
        message: 'Post tidak ditemukan'
      })
    }

    if (post.status !== 'active') {
      return res.status(400).json({
        status: false,
        message: 'Post tidak dapat diberi rating'
      })
    }

    if (
      String(post.author) ===
      String(req.user._id)
    ) {
      return res.status(403).json({
        status: false,
        message: 'Anda tidak dapat memberi rating pada post sendiri'
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
          message: 'Anda tidak dapat memberi rating pada post ini'
        })
      }
    }

    const existingRating =
      await Rating.findOne({
        post: post._id,
        user: req.user._id
      })

    let ratingDocument
    let created = false

    if (existingRating) {
      if (
        existingRating.status === 'deleted'
      ) {
        existingRating.status = 'active'
      }

      existingRating.rating = rating
      existingRating.review = review
      existingRating.deletedAt = null
      existingRating.deletedBy = null

      ratingDocument =
        await existingRating.save()
    } else {
      try {
        ratingDocument =
          await Rating.create({
            post: post._id,
            user: req.user._id,
            rating,
            review,
            status: 'active'
          })

        created = true
      } catch (error) {
        if (
          error &&
          error.code === 11000
        ) {
          ratingDocument =
            await Rating.findOne({
              post: post._id,
              user: req.user._id
            })

          if (!ratingDocument) {
            throw error
          }

          ratingDocument.rating = rating
          ratingDocument.review = review
          ratingDocument.status = 'active'
          ratingDocument.deletedAt = null
          ratingDocument.deletedBy = null

          ratingDocument =
            await ratingDocument.save()
        } else {
          throw error
        }
      }
    }

    const ratingStats =
      await recalculatePostRating(
        post._id
      )

    const user = await User.findById(
      req.user._id
    ).select(
      '_id username avatar role verified resellerStatus'
    )

    return res.status(
      created ? 201 : 200
    ).json({
      status: true,
      message: created
        ? 'Rating berhasil dibuat'
        : 'Rating berhasil diperbarui',
      created,
      rating: {
        id: ratingDocument._id,
        post: ratingDocument.post,
        user: user
          ? {
              id: user._id,
              username: user.username,
              avatar: user.avatar,
              role: user.role,
              verified: user.verified,
              resellerStatus:
                user.resellerStatus
            }
          : null,
        rating: ratingDocument.rating,
        review: ratingDocument.review,
        status: ratingDocument.status,
        createdAt:
          ratingDocument.createdAt,
        updatedAt:
          ratingDocument.updatedAt
      },
      post: {
        id: post._id,
        ratingsCount:
          ratingStats.count,
        ratingAverage:
          ratingStats.average
      }
    })
  } catch (error) {
    console.error(
      'RATING_CREATE_ERROR:',
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