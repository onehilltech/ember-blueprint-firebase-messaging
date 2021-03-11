import Service, { inject as service } from '@ember/service';
import fetch from 'fetch';

export default class PushService extends Service {
  @service
  session;

  push () {
    const accessToken = this.session.accessToken;

    return fetch ('http://localhost:8080/push', {
      method: 'post',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  }
}
