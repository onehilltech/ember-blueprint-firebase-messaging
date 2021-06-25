import RESTAdapter from '@ember-data/adapter/rest';
import { inject as service } from '@ember/service';

export default class ApplicationAdapter extends RESTAdapter {
  @service
  session;

  @service
  firebase;

  get host () {
    return this.firebase.baseUrl;
  }

  get headers () {
    let accessToken = this.session.accessToken;

    return {
      Authorization: `Bearer ${accessToken.toString ()}`
    };
  }
}
