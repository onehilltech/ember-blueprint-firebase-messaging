/* global firebase */

import Service from '@ember/service';
import { inject as service } from '@ember/service';
import { local } from '@onehilltech/ember-cli-storage';
import { getOwner } from '@ember/application';
import { isNone, isPresent } from '@ember/utils';
import { A } from '@ember/array';
import { action } from '@ember/object';

import { PushNotifications } from '@capacitor/push-notifications';

const SERVICE_WORKER_SCOPE = '/ember-blueprint-firebase-messaging';

export default class MessagingService extends Service {
  _serviceImpl = null;

  constructor () {
    super (...arguments);

    // Create the correct platform strategy for the service, and the configure the
    // platform strategy.
    const { capacitor, firebase } = getOwner (this).resolveRegistration ('config:environment');
    this._serviceImpl = isNone (capacitor) || capacitor === false ? new WebPlatformImpl (this) : new HybridPlatformImpl (this);

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
    console.debug ('registering push notification token');
    return this._serviceImpl.getToken ().then (token => this._handleFirebaseToken (token));
  }

  /**
   * Refresh the messaging token with the server.
   *
   * @param token       The messaging token.
   */
  refreshToken (token) {
    console.debug ('refreshing push notification token');
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
  async _handleFirebaseToken (token) {
    function shouldRetryRegistration (reason) {
      const [error] = reason.errors;
      const { code, status } = error;

      return status === '404' || code === 'invalid_owner';
    }

    if (isNone (token)) {
      return null;
    }

    if (this.session.isSignedOut) {
      return null;
    }

    try {
      // Update the device token.
      const device = await this.getDevice (token);
      device.token = token;
      await device.save ();

      // Overwrite the existing device.
      this.device = device.toJSON ({ includeId: true });
    }
    catch (err) {
      console.error (`saving push notification token failed: ${JSON.stringify (err.message)}`);

      if (isPresent (err.errors)) {
        if (shouldRetryRegistration (err)) {
          // The device we have on record is not our device. We need to delete the local
          // record, clear the cache, and register the device again.
          this._resetDevice ();
          return this._handleFirebaseToken (token);
        }
      }
    }
  }

  /**
   * Get the device model. The device model could be local, it could be located on
   * the remote server, or we may need to create a new one.
   *
   * @param token
   * @returns {Promise<unknown>|*}
   */
  async getDevice (token) {
    let device = this.device;

    if (isPresent (device)) {
      return device;
    }

    device = await this.store.queryRecord ('firebase-device', { token });
    return device || this.store.createRecord ('firebase-device', { token });
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
    console.debug (message);
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

  async getToken () {
    if (!this._messaging) {
      return null;
    }

    const registration = await this._serviceWorkerRegistrationPromise;
    return this._messaging.getToken ({serviceWorkerRegistration: registration, vapidKey: this.config.vapidKey});
  }

  _configureServiceWorker (config) {
    const query = encodeURIComponent (JSON.stringify (config));
    const scriptUrl = `${SERVICE_WORKER_SCOPE}/firebase-messaging-sw.js?config=${query}`;

    this._serviceWorkerRegistrationPromise = navigator.serviceWorker.getRegistration (SERVICE_WORKER_SCOPE)
      .then (serviceWorkerRegistration => isPresent (serviceWorkerRegistration) ? serviceWorkerRegistration : navigator.serviceWorker.register (scriptUrl));
  }

  _configureFirebase (config) {
    // Let's initialize the Firebase framework.
    //firebase.initializeApp (config);
    //firebase.analytics ();

    //if (firebase.messaging.isSupported ()) {
    // Get our instance of the messaging framework.
    //this._messaging = firebase.messaging ();
    //this._messaging.onMessage ((payload) => this.service.onMessage (payload));
    //}
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

  async configure () {
    // Register the listeners for the service, and then register the device.
    await this.registerListeners ();
    await this.register ();
  }

  async register () {
    let status = await PushNotifications.checkPermissions ();

    if (status.receive === 'prompt') {
      status = await PushNotifications.requestPermissions ();
    }

    if (status.receive !== 'granted') {
      throw new Error ('The user denied the request for permissions.');
    }

    await PushNotifications.register ();
  }

  async registerListeners () {
    await PushNotifications.addListener ('registration', this._registration.bind (this));
    await PushNotifications.addListener ('registrationError', this._registrationError.bind (this));
    await PushNotifications.addListener ('pushNotificationReceived', this._pushNotificationReceived.bind (this));
    await PushNotifications.addListener ('pushNotificationActionPerformed', this._pushNotificationActionPerformed.bind (this));
  }

  _registration (token) {
    console.info('Registration token: ', token.value);
    this.service.refreshToken (token.value);
  }

  _registrationError (err) {
    console.error('Registration error: ', err.error);
  }

  _pushNotificationReceived (notification) {
    console.log('Push notification received: ', notification);
  }

  _pushNotificationActionPerformed (notification) {
    console.log('Push notification action performed', notification.actionId, notification.inputValue);
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
          // Register the token with the application server.
          this.service.registerToken ();

          // We now need to listen for refresh token events from the platform, and we can
          // listen for push notifications.

          window.FirebasePlugin.onTokenRefresh (this.onTokenRefresh.bind (this));
          this.listenForNotifications ();
        }
      })
      .catch (reason => {
        console.error (reason.message);
      });
  }

  hasPermission () {
    console.debug ('checking if we have permission for push notifications');
    return new Promise ((resolve, reject) => window.FirebasePlugin.hasPermission (resolve, reject));
  }

  grantPermission () {
    console.debug ('requesting permission to receive push notifications');
    return new Promise ((resolve, reject) => window.FirebasePlugin.grantPermission (resolve, reject));
  }

  async getToken () {
    return new Promise (async (resolve, reject) => {
      const listener = await PushNotifications.addListener ('registration', token => {
        resolve (token);
        removeListeners ();
      });

      const errorListener = await PushNotifications.addListener ('registrationError', err => {
        reject (err);
        removeListeners ();
      });


      function removeListeners () {
        listener.remove ();
        errorListener.remove ();
      }

      // Invoke the register method. This will trigger the registration event when the token
      // is available.
      await PushNotifications.register ();
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
    console.debug ('Listening for push notification messages.');
    window.FirebasePlugin.onMessageReceived (message => this.service.onMessage (message), error => this.service.onError (error));
  }
}
