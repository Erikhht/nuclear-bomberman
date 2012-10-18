"use strict";
var shared = {
    // Multiplayer
    cl_draw_frame:false,
    cl_predict:true, // Client side prediction enable/disable
    cl_predict_respawn:true,
    cl_interp:true, // Client side interpolation enable/disable
    cl_interp_delay_ms:120, // Amount of ms the time is shifted back when the client continuously interpolate object position
    sv_tick_period_ms:30, // Discrete simulation period, 30 ms = 33hz ( ~60 is ok)
    sv_update_tick:2, // Send an unpdate to the client every 2 ticks = 60 ms = 17 hz ( ~20 is ok)
    sv_disconnect_timeout:30 * 1000,
    // Gameplay
    gp_bomb_ttl_ms:1200,
    gp_flame_duration_ms:500,
    gp_power_up:{
        pu_bomb:.05,
        pu_flame:.04,
        pu_skate:.03,
        pu_disease:.02,
        pu_spooge:.02,
        pu_goldflame:.01,
        pu_kicker:.00,
        pu_punch:.00,
        pu_jelly:.00,
        pu_grab:.00,
        pu_trigger:.00
    },
    gp_disease_duration:15000,
    gp_pu_skate_increase:.002,
    gp_ini_bomb_power:1,
    gp_ini_bomb_count:2, // number of bomb available at the beginning of a game
    bombTTLTick:100, // bomb duration in game tick
    gp_ini_avatar_speed:.01, // bomberman speed in grid unity pe millisecond
    gp_round_end_duration:3000,
    // gfx
    mapwidth:20,
    tilewidth:40,
    tileheight:36,
    frameRateMs:.02 // annimation frame per millisecond
};
try {
    module.exports = shared;
} catch (err) {
    //We are not running as node.js module
}
var KeyEvent = {
    DOM_VK_CANCEL:3, DOM_VK_HELP:6, DOM_VK_BACK_SPACE:8, DOM_VK_TAB:9, DOM_VK_CLEAR:12, DOM_VK_RETURN:13, DOM_VK_ENTER:14,
    DOM_VK_SHIFT:16, DOM_VK_CONTROL:17, DOM_VK_ALT:18, DOM_VK_PAUSE:19, DOM_VK_CAPS_LOCK:20, DOM_VK_ESCAPE:27, DOM_VK_SPACE:32,
    DOM_VK_PAGE_UP:33, DOM_VK_PAGE_DOWN:34, DOM_VK_END:35, DOM_VK_HOME:36, DOM_VK_LEFT:37, DOM_VK_UP:38, DOM_VK_RIGHT:39,
    DOM_VK_DOWN:40, DOM_VK_PRINTSCREEN:44, DOM_VK_INSERT:45, DOM_VK_DELETE:46, DOM_VK_0:48, DOM_VK_1:49, DOM_VK_2:50,
    DOM_VK_3:51, DOM_VK_4:52, DOM_VK_5:53, DOM_VK_6:54, DOM_VK_7:55, DOM_VK_8:56, DOM_VK_9:57, DOM_VK_SEMICOLON:59,
    DOM_VK_EQUALS:61, DOM_VK_A:65, DOM_VK_B:66, DOM_VK_C:67, DOM_VK_D:68, DOM_VK_E:69, DOM_VK_F:70, DOM_VK_G:71, DOM_VK_H:72,
    DOM_VK_I:73, DOM_VK_J:74, DOM_VK_K:75, DOM_VK_L:76, DOM_VK_M:77, DOM_VK_N:78, DOM_VK_O:79, DOM_VK_P:80, DOM_VK_Q:81,
    DOM_VK_R:82, DOM_VK_S:83, DOM_VK_T:84, DOM_VK_U:85, DOM_VK_V:86, DOM_VK_W:87, DOM_VK_X:88, DOM_VK_Y:89, DOM_VK_Z:90,
    DOM_VK_CONTEXT_MENU:93, DOM_VK_NUMPAD0:96, DOM_VK_NUMPAD1:97, DOM_VK_NUMPAD2:98, DOM_VK_NUMPAD3:99, DOM_VK_NUMPAD4:100,
    DOM_VK_NUMPAD5:101, DOM_VK_NUMPAD6:102, DOM_VK_NUMPAD7:103, DOM_VK_NUMPAD8:104, DOM_VK_NUMPAD9:105, DOM_VK_MULTIPLY:106,
    DOM_VK_ADD:107, DOM_VK_SEPARATOR:108, DOM_VK_SUBTRACT:109, DOM_VK_DECIMAL:110, DOM_VK_DIVIDE:111, DOM_VK_F1:112,
    DOM_VK_F2:113, DOM_VK_F3:114, DOM_VK_F4:115, DOM_VK_F5:116, DOM_VK_F6:117, DOM_VK_F7:118, DOM_VK_F8:119, DOM_VK_F9:120,
    DOM_VK_F10:121, DOM_VK_F11:122, DOM_VK_F12:123, DOM_VK_F13:124, DOM_VK_F14:125, DOM_VK_F15:126, DOM_VK_F16:127,
    DOM_VK_F17:128, DOM_VK_F18:129, DOM_VK_F19:130, DOM_VK_F20:131, DOM_VK_F21:132, DOM_VK_F22:133, DOM_VK_F23:134,
    DOM_VK_F24:135, DOM_VK_NUM_LOCK:144, DOM_VK_SCROLL_LOCK:145, DOM_VK_COMMA:188, DOM_VK_PERIOD:190, DOM_VK_SLASH:191,
    DOM_VK_BACK_QUOTE:192, DOM_VK_OPEN_BRACKET:219, DOM_VK_BACK_SLASH:220, DOM_VK_CLOSE_BRACKET:221, DOM_VK_QUOTE:222,
    DOM_VK_META:224
};

shared.avatarKeyMap = [
    {up:KeyEvent.DOM_VK_UP, down:KeyEvent.DOM_VK_DOWN, left:KeyEvent.DOM_VK_LEFT, right:KeyEvent.DOM_VK_RIGHT, fire:KeyEvent.DOM_VK_SPACE},
    {up:KeyEvent.DOM_VK_E, down:KeyEvent.DOM_VK_D, left:KeyEvent.DOM_VK_S, right:KeyEvent.DOM_VK_F},
    {up:KeyEvent.DOM_VK_I, down:KeyEvent.DOM_VK_K, left:KeyEvent.DOM_VK_J, right:KeyEvent.DOM_VK_L}
];

/**
 * Returns the master session id or undefined if there is no slot allocated
 * @param slots
 * @return {*}
 */
shared.masterSid = function (slots) {
    return slots.slot0.owner || slots.slot1.owner || slots.slot2.owner || slots.slot3.owner || slots.slot4.owner
        || slots.slot5.owner || slots.slot6.owner || slots.slot7.owner || slots.slot8.owner || slots.slot9.owner;
}


var eat_power_up = {
    pu_bomb:function (t, avatar) {
        avatar.rb++
    },
    pu_flame:function (t, avatar) {
        avatar.p++
    },
    pu_kicker:function (t, avatar) {
        avatar.pu_kicker = true
    },
    pu_disease:function (t, avatar) {
        avatar.pu_disease = t + shared.gp_disease_duration;
    },
    pu_punch:function (t, avatar) {
        avatar.pu_punch = true
    },
    pu_skate:function (t, avatar) {
        avatar.s += shared.gp_pu_skate_increase
    },
    pu_jelly:function (t, avatar) {
        avatar.pu_jelly = true
    },
    pu_grab:function (t, avatar) {
        avatar.pu_grab = true
    },
    pu_spooge:function (t, avatar) {
        avatar.pu_spooge = true
    },
    pu_goldflame:function (t, avatar) {
        avatar.p = shared.mapwidth
    },
    pu_trigger:function (t, avatar) {
        avatar.pu_trigger = true
    }
}
var directions = [-shared.mapwidth, 1, shared.mapwidth, -1];

var can_walk = function (entity) {
    return entity === undefined || entity.type in eat_power_up;
}

shared.updateAvatar = function (t, slotName, avatar, world, command) {
    if (avatar.h >= 32)// When it is dead
        return;
    var entities = world.entities;
    var d = command.d;
    var vx = ((command.right ? d : 0) - (command.left ? d : 0)) * avatar.s;
    vx = Math.max(vx, -.5);
    vx = Math.min(vx, .5);
    var vy = ((command.down ? d : 0) - (command.up ? d : 0)) * avatar.s;
    vy = Math.max(vy, -.5);
    vy = Math.min(vy, .5);
    if (avatar.pu_disease > t) {// when undefined this is false
        vx = -vx;
        vy = -vy;
    }
    var icx = Math.round(avatar.x);
    var icy = Math.round(avatar.y);
    var dcx = avatar.x - icx;
    var dcy = avatar.y - icy;
    var cell = icx + icy * shared.mapwidth;
    //Pick up power up
    var cell_entity = entities[cell];
    if (cell_entity !== undefined) {
        var fnct = eat_power_up[cell_entity.type];
        if (fnct) {
            world.destroyEntity(cell); //remove the power up
            fnct(t, avatar);
        }
    }
    // Bounce on an obstacle if any.
    var north = can_walk(entities[cell - shared.mapwidth]);
    var south = can_walk(entities[cell + shared.mapwidth]);
    var west = can_walk(entities[cell - 1]);
    var east = can_walk(entities[cell + 1]);

    if (command.fire && avatar.rb > 0) {
        if (cell_entity === undefined) {
            avatar.rb--;
            world.createEntity(cell, {type:"bomb", et:t + shared.gp_bomb_ttl_ms, p:avatar.p, own:slotName});
        } else if (avatar.pu_spooge && cell_entity.type === "bomb" && command.fire === 1) {
            var c = cell;
            var d = directions[avatar.h % 4];
            while (avatar.rb > 0) {
                c += d;
                if (entities[c])break;
                avatar.rb--;
                world.createEntity(c, {type:"bomb", et:t + shared.gp_bomb_ttl_ms, p:avatar.p, own:slotName});
            }
        }
    }
    // Slide on the wall when possible
    if (dcx != 0 || (dcy == 0 && avatar.h & 1)) {
        //I wal on horizontal lines
        if (vy > 0 && south && dcx * vx <= 0) {
            var absSlide = Math.min(vy, Math.abs(dcx));
            dcy += vy - absSlide;
            dcx -= dcx > 0 ? absSlide : -absSlide;
            avatar.h = vy - absSlide > 0 ? 2 : (dcx < 0 ? 1 : 3);
        } else if (vy > 0 && dcx > 0 && can_walk(entities[cell + shared.mapwidth + 1]) && vx >= 0) {
            dcx += vy;
            avatar.h = 1;
        } else if (vy > 0 && dcx < 0 && can_walk(entities[cell + shared.mapwidth - 1]) && vx <= 0) {
            dcx -= vy;
            avatar.h = 3;
        } else if (vy < 0 && north && dcx * vx <= 0) {
            var absSlide = Math.min(-vy, Math.abs(dcx))
            dcy += vy + absSlide;
            dcx -= dcx > 0 ? absSlide : -absSlide;
            avatar.h = vy + absSlide < 0 ? 0 : (dcx < 0 ? 1 : 3);
        } else if (vy < 0 && dcx > 0 && can_walk(entities[cell - shared.mapwidth + 1]) && vx >= 0) {
            dcx -= vy;
            avatar.h = 1;
        } else if (vy < 0 && dcx < 0 && can_walk(entities[cell - shared.mapwidth - 1]) && vx <= 0) {
            dcx += vy;
            avatar.h = 3;
        } else if (vx != 0) {// Condition to avoid .h change when no key is pressed
            dcx += vx;
            avatar.h = vx === 0 ? (vy > 0 ? 2 : 0) : (vx > 0 ? 1 : 3)
        }
    } else {
        if (vx > 0 && east && dcy * vy <= 0) {
            var absSlide = Math.min(vx, Math.abs(dcy));
            dcx += vx - absSlide;
            dcy -= dcy > 0 ? absSlide : -absSlide;
            avatar.h = vx - absSlide > 0 ? 1 : (dcy < 0 ? 2 : 0);
        } else if (vx > 0 && dcy > 0 && can_walk(entities[cell + shared.mapwidth + 1]) && vy >= 0) {
            dcy += vx;
            avatar.h = 2;
        } else if (vx > 0 && dcy < 0 && can_walk(entities[cell - shared.mapwidth + 1]) && vy <= 0) {
            dcy -= vx;
            avatar.h = 0;
        } else if (vx < 0 && west && dcy * vy <= 0) {
            var absSlide = Math.min(-vx, Math.abs(dcy));
            dcx += vx + absSlide;
            dcy -= dcy > 0 ? absSlide : -absSlide;
            avatar.h = vx + absSlide < 0 ? 3 : (dcy < 0 ? 2 : 0);
        } else if (vx < 0 && dcy > 0 && can_walk(entities[cell + shared.mapwidth - 1]) && vy >= 0) {
            dcy -= vx;
            avatar.h = 2;
        } else if (vx < 0 && dcy < 0 && can_walk(entities[cell - shared.mapwidth - 1]) && vy <= 0) {
            dcy += vx;
            avatar.h = 0;
        } else if (vy != 0) {// Condition to avoid .h change when no key is pressed
            dcy += vy;
            avatar.h = vy === 0 ? (vx > 0 ? 1 : 3) : (vy > 0 ? 2 : 0);
        }
    }
    //Bound on obstacles
    if ((dcy > 0 && !south) || (dcy < 0 && !north))dcy = 0;
    if ((dcx > 0 && !east) || (dcx < 0 && !west))dcx = 0;

    avatar.x = icx + dcx;
    avatar.y = icy + dcy;
}


shared.simulateOnTick = {
    bomb:function (t, cell, entity, world) {
        function blastBomb(c) {
            var bomb = world.entities[c];
            var avatar = world.entities[bomb.own];
            if (avatar)avatar.rb++;
            world.destroyEntity(c); // Remove the bomb
            world.createTemporaryEntity({type:'te_cl', a:"blasto", c:c, ttl:shared.gp_flame_duration_ms, own:bomb.own}); // Create blast center fx
            world.burn(c); // Burn the cell
            propagateFire(c, shared.mapwidth, "blasts", bomb.p,bomb.own);
            propagateFire(c, -shared.mapwidth, "blastn", bomb.p,bomb.own);
            propagateFire(c, 1, "blaste", bomb.p,bomb.own);
            propagateFire(c, -1, "blastw", bomb.p,bomb.own);
        }

        function propagateFire(c, direction, type, pow, own) {
            propagate: for (var i = pow; i > 0; i--) {
                c += direction;
                var e = world.entities[c];
                if (e) {
                    if (e.type === 'bomb') {
                        blastBomb(c);
                        return;
                    } else if (e.type === 'crate') {
                        world.destroyEntity(c); //remove the crate
                        world.createTemporaryEntity({type:"te_co", a:"crateblast", c:c, ttl:1000})
                        var rnd = Math.random();
                        var thresold = 0.;
                        for (var pu_type in shared.gp_power_up) {
                            thresold += shared.gp_power_up[pu_type];
                            if (thresold > rnd) {//This one is selected !
                                world.createEntity(c, {type:pu_type});//create the power up
                                break;
                            }
                        }
                        return;
                    } else if (e.type === 'wall') {
                        return;//obstacle
                    } else {
                        world.burn(c)
                        world.destroyEntity(c); //remove the object
                        world.createTemporaryEntity({type:"te_cl", a:type + "t", c:c, ttl:shared.gp_flame_duration_ms, own:own});
                    }
                }
                if (world.burn(c)) { // This cell has not burn this round
                    world.createTemporaryEntity({type:"te_cl", a:i == 1 ? type + "t" : type, c:c, ttl:shared.gp_flame_duration_ms, own:own});
                }
            }
        }

        if (t > entity.et) { // The explosion time (et) is past
            blastBomb(parseInt(cell));
        }
    },
    avatar:function (t, slotName, avatar, world) {
        var icx = Math.round(avatar.x);
        var icy = Math.round(avatar.y);
        var cell = icx + icy * shared.mapwidth;
        if (world.isburning(cell)) {
            avatar.h = 32 + Math.floor(Math.random() * 24);//random number [1,24]
            avatar.t0 = t;
        }
    }
}


shared.clone = function (obj) {
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
        var len = obj.length
        for (var i = 0; i < len; ++i) {
            copy[i] = shared.clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        var copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = shared.clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}