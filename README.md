# authboot

[![Build Status](https://travis-ci.org/warehouseai/authboot.svg?branch=master)](https://travis-ci.org/warehouseai/authboot)

A simple [`slay`][slay] preboot that initializes an `authboot` namespaced `lookup` function
and `middeware` on the app object to be used within the application. Its meant
to wrap up some configuration conventions to be more easily reused in multiple
slay applications without duplicating code unnecessarily.

The purpose of this library is to simply wrap an auth middleware (currently basic-auth based)
and give a mechanism for async validation of that auth. We support
properties of `express-basic-auth` as configuration. The `lookup` function
replaces the authorizer function with a slightly tweaked API which we will cover
below.

## install

```sh
npm install authboot --save
```

## API

### `users` - Object

The `users` object we give contains assumptions if you are not passing in your
own `lookup` function. Those assumptions is that that each `key` must be the
username for your authorized users while the value must be a [`hexidecimal`][hexidecimal] encoding of the [`sha256`][sha256] hash of the password. This ensures we are following security best practices even
when this information is loaded in memory from an encrypted config.

### `lookup({ name, password }, callback)`

Function to override the default behavior of using the `users` object as
a direct comparison map for who is authorized and using the provided algorithm to
compare the given password with the `hash` we have stored as part of the `users`
object.

### `challenge` Boolean

Indicating whether we will send a challenge response for browser based requests.

### `realm` String

The realm given for the service for browser storage of basic auth.

### `algorithm` String

The algorithm given to `crypto` when creating a `hash`.

## usage

### Example #1
```js
// root slay preboot in preboots/index.js or preboots.js

module.exports = function (app, opts, callback) {
  app.preboot(require('authboot')({
    users: {
      name: 'hexOfSHA256HashOfPassword'
    },
    // send challenge request for browser auth
    challenge: true,
    realm: 'myservicerealm'
  }));

  callback();
};
```

```js
// middlewares/index.js or middlewares.js

module.exports = function (app, options, callback) {
  // add the middleware itself to the app object when you setup all your other
  // middlewares. If its not going to be used across the board for all routes,
  // this would be setup in each route handler or on the router itself.
  app.use(app.authboot.middleware);
};

```

### Example #2
```js
const db = require('./db');
const verify = require('./verify');

// root slay preboot in preboots/index.js or preboots.js

module.exports = function (app, opts, callback) {
  app.preboot(require('authboot')({
    // override lookup with our own async lookup
    lookup: ({ user, password }, callback) => {
      db.users.get(user, (err, user) => {
        if (err) return callback(err);
        verify.password(user.passwordHash, password, callback);
      });
    },
    // send challenge request for browser auth
    challenge: true,
    realm: 'myservicerealm'
  }));

  callback();
};
```

```js
// routes/index.js or routes.js
const db = require('./db');

module.exports = function (app, options, callback) {
  app.routes.get('/resource', app.authboot.middleware, (req, res, next) => {
    // authed route
    db.resource.get(req.params, (err, resource) => {
      if (err) return next(err);
      res.status(200).json(resource);
    })
  });
};

```

## test

```sh
npm test
```

[slay]: https://github.com/godaddy/slay
[hexidecimal]: https://en.wikipedia.org/wiki/Hexadecimal#Transfer_encoding
[sha256]: https://en.wikipedia.org/wiki/Secure_Hash_Algorithms#Comparison_of_SHA_functions
