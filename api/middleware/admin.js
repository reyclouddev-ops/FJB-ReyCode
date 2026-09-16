const auth = require('./auth')

async function admin(req, res, next) {
  return auth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({
        status: false,
        message: 'Belum login'
      })
    }

    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'developer'
    ) {
      return res.status(403).json({
        status: false,
        message: 'Akses hanya untuk Admin'
      })
    }

    req.isAdmin = true

    return next()
  })
}

module.exports = admin