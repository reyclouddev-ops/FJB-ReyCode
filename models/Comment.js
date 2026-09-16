const mongoose = require('mongoose')

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PostFjb',
      required: true,
      index: true
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      required: true,
      index: true
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommentFjb',
      default: null,
      index: true
    },

    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 3000
    },

    likesCount: {
      type: Number,
      min: 0,
      default: 0
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

    deletedAt: {
      type: Date,
      default: null
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'comments'
  }
)

commentSchema.index({
  post: 1,
  createdAt: 1
})

commentSchema.index({
  post: 1,
  parent: 1,
  createdAt: 1
})

commentSchema.index({
  author: 1,
  createdAt: -1
})

module.exports =
  mongoose.models.CommentFjb ||
  mongoose.model('CommentFjb', commentSchema)