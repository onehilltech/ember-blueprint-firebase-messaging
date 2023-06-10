/* eslint-env node */

const { Blueprint } = require ('ember-cli-blueprint-helpers');

module.exports = Blueprint.extend ({
  addons: [
    { name: 'ember-cli-gatekeeper' }
  ],

  async afterInstall () {
    await this._super.call (this, ...arguments);

    // TODO npx cap sync
  }
});
