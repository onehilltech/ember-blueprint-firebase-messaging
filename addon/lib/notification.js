function wrapAndCall (target, name, override) {
  const orig = target[name];

  target[name] = function () {
    // Replace the current _super method with the one for this message.
    let _super = this._super;
    this._super = orig;

    // Call the overridden method.
    override.call (this, ...arguments);

    // Restore the original super method.
    this._super = _super;
  }
}

function applyDecorator (target, name, descriptor, options = {}) {


  wrapAndCall (target, 'activate', function () {
    let listener = descriptor.value.bind (this);
    let when = (options.when || function () { return true; }).bind (this);

    wrapAndCall (target, 'deactivate', function () {
      // Pass control to the base class, the remove the listener.
      this._super.call (this, ...arguments);
      this.messaging.removeMessageListener (listener);
    });

    // Pass control to the base class, then add the listener.
    this._super.call (this, ...arguments);
    this.messaging.addMessageListener (listener, { when });
  });
}

export default function (target, name, descriptor) {
  if (descriptor) {
    return applyDecorator (target, name, descriptor);
  }
  else {
    let options = target;

    return function (target, name, descriptor) {
      return applyDecorator (target, name, descriptor, options);
    }
  }
}
