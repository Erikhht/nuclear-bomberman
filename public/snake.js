"use strict";
/**
 * Bomberman client code.
 * The startup function is executed by jQuery when the page is ready.
 */
function startup() {


// Write sefull metrics in shit object to get a periodic dump to the console
    var metrics = function(){
        var metricsDiv = $("#metrics");
        setInterval(function () {
            metricsDiv.text(JSON.stringify(metrics));
        }, 300);
        return{};
    }();

    function Interpolator() {
        var queue = [];
        var state_0 = undefined;
        var state_1 = undefined;
        var c = undefined;

        var locateSnapshots = function (roundTime) {
            var lerpTime = shared.cl_interp ? roundTime - shared.cl_interp_delay_ms : queue[queue.length - 1].t;
            for (var fromIdx = queue.length - 1; fromIdx >= 0; fromIdx--) {
                if (queue[fromIdx].t <= lerpTime) {
                    state_0 = queue[fromIdx];
                    state_1 = queue[fromIdx + 1]; // if undefined -> no interpolation occurs
                    c = state_1 === undefined ? 0 : (lerpTime - state_0.t) / (state_1.t - state_0.t);
                    //Job done, let's discard old states when there are 16 or more
                    if (fromIdx > 16) {
                        queue.splice(0, fromIdx);
                        fromIdx = 0;
                    }
                    metrics["state_log"] = "" + (queue.length - 1 - fromIdx - 1) + "/" + queue.length;

                    return;
                }
            }
            //There is no state that old, let's take the oldest state as is
            state_0 = queue[0];
            state_1 = undefined; // undefined -> no interpolation occurs
            c = 0;
        };

        var interpolateFunc = {
            avatar:function (pos_0, pos_1) {
                var dist_x = Math.abs(pos_1.x - pos_0.x);
                var dist_y = Math.abs(pos_1.y - pos_0.y);
                var cx, cy;
                var traveled = (dist_x + dist_y) * c;
                if (traveled === 0)
                    return undefined; // Avoid superfluity calculation and direction update
                var pos_c = Object.create(pos_0);
                var isHorizontal = Math.round(pos_0.x) != pos_0.x;
                if (isHorizontal) {//Bomberman goes horizontally first and then vertically at t0
                    if (traveled >= dist_x) {// finished moving horizontally, now going vertically
                        pos_c.x = pos_1.x;
                        if (dist_y) {
                            isHorizontal = false; // remember that we are going vertically at t
                            cy = (traveled - dist_x) / dist_y;
                            pos_c.y = pos_0.y + cy * (pos_1.y - pos_0.y)
                        }
                    } else {//still moving horizontally
                        cx = traveled / dist_x;
                        pos_c.x = pos_0.x + cx * (pos_1.x - pos_0.x);
                    }
                } else {//Bomberman goes vertically first and then horizontally at t0
                    if (traveled >= dist_y) {// finished moving vertically, now going horizontally
                        pos_c.y = pos_1.y;
                        if (dist_x) {
                            isHorizontal = true;
                            cx = (traveled - dist_y) / dist_x;
                            pos_c.x = pos_0.x + cx * (pos_1.x - pos_0.x);
                        }
                    } else {//still moving vertically
                        cy = traveled / dist_y;
                        pos_c.y = pos_0.y + cy * (pos_1.y - pos_0.y);
                    }
                }
                pos_c.h = isHorizontal ? (pos_1.x > pos_0.x ? 1 : 3) : (pos_1.y > pos_0.y ? 2 : 0);
                return pos_c;
            }
        };

        var interpolateEntities = function () {
            var entities_c = Object.create(state_0.entities);
            if (state_1 === undefined)
                return entities_c;
            var entities_0 = state_0.entities, entities_1 = state_1.entities;
            for (var key in entities_0) {
                var entity_0 = entities_0[key], entity_1 = entities_1[key];
                if (entity_1 === undefined) continue; // disapeared! leave unchanged
                var func = interpolateFunc[entity_0.type];
                if (func) {
                    var newValue = interpolateFunc[entity_0.type](entity_0, entity_1);
                    if (newValue) entities_c[key] = newValue;
                }
            }
            return entities_c;
        };

        this.append = function (state) {

            metrics["snapshot_jitter"] = state.t - (Date.now() - localState.startTime);

            //prevent dupplicate snapshot at the same time early the future division per zero in the interpolation coeficient.
            var last = this.last();
            if (last === undefined || state.t > last.t) queue.push(state);
        };

        var patch = function (original, patch) {
            for (var key in patch) {
                var v = patch[key];
                if (v === undefined) delete original[key];
                else original[key] = v;
            }
        }

        this.appendDelta = function (state_delta) {
            var state = shared.clone(this.last());
            patch(state.slots)
        }

        this.interpolate = function (roundTime, interpolationTarget) {
            var prev_state_0 = state_0;
            locateSnapshots(roundTime);
            if (prev_state_0 !== state_0) {
                interpolationTarget.spawnTemporaryEntities(roundTime, state_0.temporaryEntities);
            }
            interpolationTarget.submit(interpolateEntities(), state_0.acks);
        };

        this.last = function () {
            return queue[queue.length - 1];//returns undefined when the array is empty
        };
        Object.freeze(this);
    }


    function PredictionSystem() {
        this.entities = {};
        this.temporaryEntities = [];
        var predictedEntities = {};
        var interpolationAcks = {};
        var predictionAcks = {};

        var curSlotName, curCommand;

        /**
         * Create of overwrite an entity during the client side prediction.
         *
         * @param name key the entities object
         * @param value object at creation time
         */
        this.createEntity = function (name, value) {
            var key = curSlotName + curCommand.id + '.' + name; //Overwrite an entity with the same name, slot name and acknowledgment id
            predictedEntities[key] = {slot:curSlotName, id:curCommand.id, name:name, value:value};
            this.entities[name] = value; //Immediately spawned so that the player logic can rely on 'entities' state
        };

        this.isFirstTimePredicted = function () {
            return !(this.acks[curSlotName] >= curCommand.id);
        };
        this.destroyEntity = function (name) {
            this.createEntity(name, undefined);
        };

        this.spawnTemporaryEntities = function (roundTime, newTemporaryEntities) {
            for (var idx = 0; idx < newTemporaryEntities.length; idx++) {
                var e = Object.create(newTemporaryEntities[idx]);
                e.t0 = roundTime;
                e.t1 = roundTime + e.ttl;
                this.temporaryEntities.push(e);
            }
        };

        this.submit = function (newEntities, newInterpolationAcks) {
            this.entities = newEntities;
            if (interpolationAcks !== newInterpolationAcks) {
                // When the ack of the interpolated states changes, cleanum the predictedEntities list
                interpolationAcks = newInterpolationAcks;
                for (var key in predictedEntities) {
                    var elem = predictedEntities[key];
                    if (interpolationAcks[elem.slot] >= elem.id)
                        delete predictedEntities[key]; // does nothing when undefined
                }
            }
        };

        this.predict = function (player) {
            if (shared.cl_predict_respawn) {
                for (var key in predictedEntities) {
                    var elem = predictedEntities[key];
                    if (elem.id <= sharedState.acks[elem.slot])
                        this.entities[elem.name] = elem.value;
                }
            }
            // Perform client side prediction: replay inputs from the last world snapshot recieved
            if (shared.cl_predict) {
                curSlotName = player.slot;
                var commandQueue = player.commandQueue;
                var avatar = this.entities[curSlotName] = shared.clone(sharedState.entities[curSlotName]);
                var t = sharedState.t;
                for (var idx = commandQueue.firstPending; idx < commandQueue.length; idx++) {
                    curCommand = commandQueue[idx];
                    t += curCommand.e;
                    shared.updateAvatar(t, curSlotName, avatar, this, curCommand);
                }
                if (curCommand) predictionAcks[curSlotName] = curCommand.id;
            }

            metrics["predicted_entities"] = predictedEntities;//Object.keys(predictedEntities).length;=
        };

        this.cleanTemporaryEntities = function (clientRoundTime) {
            this.temporaryEntities = this.temporaryEntities.filter(function (e) {
                return e.t1 > clientRoundTime
            });
        }
    }


// please
    var socket;

    /**
     * Create as a FIFO queue with random access. When an event is appended an event identifier is returned. This
     * identifier is unique for this queue. This identifier is used to discard the event an all previous ones with the
     * .acknowledge function.
     *
     * @return an array extended to behave as a FIFO queue
     */
    function createCommandQueue() {
        var queue = [];
        queue.firstPending = 0;
        queue.offset = 0;
        queue.append = function (event) {
            return this.push(event) - 1 + this.offset;
        };
        queue.acknowledge = function (eventNumber) {
            // undefined acknowledgment occurs when the server has no processed command yet, and is ok.
            if (eventNumber !== undefined) {
                this.firstPending = eventNumber - this.offset + 1;
                if (this.firstPending > 16) {
                    this.splice(0, this.firstPending);
                    this.offset = eventNumber + 1;
                    this.firstPending = 0;
                }
            }
        };
        return queue;
    }

    function Player(slotName, keyMap) {
        this.slot = slotName;
        var keyListners = {};
        for (var k in keyMap) keyListners[k] = keyboard.listen(keyMap[k]);
        this.commandQueue = createCommandQueue();
        this.sampleInput = function (start, end) {
            // Sample inputs from the keyboard
            var somethingHappened = false;
            var event = {e:end - start};
            for (var k in keyListners) {
                var press_time = keyListners[k].isPressed;
                if (press_time) {
                    somethingHappened = true;
                    event[k] = 1 + (press_time < start);
                }
            }
            // Stream the inputs to the server
            if (somethingHappened) {
                event.slot = this.slot;
                event.id = this.commandQueue.append(event);
                socket.emit("player_cmd", event);
            }
            metrics[ this.slot + "_queue"] = (this.commandQueue.length - this.commandQueue.firstPending) + "/" + this.commandQueue.length;
            return somethingHappened
        };
        Object.freeze(this);
    }


    /**
     * Subscribe to key up and key down window events and maintains a keyboard map where
     * @constructor
     */
    function Keyboard() {
        var keys = {};
        // register event handler for key up and down at the capture phase http://www.w3.org/TR/DOM-Level-3-Events/#capture-phase
        window.addEventListener('keyup', function (event) {
            var key = keys[event.keyCode];
            if (key) {
                key.isPressed = 0;
                event.preventDefault();
            }
        }, true);
        window.addEventListener('keydown', function (event) {
            var key = keys[event.keyCode];
            if (key) {
                key.isPressed = Date.now();
                event.preventDefault();
            }
        }, true);
        this.clear = function () {
            keys = {}
        };
        this.listen = function (keyCode) {
            return keys[keyCode] = (keys[keyCode] || {isPressed:0});
        };
        Object.freeze(this);
    }


    var tiles, sprites, csprites = {};
    var pingPeriodMs = 2000;
    var pingStartMs = undefined;
    var pingHandler = null;
    var animationHandler = null;
    var sid; // Http session identifier of the client-server
    var maps; // Tiled JSON file

    var sharedState = {}; // All the game state : shared with the server
    var localState = undefined;

    var lastFrameTime = undefined;
    var keyboard = new Keyboard();
    var animations;


    var gfx = function () {
        var contextFrom = function (elementSelector) {
            var canvas = $(elementSelector)[0];
            var context = canvas.getContext('2d');
            context.clear = function () {
                this.clearRect(0, 0, canvas.width, canvas.height)
            };
            return context;
        };
        return Object.freeze({
            background:contextFrom('#board0'),
            objects:contextFrom('#board1'),
            avatars:contextFrom('#board2')
        });
    }();


    function paintTiles(context, drawnSet) {
        //Find the map array definition
        var map = maps.layers[sharedState.mapIndex];
        var p = 0; //position in the map array
        var ymax = maps.height * maps.tileheight;
        var xmax = maps.width * maps.tilewidth;
        var tileset = maps.tilesets[0];
        var tilesetWidth = Math.floor(tileset.imagewidth / tileset.tilewidth);
        var properties = tileset.tileproperties;
        for (var y = 0; y < ymax; y += maps.tileheight)
            for (var x = 0; x < xmax; x += maps.tilewidth) {
                var idx = map.data[p++] - tileset.firstgid;
                if (idx < 0)continue;
                var prop = properties[idx];
                if ((!drawnSet) || drawnSet[prop ? prop.type : undefined]) {
                    var tx = Math.floor(idx % tilesetWidth) * maps.tilewidth;// x&y position in pixel of the tile in the tileset
                    var ty = Math.floor(idx / tilesetWidth) * maps.tileheight;
                    context.drawImage(tiles, tx, ty, maps.tilewidth, maps.tileheight, x, y, maps.tilewidth, maps.tileheight);
                }
            }
    }

    var yCenter = .9;
    var xCenter = .5;

    var draw_cell_content = function (clientRoundTime, gfx, cell, entity) {
        var x = (cell % maps.width + xCenter) * maps.tilewidth;
        var y = (Math.floor(cell / maps.width) + yCenter) * maps.tileheight;
        var frames = animations[entity.type];
        var idx = Math.floor((clientRoundTime * shared.frameRateMs) % frames.length);
        this.sprite(sprites, gfx.objects, frames[idx], x, y);
    };
    var draw = {
        avatar:function (clientRoundTime, gfx, slotName, avatar) {
            var frame, frames = animations[avatar.h];
            if (avatar.h >= 32) {
                var frameIdx = Math.floor((clientRoundTime - avatar.t0) * shared.frameRateMs);
                frameIdx = Math.max(frameIdx, 0);
                if (frameIdx >= frames.length)return;
                frame = frames[ frameIdx];
            } else {
                frame = frames[ Math.floor(clientRoundTime * shared.frameRateMs) % frames.length ];
            }
            var x = (avatar.x + xCenter) * maps.tilewidth;
            var y = (avatar.y + yCenter) * maps.tileheight;
            var ctx = gfx.avatars;
            // When diseased the player color blink
            slotName = avatar.pu_disease > clientRoundTime ? Math.floor(clientRoundTime / 100) % 10 : slotName;
            this.sprite(csprites[slotName], ctx, frame, x, y);
        },
        wall:function () {
        },
        bomb:function (clientRoundTime, gfx, cell, entity) {
            var x = (cell % maps.width + xCenter) * maps.tilewidth;
            var y = (Math.floor(cell / maps.width) + yCenter) * maps.tileheight;
            var frames = animations[entity.type];
            var idx = Math.floor((clientRoundTime * shared.frameRateMs) % frames.length);
            this.sprite(csprites[entity.own], gfx.objects, frames[idx], x, y);
        },
        crate:draw_cell_content,
        pu_bomb:draw_cell_content,
        pu_flame:draw_cell_content,
        pu_kicker:draw_cell_content,
        pu_disease:draw_cell_content,
        pu_punch:draw_cell_content,
        pu_skate:draw_cell_content,
        pu_jelly:draw_cell_content,
        pu_trigger:draw_cell_content,
        pu_spooge:draw_cell_content,
        pu_goldflame:draw_cell_content,
        pu_grab:draw_cell_content,
        dwall:draw_cell_content,
        hurry:function (clientRoundTime, gfx, cell, entity) {
            this.sprite(sprites, gfx.avatars, animations.hurry[0], 400, 300);
        },
        sprite:function (spriteSheet, context, frame, x, y) {
            context.drawImage(spriteSheet, frame.x, frame.y, frame.w, frame.h, x + frame.xo, y + frame.yo, frame.w, frame.h);
            if (shared.cl_draw_frame) {
                context.beginPath();
                context.moveTo(x - 5, y);
                context.lineTo(x + 5, y);
                context.moveTo(x, y - 5);
                context.lineTo(x, y + 5);
                context.rect(x + frame.xo, y + frame.yo, frame.w, frame.h);
                context.stroke();
            }
        },
        te_cl:function (clientRoundTime, gfx, cell, entity) {
            cell = entity.c;
            var x = (cell % maps.width + xCenter) * maps.tilewidth;
            var y = (Math.floor(cell / maps.width) + yCenter) * maps.tileheight;
            var frames = animations[entity.a];
            var idx = Math.floor((clientRoundTime * shared.frameRateMs) % frames.length);
            this.sprite(csprites[entity.own], gfx.objects, frames[idx], x, y);
        },
        te_co:function (clientRoundTime, gfx, cell, entity) {
            cell = entity.c;
            var x = (cell % maps.width + xCenter) * maps.tilewidth;
            var y = (Math.floor(cell / maps.width) + yCenter) * maps.tileheight;
            var frames = animations[entity.a];
            var idx = Math.floor((clientRoundTime - entity.t0) * shared.frameRateMs);
            if (idx >= frames.length) return; // Disapear after the first animation
            this.sprite(csprites[entity.own], gfx.objects, frames[idx], x, y);
        }
    };

    function renderFrame(curFrameTime) {
        if (sharedState.state !== "play") return;
        window.requestAnimationFrame(renderFrame);

        // Compute the time since the biginning of the rould from the client point of view
        var clientRoundTime = curFrameTime - localState.startTime;
        // Interpolate
        localState.snapshots.interpolate(clientRoundTime, localState.prediction);
        // Sample inputs and predict player position
        for (var playerIdx = 0; playerIdx < localState.players.length; playerIdx++) {
            var player = localState.players[playerIdx];
            player.sampleInput(lastFrameTime, curFrameTime);
            localState.prediction.predict(player);
        }
        localState.prediction.cleanTemporaryEntities(clientRoundTime);
        //Clear the layers
        gfx.avatars.clear();
        gfx.objects.clear();

        // Draw every shared entities
        var entities = localState.prediction.entities;
        for (var k in entities) {
            var entity = entities[k];
            entity && draw[entity.type](clientRoundTime, gfx, k, entity);
        }

        // Draw every temporaryEntites
        entities = localState.prediction.temporaryEntities;
        for (k = 0; k < entities.length; k++) {
            entity = entities[k];
            entity && draw[entity.type](clientRoundTime, gfx, undefined, entity);
        }

        // Prepare next call
        lastFrameTime = curFrameTime;


    }

    var onState = {
        play:{
            enter:function (prevState, newState) {
                updatePlayerSlots();
                localState = {
                    players:[],
                    snapshots:new Interpolator(),
                    prediction:new PredictionSystem(),
                    // The round elapsed time is Date.now()-startTime.
                    // When the client enters the "play" state as the round begins, newState.t is 0.
                    // But if the client enters in a running a round, newState.t is the round elapsed time !=0.
                    startTime:Date.now() - newState.t
                };

                // Draw all the background static object to a dedicated background canvas for later reuse
                gfx.background.clear();
                paintTiles(gfx.background, {wall:true});
                lastFrameTime = undefined;
                // This will be done by the update call, but it is required for the the "renderFrame" to complete with success
                // The stateLog.append second call will ignore the notified state
                localState.snapshots.append(newState);
                animationHandler = requestAnimationFrame(renderFrame);

                // Create event queue and keyboard listening state for owned slots
                var playerNumber = 0;
                for (var s in sharedState.slots) {
                    if (sharedState.slots[s].owner === sid) {
                        localState.players.push(new Player(s, shared.avatarKeyMap[playerNumber++]));
                    }
                }
            },
            update:function (prevState, newState) {
                localState.snapshots.append(newState);
                for (var playerIdx = 0; playerIdx < localState.players.length; playerIdx++) {
                    var player = localState.players[playerIdx];
                    player.commandQueue.acknowledge(newState.acks[player.slot]);
                }
            },
            exit:function (prevState, newState) {
                cancelAnimationFrame(renderFrame);
                // Reset keyboard monitoring state
                keyboard.clear();
            }
        },
        prepare:{
            enter:function (prevState, newState) {
                repaintPreview();
            },
            update:function (prevState, newState) {
                if (prevState.mapIndex !== sharedState.mapIndex) {
                    $("#mapselect").val(sharedState.mapIndex);
                    repaintPreview();
                }

                $(".board").find("input, select").attr("disabled", shared.masterSid(sharedState.slots) !== sid);
                updatePlayerSlots();
            },
            exit:function (prevState, newState) {
            }
        },
        undefined:{
            exit:function (prevState, newState) {
            }
        }
    };

    function updatePlayerSlots() {
        // Update player slot state and name from the server inputs.
        $("ol.slots").children().each(function (index) {
            var requestForcusAndSelect = false;
            var slot = sharedState.slots[$(this).attr("id")];
            if (slot.owner === undefined) {
                $(this).attr("class", "free");
            } else if (slot.owner === sid) {
                requestForcusAndSelect = $(this).attr("class") != "own";
                $(this).attr("class", "own");
            } else {
                $(this).attr("class", "other");
            }
            var inputElement = $(this).find("input");
            inputElement.attr("value", slot.name);
            if (requestForcusAndSelect)
                inputElement.focus().select();
            $(this).find("div.ifother").text(slot.name || "");
        });
    }

    function repaintPreview() {
        if (!sharedState.mapIndex)return;
        var canvas = $("#preview")[0];
        var context = canvas.getContext('2d');
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.setTransform(.5, 0, 0, .5, 0, 0);
        paintTiles(context);
    }


    function LoadingSystem() {
        var steps = [];
        var progressHandler = function (desc, min, max, value) {
        };
        this.onProgress = function (fnct) {
            progressHandler = fnct;
            return this;
        };
        this.then = function (description, step) {
            step.description = description;
            steps.push(step);
            return this;
        };
        this.go = function () {
            var idx = -1;
            var continuation = function () {
                if (idx < steps.length - 1) {
                    idx++;
                    var todo = steps[idx];
                    progressHandler(steps[idx].description, 0, steps.length - 1, idx);
                    setTimeout(function () {
                        steps[idx](continuation);
                    }, 80);
                } else {
                    progressHandler("Done", 0, steps.length - 1, steps.length - 1);
                }
            };
            continuation();
        };
        console.log("[load] Loading sequence starts")
        Object.freeze(this);
    }


    var loading = new LoadingSystem()
        .onProgress(function (desc, min, max, value) {
            console.log("[load] " + value + "/" + max + " " + desc);
            $("#loadingprogress").attr({min:min, max:max, value:value});
            $("#loadingstatus").text(desc);
        }).then("Load tiles",function (continuation) {
            tiles = new Image();
            tiles.onload = continuation;
            tiles.src = "tiles.png";
        }).then("Load maps",function (continuation) {
            $.ajax({
                url:"maps.json",
                success:function (data) {
                    console.log("[load] maps loaded with success");
                    maps = data;
                    var control = $('#mapselect');
                    $.each(maps.layers, function (idx, element) {
                        control.append("<option value='" + idx + "'>" + element.name + "</option>");
                    });
                },
                failure:function (data) {
                    alert("Failed to load maps.json");
                }
            }).always(continuation);
        }).then("Load animations", function (continuation) {
            $.ajax({
                url:"ani.json",
                success:function (data) {
                    console.log("animations loaded with success");
                    function offset(name, x, y) {
                        var frames = data[name].frames;
                        for (var i = 0; i < frames.length; i++) {
                            var frame = frames[i];
                            frame.xo += x;
                            frame.yo += y;
                        }
                        return frames;
                    }

                    animations = {
                        0:data["walk north"].frames,
                        1:data["walk east"].frames,
                        2:data["walk south"].frames,
                        3:data["walk west"].frames,
                        4:data["stand north"].frames,
                        5:data["stand east"].frames,
                        6:data["stand south"].frames,
                        7:data["stand west"].frames,
                        32:data["die green 1"].frames,
                        33:data["die green 2"].frames,
                        34:data["die green 3"].frames,
                        35:data["die green 4"].frames,
                        36:data["die green 5"].frames,
                        37:data["die green 6"].frames,
                        38:data["die green 7"].frames,
                        39:data["die green 8"].frames,
                        40:data["die green 9"].frames,
                        41:data["die green 10"].frames,
                        42:data["die green 11"].frames,
                        43:data["die green 12"].frames,
                        44:data["die green 13"].frames,
                        45:data["die green 14"].frames,
                        46:data["die green 15"].frames,
                        47:data["die green 16"].frames,
                        48:data["die green 17"].frames,
                        49:data["die green 18"].frames,
                        50:data["die green 19"].frames,
                        51:data["die green 20"].frames,
                        52:data["die green 21"].frames,
                        53:data["die green 22"].frames,
                        54:data["die green 23"].frames,
                        55:data["die green 24"].frames,
                        bomb:data["bomb regular green"].frames,
                        dwall:data["tile 1 solid"].frames,
                        hurry:data["hurry"].frames,
                        crate:offset("tile 5 brick", -1, 2),
                        crateblast:offset("flame brick 5", -1, 2),
                        pu_bomb:offset("power bomb", 0, 2),
                        pu_flame:offset("power flame", 0, 2),
                        pu_kicker:offset("power kicker", 0, 2),
                        pu_disease:offset("power disease", 0, 2),
                        pu_punch:offset("power punch", 0, 2),
                        pu_skate:offset("power skate", 0, 2),
                        pu_jelly:offset("power jelly", 0, 2),
                        pu_spooge:offset("power spooge", 0, 2),
                        pu_trigger:offset("power trigger", 0, 2),
                        pu_goldflame:offset("power goldflame", 0, 2),
                        pu_grab:offset("power grab", 0, 2),
                        blasto:offset("flame center green", 0, 0),
                        blastn:offset("flame midnorth green", -2, 0),
                        blastnt:offset("flame tipnorth green", -3, -1),
                        blaste:offset("flame mideast green", 0, -7),
                        blastet:offset("flame tipeast green", -2, -6),
                        blasts:offset("flame midsouth green", -2, 0),
                        blastst:offset("flame tipsouth green", -2, 0),
                        blastw:offset("flame midwest green", 0, -5),
                        blastwt:offset("flame tipwest green", 0, -5)
                    }
                },
                failure:function (data) {
                    alert("Failed to load ani.json");
                }
            }).always(continuation);
        });


    var loadImageAsCanvas = function (imageSource, continuation) {
        var canvas = document.createElement('canvas');
        var image = new Image();
        image.onload = function () {
            canvas.width = image.width;
            canvas.height = image.height;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0);
            continuation();
        }
        image.src = imageSource;// Go get the data!
        return canvas;
    }

    var slot_colors = [
        {name:"magenta", hue:-180, lightness:22, saturation:-27},
        {name:"red", hue:-120, lightness:20, saturation:-20},
        {name:"orange", hue:-120, lightness:20, saturation:-20},
        {name:"yellow", hue:-68, lightness:5, saturation:-5},
        {name:"green", hue:-15, saturation:6, lightness:-20},
        {name:"cyan", hue:60, saturation:0, lightness:-30},
        {name:"blue", hue:98, saturation:16, lightness:-10},
        {name:"purple", hue:145, saturation:42, lightness:-10},
        {name:"black", hue:0, saturation:-100, lightness:-100},
        {name:"white", hue:0, saturation:-100, lightness:100}
    ];
    if (shared.cl_local_hsl_transform) {
        loading.then("Load sprites", function (continuation) {
            csprites[undefined] = sprites = loadImageAsCanvas("sprites.png", continuation);
        });
        for (var slotIdx = 0; slotIdx < slot_colors.length; slotIdx++)
            (function (slotIdx, color) {
                loading.then("Generate " + color.name + " sprites", function (continuation) {
                    csprites[slotIdx] = csprites["slot" + slotIdx] = Pixastic.process(sprites, "hsl", color);
                    continuation();
                });
            }(slotIdx, slot_colors[slotIdx]));
    } else {
        loading.then("Load green sprites", function (continuation) {
            csprites[undefined] = sprites = loadImageAsCanvas("sprites.png", continuation);
        });

        for (var slotIdx = 0; slotIdx < slot_colors.length; slotIdx++)
            ( function (slotIdx, color) {
                loading.then("Load " + color.name + " sprites", function (continuation) {
                    var slotName = "slot" + slotIdx, imageName = "sprites_" + color.name + ".png";
                    csprites[slotIdx] = csprites[slotName] = loadImageAsCanvas(imageName, continuation);
                });
            }(slotIdx, slot_colors[slotIdx]));
    }

    loading.then("Connect to the server",function (continuation) {
        socket = io.connect();
        $(".outer").children().attr("class", "prepare");

        socket.on('connecting', function (protocol) {
            console.log("real time connection with a " + protocol);
        });

        socket.on('connect', function () {
            console.log("connection successful %o", socket);
            pingHandler = setInterval(function () {
                if (pingStartMs === undefined || Date.now() - pingStartMs > 2 * pingPeriodMs) {
                    pingStartMs = Date.now();
                    socket.emit("ping");
                }
            }, pingPeriodMs);
        });

        socket.on('disconnect', function () {
            console.log("Connection lost");
            clearInterval(pingHandler = null);
        });

        socket.on("pong", function () {
            var latency = Date.now() - pingStartMs;
            socket.emit("pung");
            metrics["latency"] = latency + "ms";
        });

        socket.on("set_session", function (newSid) {
            console.log("session identifier is ", newSid);
            sid = newSid;
        });

        socket.on('connect_failed', function (e) {
            $("#websocketDown").text(e ? e : 'connection failed').dialog("open");
        });

        socket.on("state", function (newState) {
            var prevState = sharedState;
            sharedState = newState;
            if (prevState.state !== sharedState.state) {
                $(".outer").children().attr("class", sharedState.state);
                onState[prevState.state].exit(prevState, sharedState);
                onState[sharedState.state].enter(prevState, sharedState);
            }
            onState[sharedState.state].update(prevState, sharedState);
        });

        continuation();
    }).go();


    $("#websocketDown").dialog(
        { autoOpen:false, modal:true, buttons:{ "Ok":function () {
            $(this).dialog("close");
        } } });

    $("div.iffree").click(function () {
        //The user claims for an empty slot.
        var slotName = $(this).parent().attr('id');
        socket.emit("add_player", {slotName:slotName});
    });

    $("ol.slots input")
        .change(function () {
            var newName = $(this).val();
            var slotName = $(this).parent().attr('id');
            if (newName === "") {
                socket.emit("remove_player", {slotName:slotName});
            } else {
                socket.emit("set_player", {slotName:slotName, name:newName});
            }
        })
        .keyup(function (evt) {
            if (evt.keyCode === 13) {
                $(this).blur();
            } else {
                var newName = $(this).val();
                var slotName = $(this).parent().attr('id');
                socket.emit("set_player", {slotName:slotName, name:newName});
            }
        });

// When the map is changed, the preview is refreshed
    $("#mapselect").change(function () {
        sharedState.mapIndex = $(this).val();
        socket.emit("set_map", {mapIndex:sharedState.mapIndex});
        repaintPreview();
    });

// When the map is changed, the preview is refreshed
    $("#startbutton").click(function () {
        socket.emit("start_round");
    });


}

$().ready(startup);


