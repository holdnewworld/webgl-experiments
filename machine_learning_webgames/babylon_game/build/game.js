/**
 * Neural network
 *
 * @author Glenn De Backer <glenn@simplicity.be>
 *
 */
class NN {

  /**
   * Default constructor
   */
  constructor(downSampledSize, hiddenLayer = 100, outputLayer = 2) {
    // setup our network
    this.inputLayer = new synaptic.Layer(downSampledSize * downSampledSize);
    this.hiddenLayer = new synaptic.Layer(hiddenLayer);
    this.outputLayer = new synaptic.Layer(outputLayer);

    this.inputLayer.project(this.hiddenLayer);
    this.hiddenLayer.project(this.outputLayer);

    this.network = new Network({
      input: this.inputLayer,
      hidden: [this.hiddenLayer],
      output: this.outputLayer
    });
  }

  /**
   * Classify
   * @param  {Array} inputs to classify
   * @return {float} label
   */
  classify(inputs) {
    return this.network.activate(inputs);
  }

  /**
   * Import Network
   * @param  {string} jsonNetwork json
   */
  importNetwork(jsonNetwork) {
    this.network = Network.fromJSON(jsonNetwork);
  }

}
/**
 * Painter control
 *
 * @author Glenn De Backer <glenn@simplicity.be>
 */
class Painter {

  /**
   * Default constructor
   * @param  {string} canvasElemId    id of canvas element
   * @param  {int} downSampledSize    downsampled size (wxh)
   */
  constructor(canvasElemId, downSampledSize) {

    // store events
    this._events = {};

    // get canvas element and its context
    this.paintCanvasElem = document.getElementById(canvasElemId);
    this.paintCanvasCTX = this.paintCanvasElem.getContext('2d');

    // output size
    this.downSampledSize = downSampledSize;

    // mouse properties
    this.mouse = {};

    // is drawing properties
    this.isDrawing = false;

    // is locked
    this.isLocked = true;

    // setup events
    this.setupEvents();

    // setup background color
    this.setupBackground();

    // setup build resize target Canvas
    this.buildResizeCanvas();
  }

  /**
   * Build resize canvas
   */
  buildResizeCanvas() {
    // create output canvas
    this.outputCanvasElem = document.createElement("canvas");
    this.outputCanvasElem.setAttribute("id", "output-canvas");
    this.outputCanvasElem.setAttribute("width", this.downSampledSize);
    this.outputCanvasElem.setAttribute("height", this.downSampledSize);

    // append output canvas
    document.body.appendChild(this.outputCanvasElem);
  }

  /**
   * Clear drawing
   */
  clear() {
    // fill rect
    this.paintCanvasCTX.fillRect(0, 0, this.paintCanvasElem.width, this.paintCanvasElem.height);

    // copy output to canvas
    this.copyOutputCanvas();
  }

  /**
   * Copy to output canvas
   */
  copyOutputCanvas() {
    // copy to output context (which will be processed)
    pica.resizeCanvas(this.paintCanvasElem, this.outputCanvasElem, {}, function () {});
  }

  /**
   * Setup events
   */
  setupEvents() {
    // mouse down
    this.paintCanvasElem.addEventListener('mousedown', function (element) {
      if (!this.isLocked) {
        this.isDrawing = true;
      }
    }.bind(this));

    // mouse up
    this.paintCanvasElem.addEventListener('mouseup', function (element) {
      if (!this.isLocked) {
        this.isDrawing = false;

        // copy drawing to resize output canvas
        this.copyOutputCanvas();
      }
    }.bind(this));

    // mouse move
    this.paintCanvasElem.addEventListener('mousemove', function (element) {
      if (!this.isLocked) {
        // store coordinates
        this.mouse.previousX = this.mouse.currentX;
        this.mouse.previousY = this.mouse.currentY;
        this.mouse.currentX = element.offsetX;
        this.mouse.currentY = element.offsetY;

        if (this.isDrawing) {
          this.updateDrawing();
        }
      }
    }.bind(this));

    // mouse out
    this.paintCanvasElem.addEventListener('mouseout', function (element) {
      // raise event pass downsampled result
      this.raiseEvent('ON_MOUSE_OUT');
    }.bind(this));
  }

  addListener(eventName, callback) {
    let events = this._events,
        callbacks = events[eventName] = events[eventName] || [];
    callbacks.push(callback);
  }

  raiseEvent(eventName, args) {
    let callbacks = this._events[eventName];
    for (let i = 0, l = callbacks.length; i < l; i++) {
      callbacks[i].apply(null, args);
    }
  }

  setupBackground() {
    // background
    this.paintCanvasCTX.fillStyle = '#000000';
    this.paintCanvasCTX.fill();

    this.paintCanvasCTX.beginPath();
    this.paintCanvasCTX.rect(0, 0, this.paintCanvasElem.width, this.paintCanvasElem.height);
    this.paintCanvasCTX.fillStyle = '#000000';
    this.paintCanvasCTX.fill();
  }

  /**
   * Update drawing
   */
  updateDrawing() {
    // line
    this.paintCanvasCTX.strokeStyle = '#ffffff';
    this.paintCanvasCTX.lineJoin = 'round';
    this.paintCanvasCTX.lineCap = 'round';
    this.paintCanvasCTX.lineWidth = 10;

    this.paintCanvasCTX.beginPath();
    this.paintCanvasCTX.moveTo(this.mouse.currentX, this.mouse.currentY);
    this.paintCanvasCTX.lineTo(this.mouse.previousX, this.mouse.previousY);
    this.paintCanvasCTX.stroke();
    this.paintCanvasCTX.closePath();
  }

  /**
   * Lock prevents drawing
   */
  lock() {
    this.isLocked = true;
  }

  /**
   * Unlock
   */
  unlock() {
    this.isLocked = false;
  }

  /**
   * Get downsampled pixels
   */
  getDownSampledAndNormalizedPixels() {

    // create promise object
    let promise = new Promise(function (resolve, reject) {

      let pixels = [];

      // get pixels data
      let ctx = this.outputCanvasElem.getContext('2d');
      let pixelsData = ctx.getImageData(0, 0, this.outputCanvasElem.width, this.outputCanvasElem.height).data;

      // iterate over pixel data
      for (let i = 0; i < pixelsData.length; i += 4) {
        // get R values (as G,B is the same when using B&W)
        let red = pixelsData[i];

        // normalize between 0.0 and 1.0
        // and store into pixels array
        pixels.push(red / 255.0);
      }

      // resolve pixels
      resolve(pixels);
    }.bind(this));

    return promise;
  }
}
/**
 * Game class
 *
 * @author Glenn De Backer <glenn@simplicity.be>
 */
class Game {

  /**
   * Default constructor
   */
  constructor() {
    // init our painter control
    this.paintControl = new Painter('drawing-canvas', 24);

    // store render canvas
    this.renderCanvas = document.getElementById('render-canvas');

    // setup babylonjs engine
    this.engine = new BABYLON.Engine(this.renderCanvas, true);

    // init some variables
    this.activeTileName = '';

    // hold our models
    this.models = [];

    // hold our animations
    this.animations = [];

    // load settings
    this.loadSettings().then(function (settings) {
      // store our settings
      this.settings = JSON.parse(settings);

      // load neural Network
      this.loadNeuralNetwork().then(function (network) {

        // construct ANN
        this.neuralnetwork = new NN(this.settings.neuralnetwork.input, this.settings.neuralnetwork.hidden, 2);

        // import trained network
        this.neuralnetwork.importNetwork(JSON.parse(network));
      }.bind(this));
    }.bind(this));

    // create scene
    this.createScene().then(function () {
      // setup events
      this.setupEvents();

      // when ready register render loop
      this.registerRenderLoop();
    }.bind(this));
  }

  /**
   * Reset
   */
  reset() {
    // remove any models
    for (let modelName in this.models) {
      this.models[modelName].dispose();
    }

    // reset any previous tiles classification
    for (let tileName in this.tiles) {
      this.tiles[tileName].classification = null;
    }
  }

  /**
   * Load settings
   */
  loadSettings() {
    // create promise object
    let promise = new Promise(function (resolve, reject) {
      var xhrReq = new XMLHttpRequest();

      xhrReq.onreadystatechange = function () {
        if (xhrReq.readyState == XMLHttpRequest.DONE) {
          // resolve our promise
          resolve(xhrReq.responseText);
        }
      };

      xhrReq.open("GET", "settings.json");
      xhrReq.send();
    }.bind(this));

    return promise;
  }

  /**
   * Load neural network
   */
  loadNeuralNetwork() {
    // create promise object
    let promise = new Promise(function (resolve, reject) {
      var xhrReq = new XMLHttpRequest();

      xhrReq.onreadystatechange = function () {
        if (xhrReq.readyState == XMLHttpRequest.DONE) {
          // resolve our promise
          resolve(xhrReq.responseText);
        }
      };

      xhrReq.open("GET", "network.json");
      xhrReq.send();
    }.bind(this));

    return promise;
  }

  /**
   * Create scene
   */
  createScene() {
    // create promise object
    let promise = new Promise(function (resolve, reject) {

      // build engine
      this.scene = new BABYLON.Scene(this.engine);

      // Create our main camera
      this.mainCamera = new BABYLON.FollowCamera("mainCamera", new BABYLON.Vector3(0, 5, -6), this.scene);

      // This attaches the camera to the canvas
      this.mainCamera.attachControl(this.renderCanvas, false);

      // This targets the camera to scene origin
      this.mainCamera.setTarget(BABYLON.Vector3.Zero());

      // create light
      this.mainLight = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), this.scene);
      this.mainLight.intensity = .7;

      // create our tile colors
      this.tileMaterial = new BABYLON.StandardMaterial("tileMaterial", this.scene);
      this.tileMaterial.diffuseColor = new BABYLON.Color4(1, 1, 1, 1);

      this.tileHighlightMaterial = new BABYLON.StandardMaterial("tileHighlightMaterial", this.scene);
      this.tileHighlightMaterial.diffuseColor = new BABYLON.Color4(0, 1, 0, 1.0);

      // hold our tiles
      this.tiles = [];

      // define tile properties
      this.tileHeight = .01;

      // create tiles
      this.createGridTile('tile_1', -1.5, 0, 1.5);
      this.createGridTile('tile_2', 0, 0, 1.5);
      this.createGridTile('tile_3', 1.5, 0, 1.5);
      this.createGridTile('tile_4', -1.5, 0, 0);
      this.createGridTile('tile_5', 0, 0, 0);
      this.createGridTile('tile_6', 1.5, 0, 0);
      this.createGridTile('tile_7', -1.5, 0, -1.5);
      this.createGridTile('tile_8', 0, 0, -1.5);
      this.createGridTile('tile_9', 1.5, 0, -1.5);

      // load o model and store our o model for later reuse
      BABYLON.SceneLoader.ImportMesh("O", "assets/3d/", "o.babylon", this.scene, function (newMeshes, particleSystems) {
        this.oModel = newMeshes[0];
        this.oModel.isVisible = false;
      }.bind(this));

      // load x model and store our x model for later reuse
      BABYLON.SceneLoader.ImportMesh("x", "assets/3d/", "x.babylon", this.scene, function (newMeshes, particleSystems) {
        this.xModel = newMeshes[0];
        this.xModel.isVisible = false;
      }.bind(this));

      // load x model and store our x model for later reuse
      BABYLON.SceneLoader.ImportMesh("table", "assets/3d/", "table.babylon", this.scene, function (newMeshes, particleSystems) {
        this.tableModel = newMeshes[0];
      }.bind(this));

      // resolve our promise
      resolve();
    }.bind(this));

    return promise;
  }

  /**
   * Check board
   */
  checkBoard() {

    let winner = null;
    let winnerTiles = [];

    // check horizontal

    for (var x = 1, xMax = 9; x <= xMax; x += 3) {
      if (this.tiles[`tile_${ x }`].classification == null) {
        continue;
      } else if (this.tiles[`tile_${ x }`].classification !== this.tiles[`tile_${ x + 1 }`].classification) {
        continue;
      } else if (this.tiles[`tile_${ x + 1 }`].classification !== this.tiles[`tile_${ x + 2 }`].classification) {
        continue;
      }

      // store winner and winning tiles
      winner = this.tiles[`tile_${ x }`].classification;
      winnerTiles.push(`tile_${ x }`);
      winnerTiles.push(`tile_${ x + 1 }`);
      winnerTiles.push(`tile_${ x + 2 }`);
    }

    // check vertical
    if (winner === null) {
      winnerTiles = [];

      for (var y = 1, yMax = 3; y <= yMax; y++) {
        // if first item is null we can skip the rest
        if (this.tiles[`tile_${ y }`].classification == null) {
          continue;
        } else if (this.tiles[`tile_${ y }`].classification !== this.tiles[`tile_${ y + 3 }`].classification) {
          continue;
        } else if (this.tiles[`tile_${ y + 3 }`].classification !== this.tiles[`tile_${ y + 6 }`].classification) {
          continue;
        }

        // store winner and winning tiles
        winner = this.tiles[`tile_${ y }`].classification;
        winnerTiles.push(`tile_${ y }`);
        winnerTiles.push(`tile_${ y + 3 }`);
        winnerTiles.push(`tile_${ y + 6 }`);
      }
    }

    // diagonal left -> right
    if (winner === null) {
      winnerTiles = [];

      if (this.tiles['tile_1'].classification !== null) {
        if (this.tiles['tile_1'].classification === this.tiles['tile_5'].classification) {
          if (this.tiles['tile_5'].classification === this.tiles['tile_9'].classification) {

            // store winner and winning tiles
            winner = this.tiles['tile_1'].classification;
            winnerTiles.push(`tile_1`);
            winnerTiles.push(`tile_5`);
            winnerTiles.push(`tile_9`);
          }
        }
      }
    }

    // diagonal right -> left
    if (winner === null) {
      winnerTiles = [];

      if (this.tiles['tile_3'].classification !== null) {
        if (this.tiles['tile_3'].classification === this.tiles['tile_5'].classification) {
          if (this.tiles['tile_5'].classification === this.tiles['tile_7'].classification) {

            // store winner and winning tiles
            winner = this.tiles['tile_3'].classification;
            winnerTiles.push(`tile_3`);
            winnerTiles.push(`tile_5`);
            winnerTiles.push(`tile_7`);
          }
        }
      }
    }

    return { winner: winner, winnerTiles: winnerTiles };
  }

  /**
   * Create grid tile
   * @return {[type]} [description]
   */
  createGridTile(name, x, y, z) {
    this.tiles[name] = BABYLON.MeshBuilder.CreateBox(name, { height: this.tileHeight }, this.scene);
    this.tiles[name].material = this.tileMaterial;
    this.tiles[name].position = new BABYLON.Vector3(x, y, z);
    this.tiles[name].classification = null;
  }

  /**
   * Setup events
   */
  setupEvents() {
    // uses JS native addEventListener
    this.renderCanvas.addEventListener('mousedown', function () {
      this.mouseDown();
    }.bind(this), false);

    // add custom event listener
    this.paintControl.addListener('ON_MOUSE_OUT', function () {
      this.recognizeDrawing();
    }.bind(this), false);
  }

  /**
   * Recognize drawings
   */
  recognizeDrawing() {
    if (!this.paintControl.isLocked) {
      // get downsampled result
      this.paintControl.getDownSampledAndNormalizedPixels().then(function (pixels) {

        // classify drawing and store our result
        let result = this.neuralnetwork.classify(pixels);
        let classification = result[0] > result[1] ? "o" : "x";
        this.tiles[this.activeTileName].classification = classification;

        // clone model of model that has been classified
        this.models[this.activeTileName] = this[`${ classification }Model`].clone();
        this.models[this.activeTileName].isVisible = true;
        this.models[this.activeTileName].position.x = this.tiles[this.activeTileName].position.x;
        this.models[this.activeTileName].position.z = this.tiles[this.activeTileName].position.z;

        // add animation to our model
        let anim = new BABYLON.Animation("winnerAnimation", "rotation.y", 30, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
        var keys = [];
        keys.push({ frame: 0, value: 0 });
        keys.push({ frame: 30, value: -1 });
        keys.push({ frame: 60, value: 0 });
        keys.push({ frame: 90, value: 1 });
        keys.push({ frame: 120, value: 0 });
        anim.setKeys(keys);
        this.models[this.activeTileName].animations.push(anim);

        // clear drawing
        this.paintControl.clear();

        // lock painter control
        this.paintControl.lock();

        // handle and check if winner is available
        let winnerInfo = this.checkBoard();

        if (winnerInfo.winner !== null) {
          for (let tileName of winnerInfo.winnerTiles) {
            // animate tile
            this.scene.beginAnimation(this.models[tileName], 0, 240, true);
          }
        }
      }.bind(this));
    }
  }

  /**
   * Mouse down event handler
   */
  mouseDown() {
    // get picked result
    let pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);

    // if a mesh was hit
    if (pickResult.hit) {
      // be sure that a tile was picked
      if (pickResult.pickedMesh.name.startsWith('tile')) {
        // be sure that tile wasn't already classified
        if (this.tiles[pickResult.pickedMesh.name].classification === null) {
          // lock painter control
          this.paintControl.unlock();

          // higlight tile
          this.highlightTile(pickResult.pickedMesh.name);
        }
      }
    }
  }

  /**
   * Highlight tile
   * @param  {string} tileName name of tile to highlight
   */
  highlightTile(tileName) {

    // reset tiles colours
    for (let key in this.tiles) {
      this.tiles[key].material = this.tileMaterial;
    }

    // store active tile
    this.activeTileName = tileName;

    // highlight tile
    this.tiles[tileName].material = this.tileHighlightMaterial;

    console.log(this.activeTileName);
  }

  /**
   * Register render loop
   */
  registerRenderLoop() {
    this.engine.runRenderLoop(function () {
      this.scene.render();
    }.bind(this));
  }

}