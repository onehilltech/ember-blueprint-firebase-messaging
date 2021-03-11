export function initialize (application) {
  application.inject ('route', 'messaging', 'service:messaging');
}

export default {
  initialize
};
