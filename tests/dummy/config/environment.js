'use strict';

module.exports = function(environment) {
  let ENV = {
    modulePrefix: 'dummy',
    environment,
    rootURL: '/',
    locationType: 'auto',
    EmberENV: {
      FEATURES: {
        // Here you can enable experimental features on an ember canary build
        // e.g. EMBER_NATIVE_DECORATOR_SUPPORT: true
      },
      EXTEND_PROTOTYPES: {
        // Prevent Ember Data from overriding Date.parse.
        Date: false
      }
    },

    APP: {
      // Here you can pass flags/options to your application instance
      // when it is created
    },

    gatekeeper: {
      baseUrl: 'http://localhost:8080/gatekeeper',
      signInRoute: 'auth.sign-in',
      tokenOptions: {
        client_id: '6047eef2cee540ea6b274a94',
        client_secret: 'hybrid'
      }
    },

    firebase: {
      baseUrl: 'http://localhost:8080/v1',
      vapidKey: 'BL1Kk2RWXqIAjBIxO8jxe-XlPkQoRfbMg9Z81wvyrt4ZUAizCixYJDDLEZLsiBvGlBZd-SBr17SUo3wkYs9R7yM',
      config: {
        apiKey: "AIzaSyDATtfiYGc3hLk9IcylJr50fMe-uitgY_I",
        authDomain: "onehilltech.firebaseapp.com",
        projectId: "onehilltech",
        storageBucket: "onehilltech.appspot.com",
        messagingSenderId: "395886461873",
        appId: "1:395886461873:web:c168e5677fce033b4c3390",
        measurementId: "G-PK2689WFLM"
      }
    }
  };

  if (environment === 'development') {
    // ENV.APP.LOG_RESOLVER = true;
    // ENV.APP.LOG_ACTIVE_GENERATION = true;
    // ENV.APP.LOG_TRANSITIONS = true;
    // ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
    // ENV.APP.LOG_VIEW_LOOKUPS = true;
  }

  if (environment === 'test') {
    // Testem prefers this...
    ENV.locationType = 'none';

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;

    ENV.APP.rootElement = '#ember-testing';
    ENV.APP.autoboot = false;
  }

  if (environment === 'production') {
    // here you can enable a production-specific feature
  }

  return ENV;
};
