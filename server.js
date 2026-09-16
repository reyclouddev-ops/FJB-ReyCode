const express = require('express')
const path = require('path')

const registerHandler = require('./api/auth/register')
const loginHandler = require('./api/auth/login')
const meHandler = require('./api/auth/me')
const logoutHandler = require('./api/auth/logout')

const createPostHandler = require('./api/posts/create')
const listPostsHandler = require('./api/posts/list')
const postDetailHandler = require('./api/posts/detail')
const updatePostHandler = require('./api/posts/update')
const deletePostHandler = require('./api/posts/delete')
const likePostHandler = require('./api/posts/like')

const createCommentHandler = require('./api/comments/create')
const listCommentsHandler = require('./api/comments/list')
const deleteCommentHandler = require('./api/comments/delete')
const likeCommentHandler = require('./api/comments/like')

const toggleFollowHandler = require('./api/follows/toggle')
const listFollowHandler = require('./api/follows/list')

const createRatingHandler = require('./api/ratings/create')
const listRatingHandler = require('./api/ratings/list')

const createReportHandler = require('./api/reports/create')
const listReportHandler = require('./api/reports/list')
const reportActionHandler = require('./api/reports/action')

const resellerApplyHandler = require('./api/reseller/apply')
const resellerListHandler = require('./api/reseller/list')
const resellerActionHandler = require('./api/reseller/action')
const profileDetailHandler = require('./api/profile/detail')
const profileUpdateHandler = require('./api/profile/update')
const robotSecurityHandler = require('./api/security/robot')
// Admin Audit. 
const adminUsersHandler = require('./api/admin/users')
const adminPostsHandler = require('./api/admin/posts')
const adminDashboardHandler = require('./api/admin/dashboard')

const app = express()

const PORT = process.env.PORT || 3000

app.disable('x-powered-by')

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

app.use(express.static(path.join(__dirname, 'public')))

app.all('/api/auth/register', registerHandler)
app.all('/api/auth/login', loginHandler)
app.all('/api/auth/me', meHandler)
app.all('/api/auth/logout', logoutHandler)

app.all('/api/posts/create', createPostHandler)
app.all('/api/posts/list', listPostsHandler)
app.all('/api/posts/detail', postDetailHandler)
app.all('/api/posts/update', updatePostHandler)
app.all('/api/posts/delete', deletePostHandler)
app.all('/api/posts/like', likePostHandler)

app.all('/api/comments/create', createCommentHandler)
app.all('/api/comments/list', listCommentsHandler)
app.all('/api/comments/delete', deleteCommentHandler)
app.all('/api/comments/like', likeCommentHandler)

app.all('/api/follows/toggle', toggleFollowHandler)
app.all('/api/follows/list', listFollowHandler)

app.all('/api/ratings/create', createRatingHandler)
app.all('/api/ratings/list', listRatingHandler)

app.all('/api/reports/create', createReportHandler)
app.all('/api/reports/list', listReportHandler)
app.all('/api/reports/action', reportActionHandler)

app.all('/api/reseller/apply', resellerApplyHandler)
app.all('/api/reseller/list', resellerListHandler)
app.all('/api/reseller/action', resellerActionHandler)
app.all('/api/profile/detail', profileDetailHandler)
app.all('/api/profile/update', profileUpdateHandler)
app.all('/api/security/robot', robotSecurityHandler)
// Admin Audit. 
app.all('/api/admin/users', adminUsersHandler)
app.all('/api/admin/posts', adminPostsHandler)
app.all('/api/admin/dashboard', adminDashboardHandler)

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: true,
    service: 'Forum FJB ReyCode',
    database: 'userfjb',
    message: 'API online'
  })
})

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      status: false,
      message: 'Endpoint tidak ditemukan'
    })
  }

  return res.sendFile(
    path.join(__dirname, 'public', 'index.html')
  )
})

app.use((error, req, res, next) => {
  console.error('SERVER_ERROR:', error)

  if (res.headersSent) {
    return next(error)
  }

  return res.status(500).json({
    status: false,
    message: 'Terjadi kesalahan pada server'
  })
})

app.listen(PORT, () => {
  console.log(`Forum FJB ReyCode berjalan di port ${PORT}`)
})