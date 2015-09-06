## Introduction ##
The client receives update of the game state every 60 milliseconds (`sv_update_tick=2 & sv_tick_period_ms=30`). If the objects of the board were rendered only at these positions, the animation would look bumpy and jittery.

<a href='http://www.youtube.com/watch?feature=player_embedded&v=EcbfGad_G34' target='_blank'><img src='http://img.youtube.com/vi/EcbfGad_G34/0.jpg' width='336' height=200 /></a>

The interpolation system aims at smoothly animate the object between two received snapshots, and compensate the low server update frequency. It also protects against the snapshot reception rate jittering due to congestion and re-transmission.

Note that the connection between the client and the server is implemented over a web-socket which relies on TCP. Lost packet will be re-emitted at the expense of snapshot regularity.

## How does it work? ##
The trick consists in rendering frames between two snapshot received in the past rather that considering only the last received snapshot. Every object position and state is interpolated between its respective position and state in the two snapshots.

This mechanism is only implemented by `InterpolatorSystem` in [bomberman.js client](http://code.google.com/p/nuclear-bomberman/source/browse/public/bomberman.js).

Snapshots received by the client are stored in a random access queue. Every snapshot contains the new position of the world's object and  `round_time` the time elapsed since the begging of the round. By default snapshot are send ever 2 simulation ticks (`sv_update_tick:2`), and the simulation tick occurs every 20 milliseconds (`sv_tick_period_ms:30`).

When a frame is rendered the client evaluates the current round time `round_time`, that is to say the time elapsed since the beginning of the round. The round start time `t0` is the  time at which the client received the very first snapshot. In addition the time is shifted back to 20 ms (`cl_interp_delay_ms:120`); this way even if one snapshot is late there are always tow snapshot to interpolate between.
```
round_time = Date.now() - t0;
interpolation_time = round_time  - cl_interp_delay_ms;
```

Then the queue is scanned to find the snapshots with round time just before (`state_0`)and just after (`state_1`) the previously computed `interpolation_time`. The `interpolation_coef` goes from 0 to 1. When `c` equals 0 then the interpolation result is `state_0`, and when c equals 1 then the result should equals `state_1`.
```
interpolation_coef = (interpolation_time - state_0.t) / (state_1.t - state_0.t)
```

If the client runs out of snapshot in the history queue because of networking problem, then the interpolation is disabled and the last received snapshot is displayed as is. There is not extrapolation implemented.

The snapshots of the queue older than `state_0` can be discarded without regret.

## Object specific interpolation ##
The position of every mutable entity in the game (bomb, crate, opponents avatars), except the predicted entities (local player avatar and its bombs) are interpolated. The position and state are interpolated given two object states and the `interpolation_coef`. Unfortunately the linear interpolation is straightforward, but does not behave well on  avatar direction change. The function softens the entity path and causes the sprite to slide over corners whereas it should always run in the middle of a row or a column.

<a href='http://www.youtube.com/watch?feature=player_embedded&v=xuPWlS30WHM' target='_blank'><img src='http://img.youtube.com/vi/xuPWlS30WHM/0.jpg' width='350' height=300 /></a>

The avatar interpolation function produces a path from the start position to the end position conforming to the game rules. It is made of a horizontal and a vertical segment, travelled at constant speed. When the snapshot rate is low, the avatar may run through wall or crate. It occurs when the interpolation function inverts the horizontal and the vertical path. This could be solved allowing the interpolation function to perform collision check, but this situation never occurs with the default snapshot rate.

<a href='http://www.youtube.com/watch?feature=player_embedded&v=GilBknJNT28' target='_blank'><img src='http://img.youtube.com/vi/GilBknJNT28/0.jpg' width='350' height=300 /></a>

## Entity creation and destruction ##

The entities of `state_0` are interpolated and rendered for each frame, until the interpolation time `interpolation_time` become greater of equal to `state_1.t`. Then `state_1` becomes `state_0` and entities may spawn or disappear. As of today the only interpolated entities are opponents avatar, but the bomb position will be interpolated when the kick power-up become available. The entities that are not interpolated are rendered according to `state_0`.

## Transients ##

The only entities rendered by the client are the one that exist on server side when the snapshot is emitted. Therefore short-lived objects may appear and disappear even before a snapshot is emitted, and consequently never be sent to the client. [Temporary entities](TemporaryEntities.md) are for transient object and one-off effects.

## Artificial latency ##

The entity interpolation causes constant view latency between an event occurrence on the server and it's replication on the client.
```
worst_case_latency = sv_tick_period_ms * sv_update_tick + network_latency + cl_interp_delay_ms 
worst_case_latency ~= 30 * 2 + 10 + 120 = 190 ms
```
The network configuration is a matter of trade-off. Reducing `sv_tick_period_ms * sv_update_tick ` decrease the latency but increases the snapshot rate and the network load. When  `cl_interp_delay_ms` is decreased, the client is more likely to run out of snapshot and the animation becomes jittery.

## Related reading ##
  * https://developer.valvesoftware.com/wiki/Interpolation