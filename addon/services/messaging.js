/* global firebase */

import Service from '@ember/service';
import { inject as service } from '@ember/service';
import { local } from '@onehilltech/ember-cli-storage';
import { getOwner } from '@ember/application';
import { isNone, isPresent } from '@ember/utils';
import { A } from '@ember/array';
import { action } from '@ember/object';

const SERVICE_WORKER_SCOPE = '/ember-blueprint-firebase-messaging';

export default class MessagingService extends Service {
  _serviceImpl = null;

  init () {
    super.init (...arguments);

    // Create the correct platform strategy for the service, and the configure the
    // platform strategy.
    const ENV = getOwner (this).resolveRegistration ('config:environment');
    this._serviceImpl = isNone (ENV.CORBER) || ENV.CORBER === false ? new WebPlatformImpl (this) : new HybridPlatformImpl (this);

    Promise.resolve (this._serviceImpl.configure (ENV.firebase))
      .then (() => {
        // Let's make sure we register for changes to the session state.
        this.session.addListener (this);

        // Now, if we are already signed in, we need to register the device token.
        this.registerToken ();
      });
  }

  destroy () {
    super.destroy (...arguments);

    this.session.removeListener (this);
  }

  @service
  session;

  @service
  store;

  @local ({name: 'firebase.device', serialize: JSON.stringify, deserialize: JSON.parse})
  _device;

  get device () {
    let json = this._device;

    if (isNone (json)) {
      return null;
    }

    let device = this.store.peekRecord ('firebase-device', json.id);

    if (isPresent (device)) {
      return device;
    }

    // There is no account model for this user. Let's create one and return it to
    // the caller.

    let data = this.store.normalize ('firebase-device', json);
    data.data.id = json.id
    return this.store.push (data);
  }

  set device (value) {
    this._device = value;
  }

  _messaging;

  get isRegistered () {
    return isPresent (this._device);
  }

  getToken () {
    return this._serviceWorkerRegistrationPromise.then (registration => {
      const ENV = getOwner (this).resolveRegistration ('config:environment');
      const { firebase: firebaseConfig } = ENV;

      return this._messaging.getToken ({serviceWorkerRegistration: registration, vapidKey: firebaseConfig.vapidKey});
    });
  }

  didSignIn () {
    this.registerToken ();
  }

  willSignOut () {

  }

  didSignOut () {
    this._resetDevice ();
  }

  _resetDevice () {
    this.device.deleteRecord ();
    this.device = null;
  }

  /**
   * Register a token with the backend server.
   *
   * @returns {*}
   */
  registerToken () {
    if (this.session.isSignedOut) {
      return;
    }

    return this._serviceImpl.getToken ()
      .then (token => {
        if (isNone (token)) {
          return;
        }

        let device = this.device;

        if (isPresent (device)) {
          // We have already registered this device with the server. Let's make sure
          // the token is the most recent token. If not, then we need to send the new
          // token to the server.

          if (device.token !== token) {
            device.token = token;
          }
        }
        else {
          // We have not registered the device. We need to create a new device object,
          // and send to the server. We need to make sure to save the returned model to
          // local storage.

          device = this.store.createRecord ('firebase-device', { token });
        }

        console.log ('Registering push notification token with the server.');
        return device.save ();
      })
      .then (device => {
        if (isPresent (device)) {
          this.device = device.toJSON ({includeId: true});
        }
      })
      .catch (reason => {
        if (isPresent (reason.errors)) {
          const [ error ] = reason.errors;

          if (error.status === '403') {
            // The device we have on record is not our device. We need to delete the local
            // record, clear the cache, and register the device again.
            this._resetDevice ();
            return this.registerToken ();
          }
        }
      })
  }

  /**
   * Refresh the messaging token with the server.
   *
   * @param token       The messaging token.
   */
  refreshToken (token) {
    let device = this.device;

    if (isPresent (device) && device.token !== token) {
      device.token = token;
      device.save ().then (() => true);
    }
    else {
      return Promise.resolve (false);
    }
  }

  /**
   * Add a message listener.
   *
   * @param callback
   * @param options
   */
  addMessageListener (callback, options) {
    let listener = new OnMessageListener (callback, options);
    (this._onMessageListeners = this._onMessageListeners || A ()).pushObject (listener);
  }

  /**
   * Remove a message listener.
   *
   * @param callback
   */
  removeMessageListener (callback) {
    let listener = this.onMessageListeners.findBy ('listener', callback);

    if (isPresent (listener)) {
      this.onMessageListeners.removeObject (listener);
    }
  }

  /**
   * Get the registered message listeners.
   *
   * @returns {*}
   */
  get onMessageListeners () {
    return this._onMessageListeners || A ();
  }

  _onMessageListeners;

  onMessage (message) {
    console.log (message);
    this.onMessageListeners.forEach (listener => listener.onMessage (message));
  }

  onError (error) {
    console.error (error);
  }
}

/**
 * @class Wrapper class for registered listeners.
 */
class OnMessageListener {
  constructor (listener, options) {
    this.listener = listener;
    this.when = options.when;
    this.preprocess = options.preprocess;
  }

  onMessage (message) {
    let msg = this.preprocess (message);

    if (this.when (msg)) {
      this.listener (msg);
    }
  }
}

/**
 * The base strategy for the different platforms.
 */
class PlatformImpl {
  constructor (service) {
    this.service = service;
  }

  getToken () {
    return Promise.resolve (null);
  }
}

/**
 * The platform strategy for web browsers.
 */
class WebPlatformImpl extends PlatformImpl {
  constructor (service) {
    super (service);
  }

  _serviceWorkerRegistrationPromise = null;

  config = null;

  configure (config) {
    this.config = config;

    this._configureFirebase (config.config);
    this._configureServiceWorker (config.config);
  }

  getToken () {
    return this._serviceWorkerRegistrationPromise.then (registration => this._messaging.getToken ({serviceWorkerRegistration: registration, vapidKey: this.config.vapidKey}));
  }

  _configureServiceWorker (config) {
    const query = encodeURIComponent (JSON.stringify (config));
    const scriptUrl = `${SERVICE_WORKER_SCOPE}/firebase-messaging-sw.js?config=${query}`;

    this._serviceWorkerRegistrationPromise = navigator.serviceWorker.getRegistration (SERVICE_WORKER_SCOPE)
      .then (serviceWorkerRegistration => isPresent (serviceWorkerRegistration) ? serviceWorkerRegistration : navigator.serviceWorker.register (scriptUrl));
  }

  _configureFirebase (config) {
    // Let's initialize the Firebase framework.
    firebase.initializeApp (config);
    firebase.analytics ();

    // Get our instance of the messaging framework.
    this._messaging = firebase.messaging ();
    this._messaging.onMessage ((payload) => this.service.onMessage (payload));
  }
}

/**
 * @class HybridPlatformImpl
 *
 * The hybrid platform implementation of the messaging service.
 */
class HybridPlatformImpl extends PlatformImpl {
  constructor (service) {
    super (service);
  }

  @service('ember-cordova/events')
  cordovaEvents;

  configure () {
    let cordovaEvents = getOwner (this.service).lookup ('service:ember-cordova/events');
    cordovaEvents.on ('deviceready', this, 'onDeviceReady');
  }

  @action
  onDeviceReady () {
    // The device is ready. We need to check if the user has given us permission to
    // receive push notifications. If so, then we can register the token with the
    // server, and listen for messages. If not, we need to request permission.

    this.hasPermission ()
      .then (hasPermission => hasPermission ? hasPermission : this.grantPermission ())
      .then (hasPermission => {
        if (hasPermission) {
          return this.service.registerToken ()
            .then (() => {
              // We now need to listen for refresh token events from the platform.
              window.FirebasePlugin.onTokenRefresh (this.onTokenRefresh.bind (this));

              // We can now listen for notifications.
              this.listenForNotifications ();
            });
        }
        else {
          console.log ('The user has not granted permission for push notifications.');
        }
      })
      .catch (reason => console.error (reason));
  }

  hasPermission () {
    console.log ('Checking if we have permission for push notifications.');
    return new Promise ((resolve, reject) => window.FirebasePlugin.hasPermission (resolve, reject));
  }

  grantPermission () {
    console.log ('Requesting permission to receive push notificiations.');
    return new Promise ((resolve, reject) => window.FirebasePlugin.grantPermission (resolve, reject));
  }

  getToken () {
    return new Promise ((resolve, reject) => {
      if (window.FirebasePlugin) {
        window.FirebasePlugin.getToken (resolve, reject);
      }
      else {
        resolve (null);
      }
    });
  }

  /**
   * Refresh the message token with the server.
   *
   * @param token
   */
  onTokenRefresh (token) {
    this.service.refreshToken (token);
  }

  listenForNotifications () {
    console.log ('Listening for push notification messages');
    window.FirebasePlugin.onMessageReceived (message => this.service.onMessage (message), error => this.service.onError (error));
  }
}
