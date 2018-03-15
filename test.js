const assume = require('assume');
const bcrypt = require('bcrypt');
const nconf = require('nconf');
const authboot = require('./');

describe('authboot.test', function () {

  function setupApp(opts = { config: {} }) {
    const app = new Map();
    app.config = new nconf.Provider(opts.config);
    return app;
  }

  let app;
  beforeEach(function () {
    app = setupApp();
  });

  it('should setup middleware and lookup functions on authboot namespace on app object', function (done) {
    authboot()(app, {}, (err) => {
      assume(err).is.falsey();
      assume(app.authboot.middleware).is.a('function');
      assume(app.authboot.lookup).is.a('function');

      done();
    });
  });

  it('should return an error in the callback if challenge and realm are not both defined together', function (done) {
    authboot({ challenge: true })(app, {}, (err) => {
      assume(err).is.truthy();
      done();
    });
  });

  it('should handle a custom lookup function', function (done) {
    authboot({
      lookup: ({ name, password }, callback) => {
        callback(null, 'foo');
      }
    })(app, {}, (err) => {
      assume(err).is.falsey();
      assume(app.authboot.middleware).is.a('function');
      assume(app.authboot.lookup).is.a('function');

      app.authboot.lookup({}, (_, res) => {
        assume(res).equals('foo')
        done();
      });
    });
  });

  it('app.authboot.lookup by default should correctly validate from user object', function(done) {
    const password = 'huh';
    bcrypt.hash(password, 10, (err, hash) => {
      assume(err).is.falsey();
      authboot({ users: { what: hash  }})(app, {}, (err) => {
        assume(err).is.falsey();
        assume(app.authboot.middleware).is.a('function');
        assume(app.authboot.lookup).is.a('function');

        app.authboot.lookup({ name: 'what', password: 'huh' }, (err, valid) => {
          assume(err).is.falsey();
          assume(valid).is.truthy();
          done();
        });
      });
    });
  });
});
