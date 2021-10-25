import RESTAdapter from 'ember-cli-gatekeeper/-lib/user/adapters/rest';
import { inject as service } from '@ember/service';

/**
 * @class ApplicationAdapter
 *
 * The base adapter for all adapters in the Firebase project.
 */
export default class ApplicationAdapter extends RESTAdapter {
  @service
  firebase;

  get host () {
    return this.firebase.baseUrl;
  }
}
