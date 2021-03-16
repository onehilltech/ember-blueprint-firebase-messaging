/* global firebase */

import Service from '@ember/service';
import { inject as service } from '@ember/service';
import { local } from '@onehilltech/ember-cli-storage';
import { getOwner } from '@ember/application';
import { isNone, isPresent } from '@ember/utils';
import { A } from '@ember/array';

const SERVICE_WORKER_SCOPE = './ember-blueprint-firebase-messaging';

export default class MessagingService extends Service {
  _serviceWorkerRegistrationPromise;

  init () {
    super.init (...arguments);

    const ENV = getOwner (this).resolveRegistration ('config:environment');
    const { firebase: firebaseConfig } = ENV;

    this._configureServiceWorker (firebaseConfig.config);
    this._configureFirebase (firebaseConfig.config);

    // Let's make sure we are registered for
    this.session.addListener (this);
  }

  destroy () {
    super.destroy (...arguments);

    this.session.removeListener (this);
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
    this._messaging.onMessage (this._onMessageHandler.bind (this));

    if (this.session.isSignedIn) {
      this._registerToken ();
    }
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
    this._registerToken ();
  }

  didSignOut () {
    this.device.deleteRecord ();
    this.device = null;
  }

  /**
   * Register the device token with the backend server.
   * 
   * @returns {*}
   * @private
   */
  _registerToken () {
    return this.getToken ()
      .then (token => {
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

        return device.save ();
      })
      .then (device => {
        // Cache the device information for later usage.
        this.device = device.toJSON ({includeId: true});

        // Return the registered device.
        return device;
      });
  }

  /**
   * Add a message listener.
   *
   * @param callback
   * @param options
   */
  addMessageListener (callback, options) {
    const { when } = options;

    let listener = new OnMessageListener (callback, when);
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

  _onMessageHandler (message) {
    this.onMessageListeners.forEach (listener => listener.onMessage (message));
  }
}

/**
 * @class Wrapper class for registered listeners.
 */
class OnMessageListener {
  constructor (listener, when) {
    this.listener = listener;
    this.when = when;
  }

  onMessage (message) {
    if (this.when (message)) {
      this.listener (message);
    }
  }
}
