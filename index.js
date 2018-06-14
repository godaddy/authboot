const crypto = require('crypto');
const authMiddleware = require('express-basic-auth-safe');
const debug = require('diagnostics')('authboot');

const coalesce = (concurrency, action) => {
  const trie = new Map();
  function clean(key, value) {
    const guesses = trie.get(key);
    if (!guesses) return;
    guesses.delete(value);
    if (guesses.size === 0) {
      trie.delete(key);
    }
  }
  return (key, value, callback) => {
    if (!trie.has(key)) {
      trie.set(key, new Map());
    }
    const guesses = trie.get(key);
    if (guesses.has(value)) {
      guesses.get(value).push(callback);
      return;
    } else if (guesses.size > concurrency) {
      debug(`brute force check failure for ${key}`);
      return callback(null, false);
    }
    const callbacks = [callback];
    guesses.set(value, callbacks);
    action(value, function () {
      // let bursts drain at same time
      // done over a timeout since calc is sync
      // we don't want .nextTick or setImmediate
      setTimeout(() => {
        clean(key, value);
        callbacks.forEach(callback => {
          callback.apply(null, arguments);
        });
      }, 0);
    });
  };
};

module.exports = function (opts = {}) {
  return function (app, options = {}, callback) {
    const users = new Map(
      Object.entries(opts.users
        || options.users
        || app.config.get('auth:users')
        || {}
      ).map(([name, hash]) => {
        const hashBuffer = Buffer.allocUnsafe(hash.length / 2);
        hashBuffer.write(hash, 0, hashBuffer.length, 'hex');
        return [name, hashBuffer];
      })
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
      || { error: 'Not authorized' };

    const lookupOpt = typeof opts.lookup === 'function' ? opts.lookup : null;

    if (challenge && !realm) {
      return callback(new Error('authboot requires a specified realm if a challenge request will be sent.'));
    }

    if (!users.size && !lookupOpt) {
      return callback(new Error('authboot requires custom lookup function or users object for authentication'));
    }

    app.authboot = {};

    const concurrency = opts.maxAuthConcurrency
      || options.maxAuthConcurrency
      || app.config.get('auth:maxAuthConcurrency')
      || 3;

    const algorithm = opts.algorithm
      || options.algorithm
      || app.config.get('auth:algorithm')
      || 'sha256';

    let checker;
    const lookup = app.authboot.lookup = (lookupOpt || function ({ name, password }, callback) {
      const hashBuffer = users.get(name);
      if (!hashBuffer) {
        debug(`unknown username ${name}`);
        return callback(null, false);
      }
      checker = checker || coalesce(concurrency, (password, done) => {
        const passwordHash = crypto.createHash(algorithm);
        passwordHash.update(password);
        const digest = passwordHash.digest();
        const equal = crypto.timingSafeEqual(digest, hashBuffer);
        done(null, equal);
      });
      checker(name, password, callback);
    });

    app.authboot.middleware = authMiddleware({
      authorizer: (name, password, cb) => lookup({ name, password }, cb),
      unauthorizedResponse,
      authorizeAsync: true,
      challenge,
      realm
    });

    callback();
  };
};
