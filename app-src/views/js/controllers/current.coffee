'use strict'

AppController = require './app.coffee'
Track         = require '../models/track.coffee'

class CurrentController extends AppController
  constructor: (app) ->
    super app, 'current'

    @view     = @dplyr.currentBar
    @interval = null
    @started  = null
    @offset   = null
    @current  = null
    @coverQ   = app.set 'cover queue'

    @app.on 'current:set', (track) =>
      return @clearCurrent() unless track

      track = new Track track
      @setCurrent track

    @app.on 'state:paused', (position) =>
      return @clearCurrent() unless @current

      clearInterval @interval if @interval
      @interval = null
      @setCurrent @current, position

    @app.on 'state:playing', (position) =>
      @init()

    @view.on 'queue:cover', =>
      @coverQ.push track : @current, (err, cover) =>
        return if err or !cover
        @view.setCover cover

    @view.on 'click:vote', =>
      @dnode().current.vote()

    @view.on 'click:downvote', =>
      @dnode().current.downvote()

    @init()

  init: ->
    gotCurrentTrack = (err, track, state, position) =>
      throw err if err
      return @clearCurrent() unless track

      track = new Track track
      @setCurrent track, position

      if 'playing' == state && !@interval
        @interval = setInterval(
          => @updatePosition()
          1000
        )

    @dnode().current.get gotCurrentTrack

    this

  setCurrent: (track, position = 0) ->
    console.log 'SETCURRENT'

    @started = Date.now()
    @offset  = position
    @current = track

    @view.render @current

    @updatePosition()

    this

  updatePosition: ->
    return this unless @current

    now   = Date.now()
    total = @offset + (now - @started)

    percent = (Math.round (total / @current.get('length')) * 1000) / 10
    @view.setPosition percent

    this

  clearCurrent: ->
    clearInterval @interval if @interval
    @interval = null
    @started  = null
    @offset   = null
    @current  = null

    @view.clear()

    this

module.exports = CurrentController