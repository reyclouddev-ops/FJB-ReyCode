const mongoose = require('mongoose')
const connectDB = require('../db')
const auth = require('../middleware/auth')
const Post = require('../../models/Post')

const MAX_IMAGES = 10

function getBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  return {}
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeLowercase(value) {
  return normalizeString(value).toLowerCase()
}

function normalizeImages(images) {
  if (!Array.isArray(images)) {
    return []
  }

  return images
    .map(item => {
      if (typeof item === 'string') {
        return {
          url: item.trim(),
          type: 'image'
        }
      }

      if (item && typeof item === 'object') {
        return {
          url: normalizeString(item.url),
          type: item.type === 'video'
            ? 'video'
            : 'image'
        }
      }

      return null
    })
    .filter(item => item && item.url)
}

function isValidUrl(url) {
  try {
    const parsed = new URL(url)

    return (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:'
    )
  } catch {
    return false
  }
}

function parseNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  const number = Number(value)

  if (!Number.isFinite(number)) {
    return null
  }

  return number
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

function getPostId(req, body) {
  return String(
    body.id ||
    body.postId ||
    req.query?.id ||
    req.query?.postId ||
    ''
  ).trim()
}

function getPostData(post) {
  return {
    id: post._id,
    author: post.author,
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
    moderationReason: post.moderationReason,
    moderatedBy: post.moderatedBy,
    moderatedAt: post.moderatedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt
  }
}

module.exports = async function handler(req, res) {
  if (
    req.method !== 'PUT' &&
    req.method !== 'PATCH' &&
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

    if (!req.user) {
      return res.status(401).json({
        status: false,
        message: 'Belum login'
      })
    }

    if (req.user.accountStatus !== 'active') {
      return res.status(403).json({
        status: false,
        message: 'Akun tidak aktif'
      })
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
        message: 'Post yang sudah dihapus tidak dapat diedit'
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
        message: 'Anda tidak memiliki akses untuk mengedit post ini'
      })
    }

    const hasField = field =>
      Object.prototype.hasOwnProperty.call(body, field)

    if (hasField('title')) {
      const title = normalizeString(body.title)

      if (title.length > 200) {
        return res.status(400).json({
          status: false,
          message: 'Title maksimal 200 karakter'
        })
      }

      if (
        post.type === 'product' &&
        !title
      ) {
        return res.status(400).json({
          status: false,
          message: 'Title wajib diisi untuk product'
        })
      }

      post.title = title
    }

    if (hasField('content')) {
      const content = normalizeString(body.content)

      if (!content) {
        return res.status(400).json({
          status: false,
          message: 'Content wajib diisi'
        })
      }

      if (content.length > 10000) {
        return res.status(400).json({
          status: false,
          message: 'Content maksimal 10000 karakter'
        })
      }

      post.content = content
    }

    if (hasField('images')) {
      const images = normalizeImages(body.images)

      if (images.length > MAX_IMAGES) {
        return res.status(400).json({
          status: false,
          message: `Maksimal ${MAX_IMAGES} gambar/video`
        })
      }

      for (const image of images) {
        if (!isValidUrl(image.url)) {
          return res.status(400).json({
            status: false,
            message: 'URL gambar/video tidak valid'
          })
        }
      }

      post.images = images
    }

    if (hasField('visibility')) {
      const visibility = normalizeLowercase(
        body.visibility
      )

      if (
        !['public', 'private'].includes(
          visibility
        )
      ) {
        return res.status(400).json({
          status: false,
          message: 'Visibility harus public atau private'
        })
      }

      post.visibility = visibility
    }

    if (hasField('category')) {
      const category = normalizeLowercase(
        body.category
      )

      if (!category) {
        return res.status(400).json({
          status: false,
          message: 'Category wajib diisi'
        })
      }

      if (category.length > 100) {
        return res.status(400).json({
          status: false,
          message: 'Category maksimal 100 karakter'
        })
      }

      post.category = category
    }

    if (hasField('subcategory')) {
      const subcategory = normalizeLowercase(
        body.subcategory
      )

      if (!subcategory) {
        return res.status(400).json({
          status: false,
          message: 'Subcategory wajib diisi'
        })
      }

      if (subcategory.length > 100) {
        return res.status(400).json({
          status: false,
          message: 'Subcategory maksimal 100 karakter'
        })
      }

      post.subcategory = subcategory
    }

    if (hasField('type')) {
      const type = normalizeLowercase(
        body.type
      )

      if (!['post', 'product'].includes(type)) {
        return res.status(400).json({
          status: false,
          message: 'Type harus berupa post atau product'
        })
      }

      if (
        type === 'product' &&
        !post.title
      ) {
        return res.status(400).json({
          status: false,
          message: 'Title wajib diisi untuk product'
        })
      }

      post.type = type
    }

    if (
      hasField('price') ||
      hasField('stock')
    ) {
      if (post.type !== 'product') {
        if (hasField('price')) {
          post.price = null
        }

        if (hasField('stock')) {
          post.stock = null
        }
      } else {
        if (hasField('price')) {
          const price = parseNumber(body.price)

          if (
            price === null ||
            price < 0
          ) {
            return res.status(400).json({
              status: false,
              message: 'Harga product tidak valid'
            })
          }

          post.price = price
        }

        if (hasField('stock')) {
          const stock = parseNumber(body.stock)

          if (
            stock === null ||
            stock < 0 ||
            !Number.isInteger(stock)
          ) {
            return res.status(400).json({
              status: false,
              message: 'Stock product tidak valid'
            })
          }

          post.stock = stock
        }
      }
    }

    if (post.type === 'product') {
      if (!post.title) {
        return res.status(400).json({
          status: false,
          message: 'Title wajib diisi untuk product'
        })
      }

      if (
        post.price === null ||
        post.price < 0
      ) {
        return res.status(400).json({
          status: false,
          message: 'Harga product tidak valid'
        })
      }

      if (
        post.stock === null ||
        post.stock < 0 ||
        !Number.isInteger(post.stock)
      ) {
        return res.status(400).json({
          status: false,
          message: 'Stock product tidak valid'
        })
      }
    } else {
      post.price = null
      post.stock = null
    }

    await post.save()

    return res.status(200).json({
      status: true,
      message: 'Post berhasil diperbarui',
      post: getPostData(post)
    })
  } catch (error) {
    console.error('UPDATE_POST_ERROR:', error)

    if (res.headersSent) {
      return
    }

    if (
      error instanceof mongoose.Error.ValidationError
    ) {
      return res.status(400).json({
        status: false,
        message: 'Data post tidak valid',
        error: error.message
      })
    }

    if (error && error.name === 'CastError') {
      return res.status(400).json({
        status: false,
        message: 'Data post tidak valid'
      })
    }

    return res.status(500).json({
      status: false,
      message: 'Gagal memperbarui post',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined
    })
  }
}
