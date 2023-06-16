'use strict';

module.exports = function(/* environment, appConfig */) {
  const { CAPACITOR_BUILD } = process.env;
  return { CAPACITOR_BUILD: !!CAPACITOR_BUILD };
};
