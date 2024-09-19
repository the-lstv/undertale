let app, engine, viewPort, game;

/*
    This is the first file that runs and is responsible for initization of the engine and other game related objects + loading assets.
    No game logic is to be found here.
*/

LS.once("body-available", async function () {
    viewPort = O("#viewPort");

    engine = new Engine(viewPort, {
        width: 640, height: 480,
        scale: true
    });
    

    PIXI.settings.ROUND_PIXELS = true;
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

    app = new PIXI.Application({
        width: engine.width,
        height: engine.height,
        roundPixels: true,
        // autoDensity: true,
        // resolution: 1,
        antialias: false,
        // forceCanvas: true
    });

    game = {
        engine,
        renderer: app,

        assets: {
            DeterminationBitmap: "/assets/fonts/determination/font.png?cache=0",

            menu_mountain: "/assets/sprites/menu/mountain.png"
        },

        screens: {},

        settings: {
            controls: {
                main: ["z", "enter"],
                cancel: ["x"],
                directions: ["arrowleft", "arrowright", "arrowup", "arrowdown"] // left, right, up, down
            }
        }
    }

    for(let id in game.assets){
        game.assets[id] = await PIXI.Assets.load(game.assets[id])
    }

    game.fonts = {
        bitmap: {
            Determination: engine.font({texture: game.assets.DeterminationBitmap, data: await engine.loadFontData("/assets/fonts/determination/FontData.csv?cache=4")})
        }
    }

    viewPort.add(app.view);

    let loadTime = Date.now() - (window.tsl || Date.now()), delay = Math.max(1000 - loadTime, 0);

    // Move on to game.js
    start(loadTime)

    // Splash screen
    setTimeout(() => {
        viewPort.show();

        // Splash screen
        let clickTimeout = setTimeout(() => {
            O(".clickToContinue").show()
        }, 2500)

        O("#splash").on("click", () => {
            clearTimeout(clickTimeout);
            O("#splash").hide()

            engine.switchScreen("menu")
        })
    }, delay)
})