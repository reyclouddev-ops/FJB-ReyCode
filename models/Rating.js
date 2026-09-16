const mongoose = require('mongoose')

const ratingSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PostFjb',
      required: true,
      index: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      required: true,
      index: true
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating harus berupa angka bulat 1-5'
      }
    },

    review: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: ''
    },

    status: {
      type: String,
      enum: [
        'active',
        'hidden',
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
    },

    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'ratings'
  }
)

ratingSchema.index(
  {
    post: 1,
    user: 1
  },
  {
    unique: true
  }
)

ratingSchema.index({
  post: 1,
  status: 1,
  createdAt: -1
})

ratingSchema.index({
  user: 1,
  createdAt: -1
})

ratingSchema.pre('validate', async function(next) {
  if (!this.post || !this.user) {
    return next()
  }

  if (this.isModified('post') || this.isModified('user')) {
    const Post = mongoose.models.PostFjb

    if (Post) {
      const post = await Post.findById(this.post).select('author')

      if (
        post &&
        post.author &&
        post.author.toString() === this.user.toString()
      ) {
        return next(
          new Error('User tidak dapat memberikan rating pada post miliknya sendiri')
        )
      }
    }
  }

  next()
})

module.exports =
  mongoose.models.RatingFjb ||
  mongoose.model('RatingFjb', ratingSchema)