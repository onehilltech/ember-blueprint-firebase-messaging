import Route from '@ember/routing/route';
import { authenticated } from "ember-cli-gatekeeper";

@authenticated
export default class IndexRoute extends Route {
  setupController (controller, model) {
    super.setupController (controller, model);

    this.messaging.onMessage ((message) => console.log (message));
  }
}
