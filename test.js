const assume = require('assume');
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
    authboot({ users: { what: 'huh' }})(app, {}, (err) => {
      assume(err).is.falsey();
      assume(app.authboot.middleware).is.a('function');
      assume(app.authboot.lookup).is.a('function');

      app.authboot.lookup({ name: 'what', password: 'huh' }, (err, valid) => {
        assume(err).is.falsey();
        assume(valid).is.truthy();
        done();
      });
    })
  });

  describe('authboot.compare', function () {
    it('should properly compare two strings in constant time', function () {
      let d = process.hrtime()
      authboot.compare('foo', 'bar');
      let one = process.hrtime(d);

      let dd = process.hrtime();
      authboot.compare('whatthehellinthename', 'hatthehellinthexame');
      let two = process.hrtime(dd);

      assume(one[0]).equals(two[0]);
    });
  });
});
