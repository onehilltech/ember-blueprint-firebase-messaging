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


Handling Push Notifications
------------------------------------------------------------------------------

### Foreground notifications

The `@pushNotification` decorator is used to handle push notifications while the
mobile app is in the foreground. This decorator can be attached to any route in
the Ember app. Here is an example of attaching it to the `IndexRoute`. This approach
is useful if you want to handle push notifications in a target route differently 
from the general notification.

```javascript
// app/routes/index.js

import { pushNotification } from 'ember-blueprint-firebase-messaging';

export default class IndexRoute extends Route {

  // ...
  
  @pushNotification
  doPaymentCompleteNotification (notification) {
    // handle the notification
  }
}
```

### Background notifications

Background notifications are ones received while the app is not in the foreground. 
These notifications typically wake the target mobile application when tapped (this 
will be indicated in the notification). You handle background notifications by 
implementing the `doPushNotification()` on the application route. If you do not
implement the `doPushNotification()` method on the application route, then the
background push notifications will be ignored.

> Background push notifications are only handled after the user taps the notification.


```javascript
// app/routes/application.js

export default class ApplicationRoute extends Route {
  // ...
  
  doPushNotification (notification) {
    // handle the background notification
  }
}
```
