// Generated by CoffeeScript 1.12.7
'use strict';
var MopidyController;

MopidyController = require('../controllers/mopidy.js');

module.exports = function(app) {
  var mopidy;
  mopidy = new MopidyController(app);
  return app.set('mopidy controller', mopidy);
};
