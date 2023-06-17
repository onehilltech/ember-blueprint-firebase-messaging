import ApplicationSerializer from './application';
import { dasherize } from '@ember/string';

export default class FirebaseDeviceSerializer extends ApplicationSerializer {
  payloadKeyFromModelName(modelName) {
    return dasherize (modelName);
  }
}
