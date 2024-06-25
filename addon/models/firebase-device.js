import Model, { attr, belongsTo } from '@ember-data/model';

export default class FirebaseDeviceModel extends Model {
  @belongsTo({serialize: false})
  account;

  @attr
  token;

  @attr('boolean')
  enabled;

  toJSON () {
    return  {
      id: this.id,
      account: this.belongsTo ('account').id (),
      token: this.token,
      enabled: this.enabled
    }
  }
}
