// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts ('https://www.gstatic.com/firebasejs/8.2.10/firebase-app.js');
importScripts ('https://www.gstatic.com/firebasejs/8.2.10/firebase-messaging.js');

self.addEventListener ('install', () => {
  // Get the Firebase configuration from the query param.
  let config = new URL (location).searchParams.get ('config');
  config = JSON.parse (decodeURIComponent (config));

  // Initialize the Firebase application.
  firebase.initializeApp (config);
  const messaging = firebase.messaging ();

  messaging.onBackgroundMessage (payload => {
    console.log (payload);
  });
});

