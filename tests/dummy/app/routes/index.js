import Route from '@ember/routing/route';
import { authenticated } from "ember-cli-gatekeeper";
import { notification } from 'ember-blueprint-firebase-messaging';

@authenticated
export default class IndexRoute extends Route {
  @notification
  doSomething (message) {
    console.log (message);
  }
}
