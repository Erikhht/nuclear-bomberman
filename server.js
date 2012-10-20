"use strict";

var settings = {
    maxAvatar:10,
    session:{ key:'sid', secret:'p/01>Hq#*[JL-JM'},
    defaultNames:{slot0:"wilson", slot1:"alic", slot2:"bradley", slot3:"morten", slot4:"melanie", slot5:"ozzie", slot6:"nigel", slot7:"dudley", slot8:"paula", slot9:"adam"}
};

var shared = require("./public/shared.js");
var maps = require("./public/maps");
var connect = require('connect');
var cookie = require('./node_modules/connect/node_modules/cookie');

var app = connect()
    .use(connect.logger())
    .use(connect.cookieParser(settings.session.secret))
    .use(connect.session(settings.session))
    .use(connect.static('public'));

var appSrv = app.listen(process.env.PORT);
var ioSrv = require('socket.io').listen(appSrv);

var endgame_sequence = function () {
    var seq = [];
    var mx = Math.min(shared.mapheight, shared.mapwidth) / 3;
    for (var m = 1; m < mx; m++) {
        for (var i = m; i < shared.mapwidth - m; i++) {
            seq.push(shared.mapwidth * m + i);
        }
        for (i = m + 1; i < shared.mapheight - m; i++) {
            seq.push(shared.mapwidth * i + shared.mapwidth - m - 1);
        }
        for (i = shared.mapwidth - m - 1; i >= m; i--) {
            seq.push(shared.mapwidth * (shared.mapheight - m - 1) + i);
        }
        for (i = shared.mapheight - m - 1; i >= m + 1; i--) {
            seq.push(shared.mapwidth * i + m);
        }
    }
    return seq;
}();


/**
 * This is the game state
 */
var state;

function StateSystem() {
    var current_state;
    this.goto = function (stateCtor) {
        if (current_state) console.log("[state] Exit state %s", current_state.constructor.name);
        if (current_state && current_state.exit) current_state.exit();
        console.log("[state] Enter state %s", stateCtor.name);
        current_state = new stateCtor();
        if (current_state.enter)current_state.enter();
    }
    Object.freeze(this);
}

var stateSystem = new StateSystem();


function StartupState() {
    this.enter = function () {
        state = {
            slots:{
                slot0:{}, slot1:{}, slot2:{}, slot3:{}, slot4:{},
                slot5:{}, slot6:{}, slot7:{}, slot8:{}, slot9:{}
            },
            mapIndex:1
        }
        stateSystem.goto(PrepareState);
    };
}

function PrepareState() {
    this.enter = function () {
        state = {
            state:'prepare',
            slots:state.slots,
            mapIndex:state.mapIndex
        }
        sockets.emit('state', state);
    };
}



function PlayState() {

    function SimulationSystem() {
        var handle;
        this.stop = function () {
            clearInterval(handle);
        };
        this.start = function () {
            var msCount = 0;
            var tickCount = 0;
            var world = {//World is a state decorated with functions
                createEntity:function (key, entity) {
                    state.entities[key] = entity;
                }, destroyEntity:function (key) {
                    delete state.entities[key];
                }, createTemporaryEntity:function (entity) {
                    state.temporaryEntities.push(entity);
                }, burn:function (cell) {
                    if (this.flame[cell] >= state.t) return false; // already burnt this frame
                    this.flame[cell] = state.t;
                    return true;
                }, isburning:function (cell) {
                    return this.flame[cell] >= state.t;
                },
                entities:state.entities,
                flame:new Array(maps.width * maps.height)
            }
            handle = setInterval(function () {
                    // There is no point here at beeing precice regarding the system clock.
                    // I gain repetability with incrementing the round time by the tick period.
                    state.t = msCount += shared.sv_tick_period_ms;
                    tickCount++;
                    world.entities = state.entities;

                    // Display hurry at the end of the round time and reduce the map area
                    if (!state.endGame && state.t > shared.gp_round_time) {
                        state.endGame = tickCount;
                        world.createTemporaryEntity({type:"hurry", ttl:1000});//display HURRY!
                    }
                    if (state.endGame) {
                        var p = tickCount - state.endGame,cell;
                        if (p % shared.gp_endgame_drop_period_tick === 0) {
                            cell = endgame_sequence[p / shared.gp_endgame_drop_period_tick];
                            if (cell) {
                                world.burn(cell); // kill players on this cell if any
                                world.createEntity(cell, {type:"dwall"}); // create a wall & replace the cell content
                            }
                        }
                    }
                    //Simulate every object
                    for (var key in state.entities) {
                        var entity = state.entities[key], onTick = shared.simulateOnTick[entity.type];
                        if (onTick) onTick(state.t, key, entity, world);
                    }
                    // Detect when there is only one player
                    if (!state.end) {
                        var alive = 0;
                        for (var slotName in state.slots) {
                            var avatar = state.entities[slotName];
                            if (avatar && avatar.h < 32) alive++;
                        }
                        if (alive <= 1) state.end = state.t + shared.gp_round_end_duration;
                    } else if (state.t > state.end) stateSystem.goto(PrepareState);


                    // Send periodic snapshot to clients
                    if (tickCount % shared.sv_update_tick === 0) {
                        sockets.emit("state", state);
                        state.temporaryEntities = [];//flush the createTemporaryEntity queue
                    }

                }, shared.sv_tick_period_ms
            );
        }
    }
    var simulationSystem = new SimulationSystem();


    function PackerSystem() {
        var reference;
        var destructiveEq = function (l, r) {
            for (var k in r) {
                if (l[k] !== r[k]) return false;
                delete l[k];
            }
            for (k in l) return false;
            return true;
        }

        var computeObjectDelta = function (ref, value) {
            var delta = {};
            for (var key in value) {
                var p = ref[key], v = value[key];
                if (v === undefined) delete value[key]; // cleanup (no prototype around)
                delete ref[key]; // remining keys he been deleted
                // Handle kee add, kee assigned to undef, basic type switch
                var type_of_v = typeof v;
                if (p === undefined || destructive_eq(p, v) === false) {
                    delta[key] = v;
                }
                // Detect keys in previous dant disapeared in the given value
                for (var key in previous) delta[key] = undefined;
                return delta;
            }
            return  delta;
        }
        this.setReference = function (value) {
            reference = shared.clone();
        }
        this.computeDeltaAndSetReference = function (value) {
            var delta = computeObjectDelta(reference, value);
            reference = shared.clone();
            return delta;
        }
    }
    var packerSystem=new PackerSystem();

    this.enter = function () {
        state = {
            state:'play',
            t:0,
            slots:state.slots,
            mapIndex:state.mapIndex,
            acks:{},
            entities:{},
            temporaryEntities:[]
        }

        simulationSystem.start();

        // Scan the map and collect spawn points coordinates
        var spawnPoints = [];
        var tileProperties = maps.tilesets[0].tileproperties;
        maps.layers[state.mapIndex].data.forEach(function (value, index) {
            if (value === 0) return;
            var prop = tileProperties[value - 1];
            if (!prop) return;
            if (prop.type === "spawn")
                spawnPoints.push(index);
            else //if (prop.type !== "wall")
                state.entities[index] = shared.clone(prop);
        });

        // Spawn avatar for every owned slot
        for (var slotName in state.slots) {
            if (!state.slots[slotName].owner) continue;
            var spawnCell = spawnPoints.splice(Math.floor(Math.random() * spawnPoints), 1)[0];
            state.entities[slotName] = {
                type:"avatar",
                x:spawnCell % maps.width,
                y:Math.floor(spawnCell / maps.width),
                h:0, //facing direction
                rb:shared.gp_ini_bomb_count, //number of bomb
                p:shared.gp_ini_bomb_power, //bomb power
                s:shared.gp_ini_avatar_speed //speed
            }
        }
        sockets.emit('state', state);
    };
    this.exit = function () {
        simulationSystem.stop();
    }
}


/**
 * Hack the authorization process to capture he session identifier cookie into socket.handshake.sid for later use.
 */
ioSrv.set('authorization', function (data, accept) {
    // check if there's a cookie header
    if (data.headers.cookie) {
        // if there is, parse the cookie
        var codedCookies = cookie.parse(data.headers.cookie);
        var clearCookies = connect.utils.parseSignedCookies(codedCookies, settings.session.secret);
        data.sid = clearCookies[settings.session.key];
    } else {
        // if there isn't, turn down the connection with a message
        // and leave the function.
        return accept('No cookie transmitted.', false);
    }
    console.log("[authorization] handshake accepted with sid %s", data.sid);
    // accept the incoming connection
    accept(null, true);
});
var sockets = ioSrv.sockets;

stateSystem.goto(StartupState);

function PlayerCleaner() {
    var timeouts = {};
    this.notifyConnect = function (sid) {
        clearTimeout(timeouts[sid]);
        delete timeouts[sid];
    };
    this.notifyDisconnect = function (sid) {
        console.log("[playercleaner] sid %s disconnection detected, wait %d ms before players disqualification", sid, settings.sv_disconnect_timeout);
        timeouts[sid] = setTimeout(function () {
            delete timeouts[sid];
            // Clear every slot of this sid
            for (var slotName in state.slots) {
                var slot = state.slots[slotName];
                if (slot.owner === sid) {
                    state.slots[slotName] = {};
                }
            }
            console.log("[playercleaner] all players of sid %s are disqualified", sid);
            if (shared.masterSid(state.slots) === undefined) {
                console.log("[playercleaner] all players disconnected, reset the game");
                stateSystem.goto(StartupState);
            }
            sockets.emit('state', state); // tell the others that sid is disqualified
        }, shared.sv_disconnect_timeout);
    }
    Object.seal(this);
}

var playerCleaner = new PlayerCleaner();

sockets.on('connection', function (socket) {
    // get back the sid extracted durring the authorization process
    var sid = socket.handshake.sid;

    // Reset state cleanup on long disconnect
    playerCleaner.notifyConnect(sid);
    socket.on('disconnect', function () {
        playerCleaner.notifyDisconnect(sid);
    });

    // Latency sampling
    var pongStartMs = -1;
    socket.on('ping', function (data) {
        pongStartMs = Date.now();
        socket.emit('pong');
    });

    socket.on('pung', function (data) {
        var latency = Date.now() - pongStartMs;
        console.log("Latency: " + latency + " ms");
    });

    // State prepare events
    socket.on('add_player', function (data) {
        if (state.slots[data.slotName].owner === undefined) {
            state.slots[data.slotName] = {
                owner:sid,
                name:settings.defaultNames[data.slotName]
            }
        }
        sockets.emit('state', state);
    });

    // State prepare events
    socket.on('remove_player', function (data) {
        if (state.slots[data.slotName].owner === sid) {
            state.slots[data.slotName] = {};
        }
        sockets.emit('state', state);
    });


    socket.on('set_player', function (data) {
        var slot = state.slots[data.slotName];
        if (slot.owner !== sid) {
            // Refused: This slot is not owned by the caller
            socket.emit('state', state);
            return;
        }
        slot.name = data.name;
        socket.broadcast.emit('state', state) // update everyone except the caller
    });

    socket.on('set_map', function (data) {
        if (shared.masterSid(state.slots) !== sid) {
            // Refused: The caller is not the leader
            socket.emit('state', state);
            return;
        }
        state.mapIndex = data.mapIndex;
        socket.broadcast.emit('state', state);
    });

    socket.on('start_round', function (data) {
        if (shared.masterSid(state.slots) !== sid) {
            return;
        }
        stateSystem.goto(PlayState);
    });

    var predictionSystem = {
        createEntity:function (name, value) {
            state.entities[name] = value;
        }, isFirstTimePredicted:function () {
            return true;
        }, destroyEntity:function (key) {
            delete state.entities[key];
        }
    };
    predictionSystem.__defineGetter__("entities", function () {
        return state.entities
    });
    Object.freeze(predictionSystem);

    socket.on('player_cmd', function (cmd) {
        var slotName = cmd.slot;
        if (state.state === 'play' && state.slots[slotName].owner === sid) {
            shared.updateAvatar(state.t, slotName, state.entities[slotName], predictionSystem, cmd);
            state.acks[slotName] = cmd.id;
        } else {
            socket.emit('state', state); //Resync the client
        }
    });

    socket.emit('set_session', sid); //Push the session, that is hard to get on client side of socket io
    socket.emit('state', state); //Initial update of the world state
});



