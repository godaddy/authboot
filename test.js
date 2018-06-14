const assume = require('assume');
const crypto = require('crypto');
const nconf = require('nconf');
const authboot = require('./');

describe('authboot.test', function () {

  const defaultOpts = { users: { what: 'hash' }};

  function setupApp(opts = { config: {}}) {
    const app = new Map();
    app.config = new nconf.Provider(opts.config);
    return app;
  }

  let app;
  beforeEach(function () {
    app = setupApp();
  });

  it('should setup middleware and lookup functions on authboot namespace on app object', function (done) {
    authboot(defaultOpts)(app, {}, (err) => {
      assume(err).is.falsey();
      assume(app.authboot.middleware).is.a('function');
      assume(app.authboot.lookup).is.a('function');

      done();
    });
  });

  it('should return an error in the callback if challenge and realm are not both defined together', function (done) {
    authboot({ challenge: true })(app, {}, (err) => {
      assume(err).is.truthy();
      assume(err.message).includes('realm');
      done();
    });
  });

  it('should return an error in the callback if no users are defined and no lookup function', function (done) {
    authboot()(app, {}, (err) => {
      assume(err).is.truthy();
      assume(err.message).includes('authentication');
      done();
    });
  });
  it('should handle a custom lookup function', function (done) {
    authboot({
      lookup: (_, callback) => {
        callback(null, 'foo');
      }
    })(app, {}, (err) => {
      assume(err).is.falsey();
      assume(app.authboot.middleware).is.a('function');
      assume(app.authboot.lookup).is.a('function');

      app.authboot.lookup({}, (_, res) => {
        assume(res).equals('foo');
        done();
      });
    });
  });

  it('app.authboot.lookup by default should correctly fail on unknown user', function (done) {
    authboot({ users: { what: '00'  }})(app, {}, (err) => {
      assume(err).is.falsey();
      assume(app.authboot.middleware).is.a('function');
      assume(app.authboot.lookup).is.a('function');

      app.authboot.lookup({ name: 'who', password: '00' }, (err, valid) => {
        assume(err).is.falsey();
        assume(valid).is.falsey();
        done();
      });
    });
  });

  it('app.authboot.lookup by default should correctly validate from user object', function (done) {
    const password = 'huh';
    const hash = crypto.createHash('sha256');
    hash.update(password);
    const digest = hash.digest('hex');
    authboot({ users: { what: digest  }})(app, {}, (err) => {
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

  it('app.authboot.lookup by default should coalesce concurrent lookups', function (done) {
    const password = 'huh';
    const hash = crypto.createHash('sha256');
    hash.update(password);
    const digest = hash.digest('hex');
    authboot({ users: { what: digest  }})(app, {}, (err) => {
      assume(err).is.falsey();
      assume(app.authboot.middleware).is.a('function');
      assume(app.authboot.lookup).is.a('function');

      const responses = Array.from({ length: 10 }, () => {
        let f, r;
        const p = new Promise((_f, _r) => {
          f = _f;
          r = _r;
        });
        setTimeout(() => {
          app.authboot.lookup({ name: 'what', password: 'huh' }, (err, valid) => {
            try {
              assume(err).is.falsey();
              assume(valid).is.truthy();
              f();
            } catch (e) {
              r(e);
            }
          });
        }, 0);
        return p;
      });
      Promise.all(responses).then(
        () => done(),
        (e) => done(e)
      );
    });
  });

  it('app.authboot.lookup by default should fail on brute force heuristic', function (done) {
    // default max concurrents is 4
    const password = '5';
    const hash = crypto.createHash('sha256');
    hash.update(password);
    const digest = hash.digest('hex');
    authboot({ users: { what: digest  }})(app, {}, (err) => {
      assume(err).is.falsey();
      assume(app.authboot.middleware).is.a('function');
      assume(app.authboot.lookup).is.a('function');

      const responses = Array.from({ length: 6 }, (_, i) => {
        let f, r;
        const p = new Promise((_f, _r) => {
          f = _f;
          r = _r;
        });
        setTimeout(() => {
          app.authboot.lookup({ name: 'what', password: `${i}` }, (err, valid) => {
            try {
              assume(err).is.falsey();
              assume(valid).is.falsey();
              f();
            } catch (e) {
              r(e);
            }
          });
        }, 0);
        return p;
      });
      responses.push(new Promise(async (f, r) => {
        await Promise.all(responses);
        app.authboot.lookup({ name: 'what', password: '5' }, (err, valid) => {
          try {
            assume(err).is.falsey();
            assume(valid).is.truthy();
            f();
          } catch (e) {
            r(e);
          }
        });
      }));

      Promise.all(responses).then(
        () => done(),
        (e) => done(e)
      );
    });
  });
});
