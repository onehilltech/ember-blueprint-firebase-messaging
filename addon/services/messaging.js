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
    const { CORBER, firebase } = getOwner (this).resolveRegistration ('config:environment');
    this._serviceImpl = isNone (CORBER) || CORBER === false ? new WebPlatformImpl (this) : new HybridPlatformImpl (this);

    Promise.resolve (this._serviceImpl.configure (firebase)).then (() => {
      // Let's make sure we register for changes to the session state.
      this.session.addListener (this);
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

  didSignIn () {
    this.registerToken ();
  }

  willSignOut () {

  }

  didSignOut () {
    this._resetDevice ();
  }

  /**
   * Register a token with the backend server.
   *
   * @returns {*}
   */
  registerToken () {
    return this._serviceImpl.getToken ().then (token => this._handleFirebaseToken (token));
  }

  /**
   * Refresh the messaging token with the server.
   *
   * @param token       The messaging token.
   */
  refreshToken (token) {
    this._handleFirebaseToken (token);
  }

  /**
   * Reset the device model in the application.
   *
   * @private
   */
  _resetDevice () {
    this.device.deleteRecord ();
    this.device = undefined;
  }

  /**
   * Handle processing of a firebase token.
   *
   * @param token
   * @returns {*}
   * @private
   */
  _handleFirebaseToken (token) {
    function shouldRetryRegistration (reason) {
      const [ error ] = reason.errors;
      const { code, status } = error;

      return status === '404' || code === 'invalid_owner';
    }

    if (isNone (token)) {
      return null;
    }

    if (this.session.isSignedOut) {
      return null;
    }

    let device = this.device;

    if (isPresent (device)) {
      // We have already registered this device with the server. Let's make sure
      // the token is the most recent token. If not, then we need to send the new
      // token to the server.

      device.token = token;

      console.log ('registering push notification token with the server.');
      return device.save ();
    }
    else {
      // We have not registered the device. First, let's try and find the device
      // that matches this token. If we find one, then let's use it. Otherwise,
      // we need to create a new device.
      return this.lookupDeviceByToken (token)
        .then (device => {
          if (isPresent (device)) {
            // Update the token in the existing device.
            device.token = token;
          }
          else {
            // Create a new device model.
            device = this.store.createRecord ('firebase-device', { token });
          }

          console.log ('registering push notification token with the server');
          return device.save ();
        })
        .then (device => {
          // Overwrite the existing device.
          this.device = device.toJSON ({includeId: true});

          return device;
        })
        .catch (reason => {
          console.log ('registration of push notification token failed');

          if (isPresent (reason.errors)) {
            if (shouldRetryRegistration (reason)) {
              // The device we have on record is not our device. We need to delete the local
              // record, clear the cache, and register the device again.
              this._resetDevice ();
              return this._handleFirebaseToken (token);
            }
          }
        });
    }
  }

  lookupDeviceByToken (token) {
    return this.store.queryRecord ('firebase-device', { token });
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

    if (isPresent (config)) {
      this._configureFirebase (config.config);

      if (isPresent (this._messaging)) {
        this._configureServiceWorker (config.config)
      }
    }
  }

  getToken () {
    if (isPresent (this._messaging)) {
      return this._serviceWorkerRegistrationPromise.then (registration => this._messaging.getToken ({serviceWorkerRegistration: registration, vapidKey: this.config.vapidKey}));
    }
    else {
      return Promise.resolve (null);
    }
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

    if (firebase.messaging.isSupported ()) {
      // Get our instance of the messaging framework.
      this._messaging = firebase.messaging ();
      this._messaging.onMessage ((payload) => this.service.onMessage (payload));
    }
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
    console.log ('Requesting permission to receive push notifications.');
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
    console.log ('Listening for push notification messages.');
    window.FirebasePlugin.onMessageReceived (message => this.service.onMessage (message), error => this.service.onError (error));
  }
}
