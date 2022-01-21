/* eslint-env node */

const { Blueprint } = require ('ember-cli-blueprint-helpers');
const ecInstaller   = require ('ember-cordova-installer');

module.exports = Blueprint.extend ({
  addons: [
    { name: 'ember-cli-gatekeeper' }
  ],

  async afterInstall () {
    await this._super.call (this, ...arguments);

    ecInstaller.install ('cordova-plugin-firebasex', this);
  }
});
