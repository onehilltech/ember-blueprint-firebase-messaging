import Service from '@ember/service';

import { isPresent } from '@ember/utils';
import { getOwner } from '@ember/application';
import { tracked } from "@glimmer/tracking";

export default class FirebaseService extends Service {
  @tracked
  _baseUrl;

  get baseUrl () {
    if (isPresent (this._baseUrl)) {
      return this._baseUrl;
    }
    else {
      const ENV = getOwner (this).resolveRegistration ('config:environment');
      const { firebase } = ENV;

      return firebase.baseUrl;
    }
  }

  set baseUrl (value) {
    this._baseUrl = value;
  }
}
