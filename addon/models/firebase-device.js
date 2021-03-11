import Model, { attr, belongsTo } from '@ember-data/model';

export default class FirebaseDeviceModel extends Model {
  @belongsTo({serialize: false})
  account;

  @attr
  token;
}
