function Engine(element, options){

    let _this, app;

    new class QuickEngine {

        constructor(){
            _this = this;

            _this.element = element;

            _this.options = LS.Util.defaults({
                scaling: false
            }, options)

            let upFired = true;

            _this.keyReceivers = []

            _this.tickers = {}

            _this.v8 = PIXI.VERSION[0] === "8"

            
            // Following code is mid

            M.on("keyup", "keydown", (event => {
                let isFirst = false

                if(event.type === "keyup") upFired = true; else if (upFired) {
                    isFirst = true
                    upFired = false
                }

                for(let receiver of _this.keyReceivers){
                    if(typeof receiver === "function" && receiver.enabled) receiver({

                        down: event.type === "keydown",
                        isFirst,
                        key: event.key,
                        direction: game.settings.controls.directions.indexOf(event.key.toLowerCase()),
                        main: game.settings.controls.main.includes(event.key.toLowerCase()),
                        cancel: game.settings.controls.cancel.includes(event.key.toLowerCase()),
                        domEvent: event

                    })
                }
            }))

            let scalingEnabled = !!options.scaling;

            Object.defineProperty(_this, "scaling", {
                get(){
                    return scalingEnabled
                },

                set(value){
                    scalingEnabled = !!value

                    if(value){
                        if(element.parentElement) element.parentElement.classList.add("scaling");
                        _this.fixResolution()
                    } else {
                        element.style.transform = ""
                        if(element.parentElement) element.parentElement.classList.remove("scaling");
                    }
                }
            })

            _this.scaling = scalingEnabled

            _this.setResolution()

            M.on("resize", this.fixResolution)
        }

        async initApp(options){

            options = options || {
                width: _this.options.width,
                height: _this.options.height
            }

            if(_this.v8){
                // v8
                PIXI.AbstractRenderer.defaultOptions.roundPixels = true;
                PIXI.TextureStyle.defaultOptions.scaleMode = "nearest"
                PIXI.TextureSource.defaultOptions.mipLevelCount = 0
                PIXI.TextureSource.defaultOptions.antialias = false
            } else {
                // v7 and below
                PIXI.settings.ROUND_PIXELS = true;
                PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
                PIXI.settings.MIPMAP_TEXTURES = PIXI.MIPMAP_MODES.OFF;
            }

            app = new PIXI.Application(_this.v8? null: options)

            if(_this.v8) await app.init(options);

            _this.app = app;

            app.ticker.add(_ticker => {
                if(_this.tickers[_this.activeScreen]) for(let ticker of _this.tickers[_this.activeScreen]) if(ticker) ticker(_ticker.deltaTime, _ticker);
            })

            return app
        }

        onKeypress(callback){
            callback.enabled = true
            _this.keyReceivers.push(callback)

            return {
                callback,

                get enabled(){
                    return callback.enabled
                },
                set enabled(value){
                    callback.enabled = !!value
                }
            }
        }
    
        fixResolution(){
            if(!_this.scaling) return;

            let element = _this.element,
        
            scale = Math.min(
                (_this.options.containerWidth || Number(window.innerWidth)) / _this.options.width,    
                (_this.options.containerHeight || Number(window.innerHeight)) / _this.options.height
            );

            _this.scale = scale

            element.style.transform = `translate(-50%, -50%)` + (_this.options.scale? ` scale(${scale})`: "");
        }
    
        setResolution(w, h){
            if(typeof w === "undefined" && typeof h === "undefined") {
                w = _this.options.width;
                h = _this.options.height;
            }
            
            let aspectRatio = _this.options.width / _this.options.height;
            if(typeof w === "undefined") w = Math.round(h * aspectRatio);
            if(typeof h === "undefined") h = Math.round(w / aspectRatio);
            
            _this.options.width = w;
            _this.options.height = h;
            
            _this.element.applyStyle({width: w +"px", height: h +"px"});
            _this.fixResolution()
    
           if(_this.invoke) _this.invoke("resolution-changed", w, h, aspectRatio)
        }

        async loadFontData(source){
            let csv = await (await fetch(source)).text()
            
            let lines = csv.replaceAll("\r", "").split("\n").map(line => line.split(",")), chars = {}, fontData = {};

            for(let line of lines){
                line = line.map(cell => cell.trim());

                if(line[0].startsWith("Char")){
                    let char = line[0].split(" "), value = +line[1], key = char[2].toLowerCase();

                    if(!chars[char[1]]) chars[char[1]] = {};

                    chars[char[1]][{base: "baseWidth", width: "widthOffset", y: "yOffset", x: "xOffset"}[key] || key] = value
                    continue
                }

                fontData[{
                    "Image Width": "imageWidth",
                    "Image Height": "imageHeight",
                    "Cell Width": "cellWidth",
                    "Cell Height": "cellHeight",
                    "Start Char": "startChar"
                }[line[0]] || line[0]] = line[0] === "Font Name"? line[1] : +line[1]
            }

            fontData.charData = chars;
            return fontData
        }

        font({texture, data}, options = {}){

            // Preloads whatever is needed for optimization

            let characterTextures = {}

            if(!options.vectorFont) texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

            for(let character in data.charData){
                character = +character;

                characterTextures[character] = new PIXI.Texture({
                    source: texture,
                    frame: new PIXI.Rectangle(
                        Math.floor(character % (data.imageWidth / data.cellWidth)) * data.cellWidth,
                        Math.floor(character / (data.imageWidth / data.cellWidth)) * data.cellHeight,
                        data.cellWidth,
                        data.cellHeight
                    )
                })
            }

            return {
                characterTextures,
                texture, data
            }
        }

        screenExists(id){
            return !!game.screens[id]
        }

        layer(container = new PIXI.Container(), object){
            return LS.Util.defaults({
                container,

                isLayerObject: true,

                text(text, options = {}){
                    options.target = container
                    return _this.text(text, options)
                },

                add(item){
                    container.addChild(item.isLayerObject? item.container: item)
                }
            }, object)
        }

        async createScreen(id, selfCallback){
            if(game.screens[id]) return game.screens[id];

            let container = new PIXI.Container(), events = {
                activate: []
            };

            _this.tickers[id] = [];

            game.screens[id] = _this.layer(container, {

                events,

                isScreenObject: true,

                onActivated(callback){
                    events.activate.push(callback)
                },

                addTicker(callback){
                    _this.tickers[id].push(callback)
                },

                keyboardEvents(callback){
                    callback.screen = id;
                    return _this.onKeypress(callback)
                },

                removeTicker(callback){
                    let index = _this.tickers[id].indexOf(callback)
                    delete _this.tickers[id][index]
                }
            })

            if(selfCallback) game.screens[id].loadPromise = selfCallback(game.screens[id]);

            await game.screens[id].loadPromise;

            return game.screens[id]
        }

        async switchScreen(id) {
            if(game.screens[id].loadPromise) await game.screens[id].loadPromise;

            if(game.screens[_this.activeScreen]) game.screens[_this.activeScreen].container.removeFromParent();

            app.stage.removeChildren();

            if(_this.keyReceivers) for(let receiver of _this.keyReceivers) if(receiver.hasOwnProperty("screen")) receiver.enabled = receiver.screen === id;

            _this.activeScreen = id

            viewPort.onclick = null;

            for(let listener of game.screens[id].events.activate) listener(game.screens[id])
            app.stage.addChild(game.screens[id].container);
        }

        clearAll(){
            app.stage.removeChildren();
        }

        screen(id){
            return game.screens[id]
        }

        createWorld(options, screen){
            let screenCenterX = app.screen.width / 2, screenCenterY = app.screen.height / 2;

            let world = {
                container: new PIXI.Container(),
    
                mapSprite: new PIXI.Sprite(),
    
                rooms: {},

                createRooms(rooms){
                    for(let id in rooms){
                        world.createRoom(id, rooms[id])
                    }
                },
    
                createRoom(id, options){
                    world.rooms[id] = options

                    if(!world.rooms[id].objects) world.rooms[id].objects = [];
                    
                    world.rooms[id].createObject = function (options) {
                        world.createRoomObject(world.rooms[id], options)
                    }

                    world.rooms[id].addObjects = function (objects) {
                        for(let object of objects){
                            world.rooms[id].createObject(object)
                        }
                    }

                    if(world.rooms[id].objects){
                        let objects = world.rooms[id].objects;
                        world.rooms[id].objects = []
                        world.rooms[id].addObjects(objects)
                    }

                    return world.rooms[id]
                },

                createRoomObject(room, object){

                    if(object.createVisual){
                        object.sprite = new PIXI.Sprite(object.baseTexture)

                        let x = object.x || 0, y = object.y, width = object.width || 0, height = object.height;

                        Object.defineProperties(object, {
                            get x(){
                                return x
                            },

                            set x(value){
                                x = value
                                object.sprite.position.x = value
                            },

                            get y(){
                                return y
                            },

                            set y(value){
                                y = value
                                object.sprite.position.y = value
                            },

                            get width(){
                                return width
                            },

                            set width(value){
                                width = value
                                if(object.followDimension) object.sprite.width = value
                            },

                            get height(){
                                return height
                            },

                            set height(value){
                                height = value
                                if(object.followDimension) object.sprite.height = value
                            }
                        })
                    }

                    // FIXME: FIX THIS
                    if(object.slope){
                        object.onMovement = (rect, incrementX, incrementY) => {
                            if(object.angle === -45) {
                                let slopeY = object.y + (rect.x + incrementX - object.x);
        
                                if(object.side === "top"){
                                    if (incrementY > 0 && (rect.y + incrementY) > slopeY) {
                                        const overlap = rect.y + incrementY - slopeY;
                                        player.moveBy(player.speed, incrementY - overlap);
                                    }
            
                                    else if (incrementX < 0 && rect.y > slopeY) {
                                        player.moveBy(0, slopeY - rect.y);
                                    }
                                } else {
                                    if (incrementY < 0 && (rect.y + incrementY) < slopeY) {
                                        const overlap = rect.y + incrementY - slopeY;
                                        player.moveBy(-player.speed, incrementY - overlap);
                                    }
            
                                    else if (incrementX > 0 && rect.y < slopeY) {
                                        player.moveBy(0, slopeY - rect.y);
                                    }
                                }
                            } else if (object.angle === 45) {
                                let slopeY = object.y + (object.width - (rect.x + incrementX - object.x));
        
                                if (object.side === "top") {
                                    if (incrementY > 0 && (rect.y + incrementY) > slopeY) {
                                        const overlap = rect.y + incrementY - slopeY;
                                        player.moveBy(-player.speed, incrementY - overlap);
                                    }
        
                                    else if (incrementX > 0 && rect.y > slopeY) {
                                        player.moveBy(0, slopeY - rect.y);
                                    }
                                } else {
                                    if (incrementY < 0 && (rect.y + incrementY) < slopeY) {
                                        const overlap = rect.y + incrementY - slopeY;
                                        player.moveBy(player.speed, incrementY - overlap);
                                    }
        
                                    else if (incrementX < 0 && rect.y < slopeY) {
                                        player.moveBy(0, slopeY - rect.y);
                                    }
                                }
                            }
                        }
                    }

                    object.id = room.objects.push(object) - 1
                    return object
                },
    
                _room: 0,
    
                get room(){
                    return world._room
                },
    
                changeRoom(value){
                    if(!world.rooms[value]) return;
    
                    let room = world.rooms[value];
    
                    world._room = value
                    world.container.removeChildren()
    
                    world.mapSprite.texture = room.baseTexture
                    world.container.addChild(world.mapSprite)
    
                    player.x = room.defaultSpawn? room.defaultSpawn.x: 0
                    player.y = room.defaultSpawn? room.defaultSpawn.y: 0
                    // camera.update()
                    // world.container.addChild(world.rooms[value].map)
                },
    
                get currentRoom(){
                    return world.rooms[world._room]
                },
    
                initialize(){
                    camera.scale = camera._scale;
                    player.setFrame("down0")
                    setTimeout(() => {
                        camera.container.visible = true
                    }, 0)
                },

                defaultTicker(delta) {
                    const activeDirection = player.keyStates.indexOf(true);
        
                    player.walking = activeDirection > -1;
        
                    if (player.walking) {
                        player.direction = activeDirection;
        
                        let incrementX = 0, incrementY = 0;
        
                        // Calculate movement increment
                        if(player.keyStates[2]) incrementX -= player.speed * delta; else if(player.keyStates[3]) incrementX += player.speed * delta;
                        if(player.keyStates[0]) incrementY -= player.speed * delta; else if(player.keyStates[1]) incrementY += player.speed * delta;
        
                        // Floor movement - Can help achieve more pixel-perfect movement but is less smooth
                        // incrementX = Math.floor(incrementX)
                        // incrementY = Math.floor(incrementY)
        
                        let collision = player.moveBy(incrementX, incrementY, true)
        
                        if(player.direction < 2? !collision[1]: !collision[0]){
                            // Animation
                            player.frameTimer += delta;
                            if (player.frameTimer > 15 - (player.speed * 2)) {
                                player.frameTimer = 0;
                                player.frameIndex = (player.frameIndex + 1) % (player.direction < 2? 4: 2); // Loop through the 4 animation frames
                            }
                        } else player.frameIndex = 0;

                        player.setFrame(player.directions[player.direction] + player.frameIndex);
        
                    } else {
        
                        // Idle frame
                        player.setFrame(player.directions[player.direction] + "0");
        
                    }

                    let target = world.currentRoom.objects[world.interactingObject]

                    if(target){
                        if(player.keyStates[4]){
                            if(!target.pressed) {
                                target.pressed = true
                                if(target.onPress) target.onPress()
                            }

                            if(target.onPressingFrame) target.onPressingFrame(delta)
                        } else {
                            if(target.pressed) {
                                target.pressed = false
                                if(target.onRelease) target.onRelease()
                            }
                        }
                    }
                }
            }

            let player = {

                container: new PIXI.Container(),
    
                baseWidth: 20,
                baseHeight: 30,
                collisionHeight: 11,
    
                spriteMargin: 3,
    
                currentFrame: null,
    
                sprite: new PIXI.Sprite(game.assets.frisk),
    
                frames: {},
    
                setFrame(id){
                    if(id === player.currentFrame || !player.frames[id]) return false;
    
                    player.currentFrame = id

                    if(_this.v8) {

                        // Fuck you PIXI v8, why do I have to do all this now
                        player.sprite.texture.frame.copyFrom(player.frames[id])
                        player.sprite.texture.updateUvs()
                        player.sprite.onViewUpdate()

                    } else {
                        player.sprite.texture.frame = player.frames[id]
                    }

                    return true
                },
    
                _x: 0,
                _y: 0,
    
                get x(){
                    return player._x
                },
    
                set x(value){
                    player._x = value
                    camera.updateX()
                },
    
                get y(){
                    return player._y
                },
    
                set y(value){
                    player._y = value
                    camera.updateY()
                },

                moveBy(incrementX, incrementY, naturalMovement){
                    const collision = engine.collides(world, {
                        x: player._x,
                        y: player._y,
                        width: player.baseWidth,
                        height: player.collisionHeight
                    }, incrementX, incrementY, naturalMovement)
    
                    // Move player
                    if(!collision[0]) player.x += incrementX;
                    if(!collision[1]) player.y += incrementY;

                    return collision
                },

                fixPixelPosition(){
                    player.x = Math.floor(player._x)
                    player.y = Math.floor(player._y)
                },
    
                speed: 2,
    
                frameTimer: 0,
                frameIndex: 0,
    
                directions: ["up", "down", "left", "right"],
                keyStates: [false, false, false, false],
                
                direction: 3,
                walking: false
    
            }
    
            player.frames = {
                down0:  { x: (player.baseWidth + player.spriteMargin) * 0, y: 0, width: player.baseWidth, height: player.baseHeight },
                down1:  { x: (player.baseWidth + player.spriteMargin) * 1, y: 0, width: player.baseWidth, height: player.baseHeight },
                down2:  { x: (player.baseWidth + player.spriteMargin) * 2, y: 0, width: player.baseWidth, height: player.baseHeight },
                down3:  { x: (player.baseWidth + player.spriteMargin) * 3, y: 0, width: player.baseWidth, height: player.baseHeight },
    
                up0:    { x: (player.baseWidth + player.spriteMargin) * 0, y: (player.baseHeight * 2), width: player.baseWidth, height: player.baseHeight },
                up1:    { x: (player.baseWidth + player.spriteMargin) * 1, y: (player.baseHeight * 2), width: player.baseWidth, height: player.baseHeight },
                up2:    { x: (player.baseWidth + player.spriteMargin) * 2, y: (player.baseHeight * 2), width: player.baseWidth, height: player.baseHeight },
                up3:    { x: (player.baseWidth + player.spriteMargin) * 3, y: (player.baseHeight * 2), width: player.baseWidth, height: player.baseHeight },
    
                left0:  { x: (player.baseWidth + player.spriteMargin) * 0, y: player.baseHeight, width: player.baseWidth, height: player.baseHeight },
                left1:  { x: (player.baseWidth + player.spriteMargin) * 1, y: player.baseHeight, width: player.baseWidth, height: player.baseHeight },
    
                right0: { x: (player.baseWidth + player.spriteMargin) * 2, y: player.baseHeight, width: player.baseWidth, height: player.baseHeight },
                right1: { x: (player.baseWidth + player.spriteMargin) * 3, y: player.baseHeight, width: player.baseWidth, height: player.baseHeight },
            }

            let camera = {
                _scale: 2,
    
                container: new PIXI.Container(),
    
                isLayerObject: true,
    
                get scale(){
                    return camera._scale
                },
    
                set scale(value){
                    camera._scale = value
                    camera.container.scale = {x: value, y: value}
                    camera.updateX()
                    camera.updateY()
                },
    
                _x: 0,
                _y: 0,
    
                get x(){
                    return camera._x
                },
    
                set x(value){
                    camera._x = value
                    camera.container.position.x = value
                },
    
                get y(){
                    return camera._y
                },
    
                set y(value){
                    camera._y = value
                    camera.container.position.y = value
                },
    
                updateX(){
                    // Update world and player position

                    const centerX = (screenCenterX / camera._scale) - (player.sprite.width / 2);
    
                    // Adjust for player collision
                    const playerX = player.x;

                    if(playerX < centerX || world.mapSprite.width <= screenCenterX){
                        world.container.position.x = 0;
                        player.container.position.x = playerX;
                    } else {
                        world.container.position.x = - playerX + centerX;
                        player.container.position.x = centerX;
                    }
                },
    
                updateY(){
                    // Update world and player position

                    const centerY = (screenCenterY / camera._scale) - (player.sprite.height / 2);

                    // Adjust for player collision
                    const playerY = player.y - (player.baseHeight - player.collisionHeight);
    
                    if(playerY < centerY || world.mapSprite.height <= screenCenterY){
                        world.container.position.y = 0;
                        player.container.position.y = playerY;
                    } else {
                        world.container.position.y = - playerY + centerY;
                        player.container.position.y = centerY;
                    }
                },
            }

            player.container.addChild(player.sprite)

            camera.container.addChild(world.container)
            camera.container.addChild(player.container)
            camera.container.visible = false

            let battle_buttons = [
                new PIXI.Sprite(game.assets.battle_button_fight),
                new PIXI.Sprite(game.assets.battle_button_act),
                new PIXI.Sprite(game.assets.battle_button_item),
                new PIXI.Sprite(game.assets.battle_button_mercy)
            ], battleContainer = new PIXI.Container;

            let padding = (((app.screen.width - 20) - (battle_buttons.length * battle_buttons[0].width)) / battle_buttons.length), offset = padding - 10;

            for(let button of battle_buttons){
                button.y = app.screen.height - button.height - 6;
                button.x = offset
                offset += padding + button.width;
                battleContainer.addChild(button)

            }
            
            screen.container.addChild(battleContainer)
            
            let undertale = {
                soul: new PIXI.Sprite(game.assets.soul),

                battleAreaRect: new PIXI.Graphics(),

                soulCollisoin(){

                },

                inBattle: false,

                battleGUI(){

                },

                startBattle(){
                    undertale.inBattle = true;
                    camera.container.visible = false;
                    battleContainer.visible = true;

                    undertale.battleAreaRect.position.y = app.screen.height - 6 - battle_buttons[0].height - 42 - 130 - 8;

                    let width = 20, targetWidth = app.screen.width - 64 - 8;

                    screen.addTicker((delta, ticker) => {
                        // Rectangle animation
                        if(width > targetWidth){
                            undertale.drawRect(targetWidth)
                            ticker.stop()
                        }

                        undertale.drawRect(width);
                        width += delta * 16
                    })
                },

                projectile(source, ticker){
                    // 
                },

                drawRect(width = app.screen.width - 64, height = 130, center = true){
                    undertale.battleAreaRect.clear().rect(0, 0, width, height).fill({
                        color: 0x000000
                    }).stroke({
                        width: 4,
                        color: 0xffffff,
                        anchor: 0
                    })

                    if(center) undertale.battleAreaRect.position.x = (app.screen.width - width - 8) / 2
                }
            }

            battleContainer.addChild(undertale.battleAreaRect)

            if(screen) world.keyEvents = screen.keyboardEvents(event => {
                if(undertale.inBattle) return;

                if(event.main) player.keyStates[4] = event.down; else {
                    player.keyStates[event.direction] = event.down
                }
            });

            return { world, player, camera, undertale }
        }

        collides(world, rect, incrementX = 0, incrementY = 0, naturalMovement = false){
            let result = [false, false]

            /*
                A fast collision checker that checks for bounds, rectangle and pixel collisions on both X and Y coordinates
            */

            // Room bounds
            if(world.currentRoom.bounds) {
                result = [!engine.AABB(rect, world.currentRoom.bounds, incrementX, 0), !engine.AABB(rect, world.currentRoom.bounds, 0, incrementY)]
            }

            // Rectangle based collisions
            if(world.currentRoom.objects) for(let object of world.currentRoom.objects){
                const collidesX = engine.AABB(rect, object, incrementX, 0);
                const collidesY = engine.AABB(rect, object, 0, incrementY);
                const collides = collidesX || collidesY

                if(collides){
                    // Object move and enter events:
                    if(naturalMovement){
                        if(!object.collides && object.onEnter) object.onEnter(rect, incrementX, incrementY, collidesX, collidesY);
                        if(object.onMovement) object.onMovement(rect, incrementX, incrementY, collidesX, collidesY);
                    }

                    world.interactingObject = object.id

                    // Collision
                    if(object.solid) {
                        if(collidesX) result[0] = true
                        if(collidesY) result[1] = true

                        if(collidesX && collidesY) return result;
                    }
                } else if(naturalMovement) {
                    // Object leave event:
                    if(object.collides && object.onLeave) {
                        object.onLeave(rect, incrementX, incrementY, collidesX, collidesY)
                        if(world.interactingObject === object.id) world.interactingObject = null;
                    }
                }

                object.collides = collides
            }

            // Pixel-Perfect collision mask
            if(world.currentRoom.pixelCollisionMask) {
                if(!result[0]) result[0] = engine.pixelCollision(world.currentRoom.pixelCollisionMask, rect, incrementX, 0)
                if(!result[1]) result[1] = engine.pixelCollision(world.currentRoom.pixelCollisionMask, rect, 0, incrementY)
            }

            return result
        }

        pixelCollision(mask, rect, incrementX, incrementY){
            const positionX = rect.x + incrementX;
            const positionY = rect.y + incrementY;

            /*
                The engine offers a pixel-collision detection with its own mask format, designed to be as efficient as possible.
                You can create a mask from an image using the createCollisionMask function found in engine/misc.js
            */

            for(let y = Math.floor(positionY); y < Math.ceil(positionY) + rect.height; y++){
                if(mask[y]){
                    for (const [startX, endX] of mask[y]) {
                        if(
                            positionX < endX &&
                            positionX + rect.width > startX &&
                            y >= positionY &&
                            y < positionY + rect.height
                        ) return true
                    }
                }
            }

            return false
        }

        AABB(rect, rect2, incrementX = 0, incrementY = 0) {
            const positionX = rect.x + incrementX;
            const positionY = rect.y + incrementY;

            return (
                positionX < rect2.x + rect2.width &&
                positionX + rect.width > rect2.x &&
                positionY < rect2.y + rect2.height &&
                positionY + rect.height > rect2.y
            );
        }

        text(text, options = {}){

            options = LS.Util.defaults({
                x: 0,
                y: 0,
                nextDelay: 0,
                letterSpacing: 0,
                lineHeight: 4,
                size: null,
                font: game.fonts.bitmap.Determination,
                wrap: true,
                wrapRect: null,
                color: 0xffffff,
                target: app.stage,
                textAlign: "left",
                scale: 1
            }, options)

            if(options.x === "center") options.x = app.screen.width / 2;
            if(options.y === "center") options.y = app.screen.height / 2;

            if(options.target.isScreenObject) options.target = options.target.container;

            let xPos = 0, yPos = 0, i = -1, doneCallback, sprites = [], container = new PIXI.Container();

            container.position.x = options.x;
            container.position.y = options.y;

            function drawNextChar(){
                i++;

                let spriteCallback;
                
                let char = text[i];

                if(options.iterator){                    
                    options.iterator({
                        i, char: text[i], text, xPos, yPos, escape: char === "\x1B", container,

                        onSprite(callback){
                            spriteCallback = callback
                        },

                        drawNextChar
                    }, options)
                }

                if(options.break) return;

                const charCode = text.charCodeAt(i) - options.font.data.startChar; // Get the character's index in the spritesheet
                const charMetrics = options.font.data.charData[charCode];

                options.target.addChild(container)

                if ((charMetrics && !options.skip) || [" ", "\n"].includes(char)) {

                    let sprite;

                    if(charMetrics){
                        sprite = new PIXI.Sprite(options.font.characterTextures[charCode]);
    
                        sprite.position.x = xPos + charMetrics.xOffset;
                        sprite.position.y = yPos + charMetrics.yOffset;

                        sprite.scale = {x: options.scale, y: options.scale};
    
                        if(char !== "\x81") sprite.tint = options.color;

                        if(spriteCallback) spriteCallback(sprite)

                        // charSprite.width = charMetrics.baseWidth + charMetrics.widthOffset; // Adjust width with offset
                        // charSprite.height = options.font.data.cellHeight;

                        if(sprite && !sprite.destroyed) {

                            container.addChild(sprite)
                            sprites.push(sprite)
                            
                            xPos += ((charMetrics.baseWidth || sprite.width) + options.letterSpacing) * options.scale;

                        } else sprite = null;
                    }

                    if(options.space) xPos += options.space, options.space = null;

                    if((options.wrap && xPos > app.screen.width) || char === "\n" || options.lineBreak){
                        xPos = 0
                        yPos += options.font.data.cellHeight + options.lineHeight
                    }
                }

                if(options.textAlign === "center") {
                    container.position.x = options.x - (container.width / 2)
                }

                if(i === text.length - 1) {
                    if(doneCallback) doneCallback()
                } else {
                    if(options.nextDelay < 1) drawNextChar(); else {
                        setTimeout(() => drawNextChar(), options.nextDelay)
                    }
                }
            }

            drawNextChar()

            function swap(index, charCode){
                if(!sprites[index]) return false
                sprites[index].texture = options.font.characterTextures[charCode];
                return true
            }

            return {
                done(callback){
                    doneCallback = callback
                },

                sprites,

                container,

                color(color){
                    for(let sprite of sprites){
                        sprite.tint = color
                    }
                },

                update(newText, from = 0, to = -1){
                    let j = -1
                    for(let i = from; i < (to < 0? newText.length: to); i++){
                        j++                        
                        swap(i, i >= newText.length? 0: (newText.charCodeAt(j) - options.font.data.startChar));
                    }
                },

                moveBy(x, y){
                    container.position.x += x
                    container.position.y += y
                },

                swap(index, charCode){
                    return swap(index, charCode)
                },

                hide(){
                    for(let sprite of sprites){
                        sprite.visible = false
                    }
                },

                show(){
                    for(let sprite of sprites){
                        sprite.visible = true
                    }
                },

                destroy(){
                    options.break = true;
                    container.destroy({ children: true, texture: false })
                }
            }
        }

        decodeCollisionMask(encoded) {
            const collisionMask = {};
            let index = 0;

            while (index < encoded.length) {
                const yCoord = encoded[index] | (encoded[index + 1] << 8);
                index += 2;

                const numRanges = encoded[index];
                index += 1;

                const ranges = [];
                for (let i = 0; i < numRanges; i++) {
                    const start = encoded[index] | (encoded[index + 1] << 8);
                    index += 2;
                    const end = encoded[index] | (encoded[index + 1] << 8);
                    index += 2;
                    ranges.push([start, end]);
                }

                collisionMask[yCoord] = ranges;
            }
        
            return collisionMask;
        }
    }

    _this.animation = {
        fadeIn(container, duration = 1000, onComplete = null) {
            container.alpha = 0;
            let elapsed = 0;
        
            const ticker = new PIXI.Ticker();

            ticker.add(ticker => {
                elapsed += ticker.deltaTime * PIXI.Ticker.shared.deltaMS;
                container.alpha = Math.min(elapsed / duration, 1);
        
                if (elapsed >= duration) {
                    container.alpha = 1;
                    ticker.stop();
                    ticker.destroy();
                    if (onComplete) onComplete();
                }
            });

            ticker.start();
        }
    }

    return _this

}
