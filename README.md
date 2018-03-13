# authboot

A simple [`slay`][slay] preboot that initializes a namespaced `lookup` function
and `middeware` on the app object to be used within the application. Its meant
to wrap up some configuration conventions to be more easily reused in multiple
slay applications without duplicating code unnecessarily.


## install
`npm install authboot --save`

## usage

```js
// root slay preboot in preboots/index.js or preboots.js

module.exports = function (app, opts, callback) {
  app.preboot(require('authboot')({
    users: {
      name: 'password'
    },
    unathorizedResponse: { error: 'Not authorized' },
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

## test

```sh
npm test
```

[slay]: https://github.com/godaddy/slay
