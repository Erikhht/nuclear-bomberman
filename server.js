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

var ioSrv = require('socket.io')
    .listen(appSrv);

function clone(obj) {
    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        var copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        var copy = [];
        for (var i = 0; i < obj.length; ++i) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        var copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}

/**
 * This is the game state
 */
var state;
function resetState() {
    state = {
        t:undefined,
        state:'prepare',
        slots:{
            slot0:{}, slot1:{}, slot2:{}, slot3:{}, slot4:{},
            slot5:{}, slot6:{}, slot7:{}, slot8:{}, slot9:{}
        },
        acks:{},
        mapIndex:1,
        entities:{},
        temporaryEntities:[]
    }
}
resetState();

var tick = undefined;
function createTicker() {
    var msCount = 0;
    var tickCount = 0;
    //World is a state decorated with functions
    var world = {
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
    var handle = setInterval(function () {
        // There is no point here at beeing precice regarding the system clock.
        // I gain repetability with incrementing the round time by the tick period.
        state.t = msCount += shared.sv_tick_period_ms;
        tickCount++;
        world.entities = state.entities;
        for (var key in state.entities) {
            var entity = state.entities[key];
            var onTick = shared.simulateOnTick[entity.type];
            if (onTick) onTick(state.t, key, entity, world);
        }
        if (tickCount % shared.sv_update_tick === 0) {
            sockets.emit("state", state);
            state.temporaryEntities = [];//flush the createTemporaryEntity queue
        }
    }, shared.sv_tick_period_ms);
    return {stop:function () {
        clearInterval(handle);
    }};
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

var playerCleaner = function () {
    var timeouts = {};
    return {
        notifyConnect:function (sid) {
            clearTimeout(timeouts[sid]);
            timeouts[sid] = undefined;
        },
        notifyDisconnect:function (sid) {
            console.log("[playercleaner] sid %s disconnection detected, wait %d ms before players disqualification", sid, settings.sv_disconnect_timeout);
            timeouts[sid] = setTimeout(function () {
                // Clear every slot of this sid
                for (var slotName in state.slots) {
                    var slot = state.slots[slotName];
                    if (slot.owner === sid) {
                        state.slots[slotName] = {};
                    }
                }
                console.log("[playercleaner] all players of sid %s are disqualified", sid);
                if (shared.masterSid(state.slots) === undefined){
                    console.log("[playercleaner] all players disconnected, reset the game");
                    resetState();
                }
                sockets.emit('state', state); // tell the others that sid is disqualified
            }, shared.sv_disconnect_timeout);
        }
    };
}();


sockets.on('connection', function (socket) {
    // get back the sid extracted durring the authorization process
    var sid = socket.handshake.sid;

    // reset state cleanup on long disconnect
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
        state.state = 'play';
        state.t = 0;
        // Scan the map and collect spawn points coordinates
        var spawnPoints = [];
        var tileProperties = maps.tilesets[0].tileproperties;
        maps.layers[state.mapIndex].data.forEach(function (value, index) {
            if (value === 0) return;
            var prop = tileProperties[value - 1];
            if (!prop) return;
            if (prop.type === "spawn")
                spawnPoints.push(index);
            else
                state.entities[index] = clone(prop);
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
        tick = createTicker();
        sockets.emit('state', state);
    });


    var predictionSystem = {
        createEntity:function (name, value) {
            state.entities[name] = value;
        }, isFirstTimePredicted:function () {
            return true;
        }, destroyEntity:function (key) {
            delete state.entities[key];
        }, entities:state.entities
    };

    socket.on('player_cmd', function (cmd) {
        var slotName = cmd.slot;
        if (state.state === 'play' && state.slots[slotName].owner === sid) {
            shared.updateAvatar(state.t, slotName, state.entities[slotName], predictionSystem, cmd);
            state.acks[slotName] = cmd.id;
        } else {
            socket.emit('state', state); //Resync the client
        }
    });

    socket.emit('set_session', sid);
    socket.emit('state', state);
});



