// Generated by CoffeeScript 1.12.7
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

  RedisAdapter.SORT_FN = function(a, b) {
    if (a.votes === b.votes) {
      return a.updated - b.updated;
    }
    return b.votes - a.votes;
  };

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
          var i, len, results1;
          results1 = [];
          for (i = 0, len = tracks.length; i < len; i++) {
            track = tracks[i];
            results1.push(JSON.parse(track));
          }
          return results1;
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
    var gotVotes, i, len, multi, track;
    gotVotes = function(err, results) {
      var client, i, index, len, total, track, val, votes;
      if (err) {
        return done(err);
      }
      if (!results) {
        return done(null, tracks);
      }
      for (index = i = 0, len = results.length; i < len; index = ++i) {
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
    for (i = 0, len = tracks.length; i < len; i++) {
      track = tracks[i];
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
        _this.redis.multi().hset(_this.key('tracks'), track.uri, JSON.stringify(track)).del(_this.key('votes', track.uri)).srem(_this.key('voted'), track.uri).zadd(_this.key('pool'), "" + track.previous, track.uri).exec(onExec);
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
    var gotPool, gotPoolTracks, gotTracks, gotVotes, s;
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
          return _this.redis.zrevrange(_this.key('pool'), 0, -1, 'WITHSCORES', gotPool);
        } else {
          return gotPool(null, []);
        }
      };
    })(this));
    gotPool = (function(_this) {
      return function(err, poolUris) {
        var i, index, len, toFetch, uri;
        if (err) {
          return done(err);
        }
        s.votes = {};
        toFetch = [];
        for (index = i = 0, len = poolUris.length; i < len; index = i += 2) {
          uri = poolUris[index];
          s.votes[uri] = poolUris[index + 1];
          toFetch.push(uri);
        }
        if (0 < toFetch.length) {
          _this.getTracks(toFetch, gotPoolTracks);
        } else {
          s.poolTracks = [];
          _this.getTracks(s.uris, gotTracks);
        }
      };
    })(this);
    gotPoolTracks = (function(_this) {
      return function(err, poolTracks) {
        var i, len, track;
        if (err) {
          return done(err);
        }
        for (i = 0, len = poolTracks.length; i < len; i++) {
          track = poolTracks[i];
          track.votes = s.votes[track.uri];
        }
        poolTracks = poolTracks.sort(RedisAdapter.SORT_FN).slice(0, length - s.uris.length);
        s.poolTracks = poolTracks;
        _this.getTracks(s.uris, gotTracks);
      };
    })(this);
    gotTracks = (function(_this) {
      return function(err, tracks) {
        var ref;
        if (err) {
          return done(err);
        }
        s.tracks = tracks;
        (ref = s.tracks).push.apply(ref, s.poolTracks);
        _this.getVotes(s.tracks, gotVotes);
      };
    })(this);
    gotVotes = (function(_this) {
      return function(err) {
        var i, len, ref, track;
        if (err) {
          return done(err);
        }
        ref = s.tracks;
        for (i = 0, len = ref.length; i < len; i++) {
          track = ref[i];
          if ('number' !== typeof track.votes) {
            track.votes = 0;
          }
        }
        s.tracks.sort(RedisAdapter.SORT_FN);
        done(null, s.tracks);
        s = null;
      };
    })(this);
    return this;
  };

  return RedisAdapter;

})();

module.exports = RedisAdapter;
