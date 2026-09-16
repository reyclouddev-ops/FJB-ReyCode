const mongoose = require('mongoose')

const likeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserFjb',
      required: true,
      index: true
    },

    targetType: {
      type: String,
      enum: ['post', 'comment'],
      required: true,
      index: true
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PostFjb',
      default: null,
      index: true
    },

    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommentFjb',
      default: null,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'likes'
  }
)

likeSchema.index(
  {
    user: 1,
    targetType: 1,
    post: 1,
    comment: 1
  },
  {
    unique: true
  }
)

likeSchema.index({
  post: 1,
  createdAt: -1
})

likeSchema.index({
  comment: 1,
  createdAt: -1
})

module.exports =
  mongoose.models.LikeFjb ||
  mongoose.model('LikeFjb', likeSchema)