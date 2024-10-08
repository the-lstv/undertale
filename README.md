# the-lstv/undertale

A robust Undertale fangame engine, creted entirely from scratch, pure code, no WYSIWYG.<br>
Uses WebGL for rendering, and thus is also really fast and flexible.<br><br>
So far its pretty early in development, but it already has a bunch to offer.<br>
The engine features a fast and feature-rich text renderer that can handle basically all of your needs, including custom individual character behavior.<br>
On top of that, it features all the standard features like scenes, rooms, fast collisions (pixel-perfect and rectangle modes), universal event handling, slopes and game objects, triggers, battle components etc.<br>
It makes creating Undertale fangames a lot easier.
<br><br>
Check out /game/sample.js to see sample game logic and /engine/engine.js for the engine.
<br><br>Written entirely in JS and GLSL.<br>
Version 1.0 [alpha 3.1] - Nothing is finalized yet<br>

## Pixel-Perfect
<img width="139" alt="Frisk Sprite" src="https://cdn.extragon.cloud/file/415be27d61c60d09eec631d4420293ee.png"><br>
We made absolutely sure that the engine renders the game pixel-perfect, precisely as the original. This gives it a genuine and high-quality feeling, even though they use completely different engines.<br>
The renderer is specifically configured for pixelart and uses the same pixel scaling and resolution as Undertale does.<br>
I think that for a web-based Undertale engine, this does pretty good! Performance-wise it is also not bad, the only major bottleneck now is the painfully slow DOM keyboard/mouse events.

## Light-weight and fast
The entire engine is under 500kB, without compression.<br>
This makes it a very light-weight solution. It is more than 5x smaller than my previous engine used to make FanTale, while having an insane performance and quality boost.<br>
<!--Thanks to this, it is simple to run this game from the web or on low-power devices like mobile phones, while maintaining a stable framerate.<br>
The engine uses PIXI.js v7 as the renderer. (Not v8 at this moment since it is a bit more complicated to set up correctly and uses esm). PIXI is the fastest 2D web rendering engine that exists - link -->


<br>

### Can you guess which screenshot is from the actual game and which is from this engine? (You cannot, there is 0% difference)
![Group 356 (1)](https://github.com/user-attachments/assets/9bc721a4-4dad-46fb-9c71-7532c0c4756b)

![download (1)](https://github.com/user-attachments/assets/5001d623-c373-41a9-941d-92f457b30fd1)

### Map editor
This is still too early in development, but we are working on a full blown map editor to make it easy to create maps!<br>
Who knows, maybe one day it will become an entire SDK.<br>
![Screenshot from 2024-09-25 14-00-25](https://github.com/user-attachments/assets/1878e17c-54c5-4329-9322-45e3442fb4f0)
<!--
### Build instructions
- **With Akeno:** Simply clone the repo, add the directory to your Akeno app list and you are done, you can run the game from the local server.<br>
To package/build to export for static platforms (eg. native application), you can use the `akeno bundle -a` command to create a ready-to-use offline package. The "-a" flag is required to keep the original structure and include all assets, otherwise the bundler will ignore them.<br>
- **Without Akeno:** you should be able to use a pre-compiled version of index.html and it should just work like a static web app (i think). -->
