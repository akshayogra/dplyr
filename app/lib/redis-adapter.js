// Generated by CoffeeScript 1.7.1
'use strict';
var RedisAdapter, helpers;

helpers = require('./mopidy.js');

RedisAdapter = (function() {
  function RedisAdapter(redis, prefix) {
    if (prefix == null) {
      prefix = '';
    }
    this.redis = redis;
    this.prefix = prefix;
  }

  RedisAdapter.prototype.key = function() {
    var args;
    args = [];
    args.push.apply(args, arguments);
    args = args.join(':');
    return "" + this.prefix + args;
  };

  RedisAdapter.prototype.getTracks = function(uris, done) {
    var gotTracks;
    if (!uris.length) {
      return done(null, []);
    }
    gotTracks = (function(_this) {
      return function(err, tracks) {
        var track;
        if (err) {
          return done(err);
        }
        if (!tracks) {
          return done(null, []);
        }
        tracks = (function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = tracks.length; _i < _len; _i++) {
            track = tracks[_i];
            _results.push(JSON.parse(track));
          }
          return _results;
        })();
        done(null, tracks);
        uris = tracks = null;
      };
    })(this);
    this.redis.hmget(this.key('tracks'), uris, gotTracks);
    return this;
  };

  RedisAdapter.prototype.voteTrack = function(track, clientId, done) {
    var onExec, previous;
    onExec = function(err) {
      done(err);
    };
    previous = track.previous;
    helpers.cleanTrack(track);
    track.updated = Date.now();
    track.previous = previous || 0;
    this.redis.multi().hset(this.key('tracks'), track.uri, JSON.stringify(track)).hset(this.key('votes', track.uri), clientId, 1).zrem(this.key('pool'), track.uri).sadd(this.key('voted'), track.uri).exec(onExec);
    return this;
  };

  RedisAdapter.prototype.downvoteTrack = function(track, clientId, done) {
    var onExec, previous;
    onExec = function(err) {
      done(err);
    };
    previous = track.previous;
    helpers.cleanTrack(track);
    track.updated = Date.now();
    track.previous = previous;
    this.redis.multi().hset(this.key('tracks'), track.uri, JSON.stringify(track)).hset(this.key('votes', track.uri), clientId, -1).zrem(this.key('pool'), track.uri).sadd(this.key('voted'), track.uri).exec(onExec);
    return this;
  };

  RedisAdapter.prototype.getVotes = function(tracks, done) {
    var gotVotes, multi, track, _i, _len;
    gotVotes = function(err, results) {
      var client, index, total, track, val, votes, _i, _len;
      if (err) {
        return done(err);
      }
      if (!results) {
        return done(null, tracks);
      }
      for (index = _i = 0, _len = results.length; _i < _len; index = ++_i) {
        votes = results[index];
        track = tracks[index];
        if (!votes) {
          track.votes = 0;
          track.votesHash = {};
          continue;
        }
        total = 0;
        for (client in votes) {
          val = votes[client];
          total += +val;
        }
        track.votes = total;
        track.votesHash = votes;
      }
      done(null, tracks);
      track = tracks = null;
    };
    multi = this.redis.multi();
    for (_i = 0, _len = tracks.length; _i < _len; _i++) {
      track = tracks[_i];
      multi.hgetall(this.key('votes', track.uri));
    }
    multi.exec(gotVotes);
    return this;
  };

  RedisAdapter.prototype.resetTrack = function(track, done) {
    var gotVotes, onExec;
    gotVotes = (function(_this) {
      return function(err) {
        var previous, votes, votesHash;
        if (err) {
          return done(err);
        }
        if ('number' !== typeof track.votes) {
          return done();
        }
        votesHash = track.votesHash;
        votes = track.votes;
        previous = track.previous;
        helpers.cleanTrack(track);
        track.updated = Date.now();
        track.previous = previous || 0;
        if (votesHash && 0 < Object.keys(votesHash).length) {
          track.previous = votes;
        }
        _this.redis.multi().hset(_this.key('tracks'), track.uri, JSON.stringify(track)).del(_this.key('votes', track.uri)).srem(_this.key('voted'), track.uri).zadd(_this.key('pool'), track.previous, track.uri).exec(onExec);
        track = null;
      };
    })(this);
    onExec = function(err) {
      return done(err);
    };
    this.getVotes([track], gotVotes);
    return this;
  };

  RedisAdapter.prototype.setPooledVotes = function(track, votes, done) {
    var gotTracks;
    gotTracks = (function(_this) {
      return function(err, tracks) {
        if (err) {
          return done(err);
        }
        track = tracks[0];
        if (!track) {
          return done();
        }
        track.previous = votes;
        return _this.redis.multi().hset(_this.key('tracks'), track.uri, JSON.stringify(track)).zadd(_this.key('pool'), +votes, track.uri).exec(function(err) {
          return done(err);
        });
      };
    })(this);
    this.getTracks([track.uri], gotTracks);
    return this;
  };

  RedisAdapter.prototype.removeTrack = function(track, done) {
    var onExec;
    onExec = function(err) {
      return done(err);
    };
    this.redis.multi().hdel(this.key('tracks'), track.uri).del(this.key('votes', track.uri)).srem(this.key('voted'), track.uri).zrem(this.key('pool'), track.uri).exec(onExec);
    return this;
  };

  RedisAdapter.prototype.getQueue = function(length, done) {
    var gotPool, gotTracks, gotVotes, s;
    s = {
      votes: {}
    };
    this.redis.smembers(this.key('voted'), (function(_this) {
      return function(err, uris) {
        if (err) {
          return done(err);
        }
        s.uris = uris;
        if (length > uris.length) {
          return _this.redis.zrevrange(_this.key('pool'), 0, length - uris.length - 1, 'WITHSCORES', gotPool);
        } else {
          return gotPool(null, []);
        }
      };
    })(this));
    gotPool = (function(_this) {
      return function(err, poolUris) {
        var index, uri, _i, _len;
        if (err) {
          return done(err);
        }
        s.votes = {};
        for (index = _i = 0, _len = poolUris.length; _i < _len; index = _i += 2) {
          uri = poolUris[index];
          s.votes[uri] = poolUris[index + 1];
          s.uris.push(uri);
        }
        _this.getTracks(s.uris, gotTracks);
      };
    })(this);
    gotTracks = (function(_this) {
      return function(err, tracks) {
        if (err) {
          return done(err);
        }
        s.tracks = tracks;
        _this.getVotes(s.tracks, gotVotes);
      };
    })(this);
    gotVotes = (function(_this) {
      return function(err) {
        var track, _i, _len, _ref;
        if (err) {
          return done(err);
        }
        _ref = s.tracks;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          track = _ref[_i];
          if ('number' !== typeof track.votes) {
            track.votes = 0;
          }
        }
        s.tracks.sort(function(a, b) {
          if (a.votes === b.votes) {
            return a.updated - b.updated;
          }
          return b.votes - a.votes;
        });
        done(null, s.tracks);
        s = null;
      };
    })(this);
    return this;
  };

  return RedisAdapter;

})();

module.exports = RedisAdapter;
