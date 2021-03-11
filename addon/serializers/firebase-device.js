import ApplicationSerializer from './application';

export default class FirebaseDeviceSerializer extends ApplicationSerializer {
  payloadKeyFromModelName () {
    return 'device';
  }

  modelNameFromPayloadKey () {
    return 'firebase-device';
  }
}
