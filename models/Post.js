const mongoose = require('mongoose')

const postImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['image', 'video'],
      default: 'image'
    }
  },
  {
    _id: false
  }
)

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: ['post', 'product'],
      default: 'post',
      index: true
    },

    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ''
    },

    content: {
      type: String,
      trim: true,
      maxlength: 10000,
      required: true
    },

    images: {
      type: [postImageSchema],
      default: []
    },

    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
      index: true
    },

    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },

    subcategory: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },

    price: {
      type: Number,
      min: 0,
      default: null
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'IDR'
    },

    stock: {
      type: Number,
      min: 0,
      default: null
    },

    likesCount: {
      type: Number,
      min: 0,
      default: 0
    },

    commentsCount: {
      type: Number,
      min: 0,
      default: 0
    },

    ratingsCount: {
      type: Number,
      min: 0,
      default: 0
    },

    ratingAverage: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },

    status: {
      type: String,
      enum: [
        'active',
        'hidden',
        'pending',
        'rejected',
        'deleted'
      ],
      default: 'active',
      index: true
    },

    moderationReason: {
      type: String,
      default: null,
      maxlength: 500
    },

    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      default: null
    },

    moderatedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'posts'
  }
)

postSchema.index({
  author: 1,
  createdAt: -1
})

postSchema.index({
  visibility: 1,
  status: 1,
  createdAt: -1
})

postSchema.index({
  category: 1,
  subcategory: 1,
  createdAt: -1
})

postSchema.index({
  type: 1,
  createdAt: -1
})

module.exports =
  mongoose.models.PostFjb ||
  mongoose.model('PostFjb', postSchema)