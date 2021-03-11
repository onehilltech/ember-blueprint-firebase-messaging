'use strict';

module.exports = {
  name: require('./package').name,

  contentFor (type, config) {
    this._super (...arguments);

    let content = [];

    if (type === 'head') {
      if (!process.env.CORBER) {
        content.push ('<script src="https://www.gstatic.com/firebasejs/8.2.10/firebase-app.js"></script>');
        content.push ('<script src="https://www.gstatic.com/firebasejs/8.2.10/firebase-messaging.js"></script>');
        content.push ('<script src="https://www.gstatic.com/firebasejs/8.2.10/firebase-analytics.js"></script>');
      }
    }

    return content;
  }
};
