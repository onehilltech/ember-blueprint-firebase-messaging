import RESTAdapter from '@ember-data/adapter/rest';
import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';

export default class ApplicationAdapter extends RESTAdapter {
  @service
  session;

  get host () {
    const ENV = getOwner (this).resolveRegistration ('config:environment');
    const { firebase } = ENV;

    return firebase.baseUrl;
  }

  get headers () {
    let accessToken = this.session.accessToken;

    return {
      Authorization: `Bearer ${accessToken.toString ()}`
    };
  }
}
