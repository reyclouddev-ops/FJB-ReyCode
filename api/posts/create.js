const connectDB = require('../db')
const auth = require('../middleware/auth')
const Post = require('../../models/Post')
const User = require('../../models/User')

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
          type:
            item.type === 'video'
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

function isValidVisibility(value) {
  return [
    'public',
    'private'
  ].includes(value)
}

function isValidType(value) {
  return [
    'post',
    'product'
  ].includes(value)
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

    const type = normalizeLowercase(
      body.type || 'post'
    )

    const title = normalizeString(body.title)

    const content = normalizeString(body.content)

    const category = normalizeLowercase(
      body.category
    )

    const subcategory = normalizeLowercase(
      body.subcategory
    )

    const visibility = normalizeLowercase(
      body.visibility || 'public'
    )

    if (!isValidType(type)) {
      return res.status(400).json({
        status: false,
        message: 'Type harus berupa post atau product'
      })
    }

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

    if (!category) {
      return res.status(400).json({
        status: false,
        message: 'Category wajib diisi'
      })
    }

    if (!subcategory) {
      return res.status(400).json({
        status: false,
        message: 'Subcategory wajib diisi'
      })
    }

    if (category.length > 100) {
      return res.status(400).json({
        status: false,
        message: 'Category maksimal 100 karakter'
      })
    }

    if (subcategory.length > 100) {
      return res.status(400).json({
        status: false,
        message: 'Subcategory maksimal 100 karakter'
      })
    }

    if (!isValidVisibility(visibility)) {
      return res.status(400).json({
        status: false,
        message: 'Visibility harus public atau private'
      })
    }

    if (type === 'product' && !title) {
      return res.status(400).json({
        status: false,
        message: 'Title wajib diisi untuk product'
      })
    }

    if (title.length > 200) {
      return res.status(400).json({
        status: false,
        message: 'Title maksimal 200 karakter'
      })
    }

    const images = normalizeImages(
      body.images
    )

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

    let price = null
    let stock = null

    if (type === 'product') {
      price = parseNumber(body.price)
      stock = parseNumber(body.stock)

      if (
        price === null ||
        price < 0
      ) {
        return res.status(400).json({
          status: false,
          message: 'Harga product tidak valid'
        })
      }

      if (
        stock === null ||
        stock < 0 ||
        !Number.isInteger(stock)
      ) {
        return res.status(400).