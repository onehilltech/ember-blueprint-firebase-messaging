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

const _notificationListeners = A ();

export default class MessagingService extends Service {
  _serviceImpl = null;

  async configure () {
    // Create the correct platform strategy for the service, and configure it.
    const { CAPACITOR_BUILD, firebase } = getOwner (this).resolveRegistration ('config:environment');
    this._serviceImpl = CAPACITOR_BUILD ? new HybridPlatformImpl (this) : new WebPlatformImpl (this);

    // Listen for changing to session.
    this.session.addListener (this);

    await this._serviceImpl.configure (firebase);
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

  async enablePushNotifications (value) {
    // Save the settings to the service since we cannot enable/disable push notifications
    // at the edge. This will also prevent us from unnecessarily sending notifications
    // to devices that are not running in the background.

    const device = this.device;
    device.enabled = value;
    await device.save ();

    // Save our device state locally.
    this.device = device;
  }

  set device (value) {
    this._device = value;
  }

  _messaging;

  get isRegistered () {
    return isPresent (this._device);
  }

  didSignIn () {
    (async () => this.registerToken ())();
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
  async registerToken () {
    return this._serviceImpl.registerToken ();
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
  addNotificationListener (callback, options) {
    const listener = new OnNotificationListener (callback, options);
    _notificationListeners.pushObject (listener);
  }

  /**
   * Remove a message listener.
   *
   * @param callback
   */
  removeNotificationListener (callback) {
    const listener = _notificationListeners.findBy ('listener', callback);

    if (isPresent (listener)) {
      _notificationListeners.removeObject (listener);
    }
  }

  /**
   * Get the registered message listeners.
   *
   * @returns {*}
   */
  get notificationListeners () {
    return _notificationListeners;
  }

  handleNotification (notification) {
    _notificationListeners.forEach (listener => listener.onNotification (notification));
  }

  handleNotificationAction (notification) {
    // Right now, we are always dispatching this to the application
    // onPushNotification () handler.

    const applicationRoute = this.applicationRoute;

    if (isPresent (applicationRoute) && isPresent (applicationRoute.doPushNotification)) {
      applicationRoute.doPushNotification (notification);
    }
  }

  get applicationRoute () {
    if (isPresent (this._applicationRoute)) {
      return this._applicationRoute;
    }

    this._applicationRoute = getOwner (this).lookup ('route:application');
    return this._applicationRoute;
  }

  onError (error) {
    console.error (error);
  }
}

/**
 * @class Wrapper class for registered listeners.
 */
class OnNotificationListener {
  constructor (listener, options) {
    this.listener = listener;
    this.when = options.when;
    this.preprocess = options.preprocess;
  }

  onNotification (notification) {
    const result = this.preprocess (notification);

    if (this.when (result)) {
      this.listener (result);
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

  async configure (config) {
    this.config = config;

    if (isPresent (config)) {
      this._configureFirebase (config.config);

      if (isPresent (this._messaging)) {
        await this._configureServiceWorker (config.config)
      }
    }
  }

  async registerToken () {
    if (!this._messaging) {
      return;
    }

    const registration = await this._serviceWorkerRegistrationPromise;
    const token = await this._messaging.getToken ({serviceWorkerRegistration: registration, vapidKey: this.config.vapidKey});
    await this.service._handleFirebaseToken (token);
  }

  async _configureServiceWorker (config) {
    const query = encodeURIComponent (JSON.stringify (config));
    const scriptUrl = `${SERVICE_WORKER_SCOPE}/firebase-messaging-sw.js?config=${query}`;

    this._serviceWorkerRegistrationPromise = navigator.serviceWorker.getRegistration (SERVICE_WORKER_SCOPE)
    this._serviceWorkerRegistrationPromise.then (registration => isPresent (registration) ? registration : navigator.serviceWorker.register (scriptUrl));
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
    await this.requestPermissionsAndRegister ();
  }

  async requestPermissionsAndRegister () {
    let status = await PushNotifications.checkPermissions ();

    if (status.receive === 'prompt') {
      status = await PushNotifications.requestPermissions ();
    }

    if (status.receive !== 'granted') {
      throw new Error ('The user denied the request for permissions.');
    }

    await this.registerToken ();
  }

  async registerToken () {
    await PushNotifications.register ();
  }

  async registerListeners () {
    await PushNotifications.addListener ('registration', this._registration.bind (this));
    await PushNotifications.addListener ('registrationError', this._registrationError.bind (this));
    await PushNotifications.addListener ('pushNotificationReceived', this._pushNotificationReceived.bind (this));
    await PushNotifications.addListener ('pushNotificationActionPerformed', this._pushNotificationActionPerformed.bind (this));
  }

  _registration (token) {
    this.service._handleFirebaseToken (token.value);
  }

  _registrationError (err) {
    console.error ('registration error: ', err);
  }

  _pushNotificationReceived (notification) {
    this.service.handleNotification (notification);
  }

  _pushNotificationActionPerformed (notification) {
    this.service.handleNotificationAction (notification);
  }
}
