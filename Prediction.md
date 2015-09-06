# Introduction #

The client samples the keyboard inputs and sends them as fast as possible to the server through the network. Once received, the command is queues and processed when the scheduled simulation step occurs. Periodically the server publishes the new world state to clients. The client collects the world state and perform an interpolation before displaying it.

This results in a latency between the user interaction and the visual feedback. This latency is completely removed by the the client side prediction.

# Latency #
Let's try to evaluate the worst cast turn around time between a key stroke and the visual feedback.

First latency chain that goes from the physical keystroke to the javascript event, and on from the javascript event DOM edition to the screen update. I performed raw measure with camera am evaluated and average the delay of 2/60 seconds = 33 ms from keystroke to screen update.

```
worst_case_latency = keyboard_latency + network_latency  + sv_tick_period_ms * sv_update_tick 
                   + network_latency + cl_interp_delay_ms 
worst_case_latency ~= 33 + 10 + 30 * 2 + 10 + 120 = 233 ms
```

# Who does the work ? #
The client side prediction consists in updating every entity controlled by the player locally on the client, thus it is no longer necessary to  wait for the server to get a visual feedback. The prediction simulation starts with the last known world state update, then applies every user input that have not yet been applied to this snapshot.

Consequently the sampled inputs are immediately applied locally, and the visual feedback no longer suffer a delay.

# Implementation #
First the client accumulates the user input samples into a queue, in order to be able to replay them later.
Then the server snapshot has to contain the last simulated input number, so that the client is able to simulate the subsequent recorded input.

# Inconsistencies #
The client does not have access to the same information as the server when performing the simulation. The server have the latest world state and every players input at disposal. Consequently the simulation result for the prediction and the server differ. That is not a issue, the client state will be overwritten when an new world update is received.