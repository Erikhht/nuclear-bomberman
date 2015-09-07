# nuclear-bomberman
**Automatically exported from https://code.google.com/p/nuclear-bomberman/**

![](https://code.google.com/p/nuclear-bomberman/logo?cct=1352560047)

## Multiplayer arcade in a web browser written in javascript
... it is well suited for lan party idle times.
Ten players can play at the same time and no installation required. The game-play is straight forward: drop a bomb, run like hell and watch you back.

**Nuclear Bomberman** is a spare time project started on June 2012 with the intent to practice canvas and websockets. It appeared quickly that the major development effort resides in the avatar maneuverability and the multiplayer code: interpolation, client side prediction,  delta compression, temporary entities.

[Articles on the multiplayer game code are available in the wiki](https://github.com/Erikhht/nuclear-bomberman/blob/wiki/Introduction.md)

<hr />
<a href='http://www.youtube.com/watch?feature=player_embedded&v=ER1LWV2Bg2Q' target='_blank'><img src='http://img.youtube.com/vi/ER1LWV2Bg2Q/0.jpg' width='380' height=300 /></a><br>

<hr />

## Try it !
The server run on nodejs, the client is compatible with Chrome and Firefox.

- [Download the lastest server package](https://github.com/Erikhht/nuclear-bomberman/releases/latest)
- Unzip
- Start <code>nodejs server.js</code>
- Use a Chrome or Firefox to connect an play

## v0.2 released (january 2012)
- Server default port changed to 8080
- Windows specific material removed>
- Fix display bug caused by <a href='http://trac.webkit.org/changeset/131131'>http://trac.webkit.org/changeset/131131</a><br>

## v0.1 released (november 2012)
As of today **the game works well** and is played frequently.

The server run on nodejs, the client is compatible with Chrome and Firefox.

<hr />

See also: <a href='http://code.google.com/p/space-chronicles/'>Space Chronicles</a>
