# Introduction #

Nuclear bomberman is a multi-player game where ten player avatars struggle for life in an arena. The game runs on a dedicated server. Each player connects the server with a regular browser such as Chrome or Firefox. No installation is required on client side; all the necessary asserts are downloaded the first time the game is launched.

The server runs on top of nodejs and can be started on every operating system supported by this infrastructure. This wiki contains the necessary information to play the game, customize it,  by adding maps and also learn to write you own multiplayer game.

## Multiplayer overview ##

The networking implementation of this game is inspired by the articles available freely on the web. This wiki is intended to provide a comprehensive view of a subset of the mechanisms required to make something that work.

Everything starts when a network where clients connected to the server. Once the connection is established, the client sends and receives messages from the server. There is no message sent by a client to a client.
![http://wiki.nuclear-bomberman.googlecode.com/hg/ClientServerNetwork.png](http://wiki.nuclear-bomberman.googlecode.com/hg/ClientServerNetwork.png)

The server runs all the game logic and publishes snapshot periodically. It is authoritative about the world simulation, and has always the last word on the games state. The client collects and sends the user inputs to the server. It receive world state snapshot and render audio and video to the player.

![http://wiki.nuclear-bomberman.googlecode.com/hg/ClientServerMessages.png](http://wiki.nuclear-bomberman.googlecode.com/hg/ClientServerMessages.png)

### Client to server messages ###
So the client samples input and sends the input messages as fast as possible (every 16ms ~= 60fps) to the server. Here is a typical input message:
```
{slot:"slot1", id:103, e:17, u:1, d:2}
```
  * **slot**: is the player identifier. There can be up to three player sharing a single keyboard on a client and all their input are multiplexed through a single connection thanks to this piece of information.
  * **id**: is a unique identifier of the command for a given slot. It is incremented for each new input send by the client, and used by the server to acknowledge input. Input acknowledgement is part of [client prediction system](Prediction.md) introduced later on.
  * **e**: is the duration in millisecond of the input sampling. It is used by the server to compute the amount of displacement of the player avatar.
  * **u, d, l, r, f**: are set when the up, down, left, right or fire key is pressed. It is set to 1 when the key has just been pressed during the sampling and 2 when the key was pressed before and continues to be down.

There is no timestamp in this message because the server does not need to know when the input has been issued. This is intended. The client samples inputs, and push them immediately to the server. Once received, the server updates immediately the current server game state.

### Server to client messages ###

On the other side, the server process inputs as they arrives, and periodically (every 60ms) send back world snapshot to all clients.
```
{ t:91223, acks:{ slot1:83 }, delta:{}, temporaryEntities:[] }
```
  * **t**: server round time. It is the time elapsed in millisecond since the beginning of the round. It is always a multiple of the server snapshot period. This field is part of the [interpolation system](Interpolation.md).
  * **acks**: object that contains the identifier (a.k.a. id) of the last input received and processed by the server at the snapshot emission time. This field is part of the [client prediction system](Prediction.md) introduced later on.
  * **delta**: compressed new world state. Given that walls position and state never change it is not necessary to send everything in every message. Entities whose the position and state is the same as in the previous sent snapshot are omitted. This part of the [delta compression](DeltaCompression.md) introduced later on.
  * **temporaryEntities**: special entities like flame blast, exploding crated or sound effect. These entities are not involved in the simulation, they are not interpolated, and their life time can be shorter than the snapshot period without risking not to be transmitted to the client.

### Are things that simple? ###
The client can be considered as a terminal that render the world according to the update received by the server, and forwards the input to the server. And the server simply run the game simulation, taking into account received inputs and publishing shapshot periodically. Unfortunately there is a network in-between, that is limited in bandwidth and that slow down the information propagation.

#### Need to reduce the turnaround times ####
The typical network latency on an LAN is below 6 ms, and below 12 ms on WLAN. This latency induces a lack of responsiveness if not handled properly.
Here is the sequence of event that occurs between a keystroke and the feedback to the user when no client side prediction is done:
  1. A key is pressed by the user
  1. A new frame is rendered (occurs every 17ms)
    * the key press is detected
    * a message is sent by the client to the server
  1. The message is received by the server
    * the game state is updated consequently
  1. The server send a snapshot of the world state to the clients (occurs every 60ms)
  1. The client receives the snapshot and updates the local state
  1. A new frame is rendered (occurs every 17ms)
```

The average latency is: 8.5+6+30+6+8.5 = 59ms
The worst cast latency is: 17+6+60+6+17 = 106ms```
When everything is put together, the delay within the input and the visual feedback can goes up to 106ms. The player have to wait the much befor to see its changes applied to it avatar. 106 ms is not that much but it is clearly perceptible, and makes it difficult to run and the gameplay becomes sticky.<br>
<a href='Prediction.md'>Client side prediction</a> is intended to minimize the perceived reactivity of the player controlled entities.</li></ul>

<h4>Need to smoothen the world animation ####
The server published the world state every 60ms whereas frames are rendered every 16ms. There is less server updates then rendered frames, consequently a given game state is used by four consecutive frame. This situation makes the animation choppy and the visual feedback suffers the network jittering if any.<br>
<a href='Interpolation.md'>Interpolation</a> is intended to produce smooth animations in-between the server snapshots.<br>
<br>
<h3>Are things that complicated?</h3>
Finally, most of the network code is located in the client. The server is two times smaller than the client.<br>
<br>
<ul><li><b>Client is made of ~800 LOC</b>
<ul><li>Delta compression: ~10 LOC<br>
</li><li>Prediction system: ~120 LOC<br>
</li><li>Interpolation system: ~70 LOC<br>
</li><li>Interpolation function: ~40 LOC<br>
</li><li>Rendering: ~150 LOC<br>
</li><li>General logic and UI: ~370 LOC<br>
</li></ul></li><li><b>Server is made of ~400 LOC</b>
<ul><li>Delta compression: 50 LOC<br>
</li></ul></li><li><b>Shared gameplay code is made of ~346 LOC</b></li></ul>

The multiplayer network technologies (prediction, interpolation and compression) consists in a tiny 16% of the 1550 lines of code that make this game.