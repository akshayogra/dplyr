// Generated by CoffeeScript 1.9.3
var Mopidy, helpers;

Mopidy = require('mopidy');

helpers = require('../lib/mopidy.js');

module.exports = function(app, done) {
  var mopidy, onceOnline;
  mopidy = new Mopidy({
    webSocketUrl: app.set('mopidy ws')
  });
  app.set('mopidy', mopidy);
  onceOnline = function() {
    return mopidy.playback.stop(true).then(mopidy.tracklist.clear(), helpers.onError).then(mopidy.tracklist.setConsume(true), helpers.onError).then(mopidy.tracklist.setRandom(false), helpers.onError).then(mopidy.tracklist.setRepeat(false), helpers.onError).then(mopidy.tracklist.setSingle(false), helpers.onError).then(done, helpers.onError);
  };
  return mopidy.once('state:online', onceOnline);
};
