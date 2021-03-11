import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class IndexController extends Controller {
  @service
  push;

  @action
  doPush () {
    this.push.push ();
  }

  @action
  signOut () {
    this.session.signOut ().then (() => this.replaceRoute ('auth.sign-in'));
  }
}
