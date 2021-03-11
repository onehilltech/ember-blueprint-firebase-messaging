import ApplicationAdapter from './application';

export default class FirebaseDeviceAdapter extends ApplicationAdapter {
  pathForType () {
    return 'devices';
  }
}
