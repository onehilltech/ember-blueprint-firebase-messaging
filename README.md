ember-blueprint-firebase-messaging
==============================================================================

An add-on for integrating Firebase Messaging into your Ember App


Installation
------------------------------------------------------------------------------

```
ember install ember-blueprint-firebase-messaging
```


Configuration
------------------------------------------------------------------------------

### Application Configuration

Set the `firebase.baseUrl` property in `configs/environment.js`. This url points to 
the mounting point for the main router from 
[@onehilltech/blueprint-firebase-messaging](https://github.com/onehilltech/blueprint/tree/master/packages/blueprint-firebase-messaging/app/routers/v1).

```javascript
module.exports = function (environment) {
  let ENV = {
    // ...
    
    firebase: {
      baseUrl: `http://localhost:8080/firebase`
    }
  };
  
  // ...
}
```

### Capacitor Mobile Apps

You must set the environment variable `CAPACITOR_BUILD=true` when you build your EmberJS
application for capacitor (see [ember-cli-capacitor](https://github.com/shipshapecode/ember-cli-capacitor)).
If you don't set the `CAPACITOR_BUILD` environment variable, then this add-on will
not integrate properly into your capacitor application.

> `CAPACITOR_BUILD` is automatically added to `configs/environment.js`.

Device Token Registration
------------------------------------------------------------------------------

The device tokens are automatically registered with the backend server when
a user signs in to a gatekeeper session. Also, the device token is removed
from the server when a user signs out of their current gatekeeper session.


License
------------------------------------------------------------------------------

This project is licensed under the [Apache-2.0](LICENSE.md).
