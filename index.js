const crypto = require('crypto');
const authMiddleware = require('express-basic-auth-safe');
const debug = require('diagnostics')('authboot');

module.exports = function (opts = {}) {
  return function (app, options = {}, callback) {
    const users = new Map(
      Object.entries(opts.users
        || options.users
        || app.config.get('auth:users')
        || {}
      )
    );

    const realm = opts.realm
      || options.realm
      || app.config.get('auth:realm');

    const challenge = opts.challenge
      || options.challenge
      || app.config.get('auth:challenge');

    const unauthorizedResponse = opts.unauthorizedResponse
      || options.unauthorizedResponse
      || app.config.get('auth:unauthorizedResponse')
      || { error: 'Not authorized' }

    const lookupOpt = typeof opts.lookup === 'function' ? opts.lookup : null;

    if (challenge && !realm) {
      return callback(new Error('authboot requires a specified realm if a challenge request will be sent.'));
    }

    app.authboot = {};
    const lookup = app.authboot.lookup = (lookupOpt || function ({ name, password }, callback) {
      const pass = users.get(name);
      if (!compare(pass, password)) {
        debug('Invalid password for valid username %s', name);
        const error = new Error('Invalid password for given username');
        error.status = 401;
        return callback(error);
      }
      return callback(null, true);
    })
    app.authboot.middleware = authMiddleware({
      authorizer: (name, password, cb) => lookup({ name, password }, cb),
      unauthorizedResponse,
      authorizeAsync: true,
      realm
    });

    callback();
  }
};

function compare(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch(ex) {
    return false;
  }
}
