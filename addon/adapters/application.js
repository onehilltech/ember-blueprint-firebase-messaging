import RESTAdapter from '@ember-data/adapter/rest';
import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';
import { isPresent } from '@ember/utils';
import { tracked } from "@glimmer/tracking";

export default class ApplicationAdapter extends RESTAdapter {
  @service
  session;

  @tracked
  _host;

  get host () {
    if (isPresent (this._host)) {
      return this._host;
    }
    else {
      const ENV = getOwner (this).resolveRegistration ('config:environment');
      const { firebase } = ENV;

      return firebase.baseUrl;
    }
  }

  set host (value) {
    this._host = value;
  }

  get headers () {
    let accessToken = this.session.accessToken;

    return {
      Authorization: `Bearer ${accessToken.toString ()}`
    };
  }
}
