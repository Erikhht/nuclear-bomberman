function startup() {
    var animations;
    var animation;
    var x = 400;
    var y = 300;
    var currentFrame = 0;
    var canvas = $("canvas")[0];
    var context = canvas.getContext('2d');
    var sprites = $('<img src="sprites.png"/>')[0];

    $.ajax({
        url:"ani.json",
        success:function (data) {
            console.log("animations loaded");
            animations = data;
            var control = $('select');
            $.each(animations, function (key, value) {
                control.append("<option value='" + key + "'>" + key + "</option>");
            });
        },
        failure:function (data) {
            alert("Failed to load maps.json.");
        }
    });

    $("select").change(function () {
        animation = animations[$(this).val()];
        x = canvas.width * .5;
        y = canvas.height * .5;
        currentFrame = animation.frames.length - 1;
    });

    function tick() {
        if (!animation)return;
        currentFrame = (currentFrame + 1) % animation.frames.length;
        var frame = animation.frames[currentFrame];
        context.clearRect(0, 0, canvas.width, canvas.height);//Clear all
        context.drawImage(sprites, frame.x, frame.y, frame.w, frame.h, x + frame.xo, y + frame.yo, frame.w, frame.h); //Draw the sprite
        //Draw a cross at the center of the sprite
        context.beginPath();
        context.moveTo(x-5,y);
        context.lineTo(x+5,y);
        context.moveTo(x,y-5);
        context.lineTo(x,y+5);
        //Draw a rectangle around the sprite
        context.rect( x + frame.xo, y + frame.yo, frame.w, frame.h);
        context.stroke();
    }
    setInterval(tick, 1000 /16);
}
$().ready(startup);