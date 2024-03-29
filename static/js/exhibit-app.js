
//var isMobile  = (window.screen.height < 1024 || window.screen.width < 1024) ? true : false;
var isMobile  = (screen.height < 719 || screen.width < 1023) ? true : false;

if (isMobile) {
  document.documentElement.setAttribute('data-mobile', 'true');
}


require([
  'esri/Map',
  'esri/views/MapView',
  'esri/layers/FeatureLayer',
  "esri/layers/GeoJSONLayer",
  'esri/layers/GraphicsLayer',
  'esri/Graphic',
  'esri/Basemap',
  'esri/layers/VectorTileLayer',
  'esri/widgets/Zoom/ZoomViewModel',
  'esri/layers/support/LabelClass',
  "esri/views/2d/layers/BaseLayerViewGL2D",
  "esri/core/promiseUtils",
  "esri/core/watchUtils",
  "esri/geometry/support/webMercatorUtils",
], function (
  Map,
  MapView,
  FeatureLayer,
  GeoJSONLayer,
  GraphicsLayer,
  Graphic,
  Basemap,
  VectorTileLayer,
  ZoomViewModel,
  LabelClass,
  BaseLayerViewGL2D,
  promiseUtils,
  watchUtils,
  webMercatorUtils,
) {

  var splide = newSplide();


  
  const CustomLayerView2D = BaseLayerViewGL2D.createSubclass({
    // Locations of the two vertex attributes that we use. They
    // will be bound to the shader program before linking.
    aPosition: 0,
    aOffset: 1,

    constructor: function() {
      // Geometrical transformations that must be recomputed
      // from scratch at every frame.
      this.transform = mat3.create();
      this.translationToCenter = vec2.create();
      this.screenTranslation = vec2.create();

      // Geometrical transformations whose only a few elements
      // must be updated per frame. Those elements are marked
      // with NaN.
      this.display = mat3.fromValues(NaN, 0, 0, 0, NaN, 0, -1, 1, 1);
      this.screenScaling = vec3.fromValues(NaN, NaN, 1);

      // Whether the vertex and index buffers need to be updated
      // due to a change in the layer data.
      this.needsUpdate = false;

      // We listen for changes to the graphics collection of the layer
      // and trigger the generation of new frames. A frame rendered while
      // `needsUpdate` is true may cause an update of the vertex and
      // index buffers.
      const requestUpdate = () => {
        this.needsUpdate = true;
        this.requestRender();
      };

      this.watcher = watchUtils.on(this, "layer.graphics", "change", requestUpdate, requestUpdate, requestUpdate);
    },

    // Called once a custom layer is added to the map.layers collection and this layer view is instantiated.
    attach: function() {
      const gl = this.context;

      // Define and compile shaders.
      const vertexSource = `
        precision highp float;
        uniform mat3 u_transform;
        uniform mat3 u_display;
        attribute vec2 a_position;
        attribute vec2 a_offset;
        varying vec2 v_offset;
        const float SIZE = 55.0;
        void main(void) {
            gl_Position.xy = (u_display * (u_transform * vec3(a_position, 1.0) + vec3(a_offset * SIZE, 0.0))).xy;
            gl_Position.zw = vec2(0.0, 1.0);
            v_offset = a_offset;
        }`;

      const fragmentSource = `
        precision highp float;
        uniform float u_current_time;
        varying vec2 v_offset;
        const float PI = 3.14159;
        const float N_RINGS = 2.0;
        const vec3 COLOR = vec3(0.95, 0.92, 0.33);
        const float FREQ = 0.35;
        void main(void) {
            float l = length(v_offset);
            float intensity = clamp(cos(l * PI), 0.0, 1.0) * clamp(cos(2.0 * PI * (l * 2.0 * N_RINGS - FREQ * u_current_time)), 0.0, 1.0);
            gl_FragColor = vec4(COLOR * intensity, intensity);
        }`;

      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, vertexSource);
      gl.compileShader(vertexShader);
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, fragmentSource);
      gl.compileShader(fragmentShader);

      // Create the shader program.
      this.program = gl.createProgram();
      gl.attachShader(this.program, vertexShader);
      gl.attachShader(this.program, fragmentShader);

      // Bind attributes.
      gl.bindAttribLocation(this.program, this.aPosition, "a_position");
      gl.bindAttribLocation(this.program, this.aOffset, "a_offset");

      // Link.
      gl.linkProgram(this.program);

      // Shader objects are not needed anymore.
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      // Retrieve uniform locations once and for all.
      this.uTransform = gl.getUniformLocation(this.program, "u_transform");
      this.uDisplay = gl.getUniformLocation(this.program, "u_display");
      this.uCurrentTime = gl.getUniformLocation(
        this.program,
        "u_current_time"
      );

      // Create the vertex and index buffer. They are initially empty. We need to track the
      // size of the index buffer because we use indexed drawing.
      this.vertexBuffer = gl.createBuffer();
      this.indexBuffer = gl.createBuffer();

      // Number of indices in the index buffer.
      this.indexBufferSize = 0;

      // When certain conditions occur, we update the buffers and re-compute and re-encode
      // all the attributes. When buffer update occurs, we also take note of the current center
      // of the view state, and we reset a vector called `translationToCenter` to [0, 0], meaning that the
      // current center is the same as it was when the attributes were recomputed.
      this.centerAtLastUpdate = vec2.fromValues(
        this.view.state.center[0],
        this.view.state.center[1]
      );
    },

    // Called once a custom layer is removed from the map.layers collection and this layer view is destroyed.
    detach: function() {
      // Stop watching the `layer.graphics` collection.
      this.watcher.remove();

      const gl = this.context;

      // Delete buffers and programs.
      gl.deleteBuffer(this.vertexBuffer);
      gl.deleteBuffer(this.indexBuffer);
      gl.deleteProgram(this.program);
    },

    // Called every time a frame is rendered.
    render: function(renderParameters) {
      const gl = renderParameters.context;
      const state = renderParameters.state;

      // Update vertex positions. This may trigger an update of
      // the vertex coordinates contained in the vertex buffer.
      // There are three kinds of updates:
      //  - Modification of the layer.graphics collection ==> Buffer update
      //  - The view state becomes non-stationary ==> Only view update, no buffer update
      //  - The view state becomes stationary ==> Buffer update
      this.updatePositions(renderParameters);

      // If there is nothing to render we return.
      if (this.indexBufferSize === 0) {
        return;
      }

      // Update view `transform` matrix; it converts from map units to pixels.
      mat3.identity(this.transform);
      this.screenTranslation[0] = (state.pixelRatio * state.size[0]) / 2;
      this.screenTranslation[1] = (state.pixelRatio * state.size[1]) / 2;
      mat3.translate(this.transform, this.transform, this.screenTranslation);
      mat3.rotate(this.transform, this.transform, (Math.PI * state.rotation) / 180);
      this.screenScaling[0] = state.pixelRatio / state.resolution;
      this.screenScaling[1] = -state.pixelRatio / state.resolution;
      mat3.scale(this.transform, this.transform, this.screenScaling);
      mat3.translate(
        this.transform,
        this.transform,
        this.translationToCenter
      );

      // Update view `display` matrix; it converts from pixels to normalized device coordinates.
      this.display[0] = 2 / (state.pixelRatio * state.size[0]);
      this.display[4] = -2 / (state.pixelRatio * state.size[1]);

      // Draw.
      gl.useProgram(this.program);
      gl.uniformMatrix3fv(this.uTransform, false, this.transform);
      gl.uniformMatrix3fv(this.uDisplay, false, this.display);
      gl.uniform1f(this.uCurrentTime, performance.now() / 1000.0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
      gl.enableVertexAttribArray(this.aPosition);
      gl.enableVertexAttribArray(this.aOffset);
      gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(this.aOffset, 2, gl.FLOAT, false, 16, 8);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawElements(gl.TRIANGLES, this.indexBufferSize, gl.UNSIGNED_SHORT, 0);

      // Request new render because markers are animated.
      this.requestRender();
    },

    // Called by the map view or the popup view when hit testing is required.
    hitTest: function(x, y) {
      // The map view.
      const view = this.view;

      if (this.layer.graphics.length === 0) {
        // Nothing to do.
        return promiseUtils.resolve(null);
      }

      // Compute screen distance between each graphic and the test point.
      const distances = this.layer.graphics.map((graphic) => {
        const graphicPoint = view.toScreen(graphic.geometry);
        return Math.sqrt((graphicPoint.x - x) * (graphicPoint.x - x) + (graphicPoint.y - y) * (graphicPoint.y - y));
      });

      // Find the minimum distance.
      let minIndex = 0;

      distances.forEach((distance, i) => {
        if (distance < distances.getItemAt(minIndex)) {
          minIndex = i;
        }
      });

      const minDistance = distances.getItemAt(minIndex);

      // If the minimum distance is more than 35 pixel then nothing was hit.
      if (minDistance > 35) {
        return promiseUtils.resolve(null);
      }

      // Otherwise it is a hit; We set the layer as the source layer for the graphic
      // (required for the popup view to work) and we return a resolving promise to
      // the graphic.
      const graphic = this.layer.graphics.getItemAt(minIndex);
      graphic.sourceLayer = this.layer;
      return promiseUtils.resolve(graphic);
    },

    // Called internally from render().
    updatePositions: function(renderParameters) {
      const gl = renderParameters.context;
      const stationary = renderParameters.stationary;
      const state = renderParameters.state;

      // If we are not stationary we simply update the `translationToCenter` vector.
      if (!stationary) {
        vec2.sub(
          this.translationToCenter,
          this.centerAtLastUpdate,
          state.center
        );
        this.requestRender();
        return;
      }

      // If we are stationary, the `layer.graphics` collection has not changed, and
      // we are centered on the `centerAtLastUpdate`, we do nothing.
      if (
        !this.needsUpdate &&
        this.translationToCenter[0] === 0 &&
        this.translationToCenter[1] === 0
      ) {
        return;
      }

      // Otherwise, we record the new encoded center, which imply a reset of the `translationToCenter` vector,
      // we record the update time, and we proceed to update the buffers.
      this.centerAtLastUpdate.set(state.center);
      this.translationToCenter[0] = 0;
      this.translationToCenter[1] = 0;
      this.needsUpdate = false;

      const graphics = this.layer.graphics;

      // Generate vertex data.
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      const vertexData = new Float32Array(16 * graphics.length);

      let i = 0;
      graphics.forEach(
        (graphic) => {
          const point = graphic.geometry;

          // The (x, y) position is relative to the encoded center.
          const x = point.x - this.centerAtLastUpdate[0];
          const y = point.y - this.centerAtLastUpdate[1];

          vertexData[i * 16 + 0] = x;
          vertexData[i * 16 + 1] = y;
          vertexData[i * 16 + 2] = -0.5;
          vertexData[i * 16 + 3] = -0.5;
          vertexData[i * 16 + 4] = x;
          vertexData[i * 16 + 5] = y;
          vertexData[i * 16 + 6] = 0.5;
          vertexData[i * 16 + 7] = -0.5;
          vertexData[i * 16 + 8] = x;
          vertexData[i * 16 + 9] = y;
          vertexData[i * 16 + 10] = -0.5;
          vertexData[i * 16 + 11] = 0.5;
          vertexData[i * 16 + 12] = x;
          vertexData[i * 16 + 13] = y;
          vertexData[i * 16 + 14] = 0.5;
          vertexData[i * 16 + 15] = 0.5;

          ++i;
        }
      );

      gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

      // Generates index data.
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

      let indexData = new Uint16Array(6 * graphics.length);
      for (let i = 0; i < graphics.length; ++i) {
        indexData[i * 6 + 0] = i * 4 + 0;
        indexData[i * 6 + 1] = i * 4 + 1;
        indexData[i * 6 + 2] = i * 4 + 2;
        indexData[i * 6 + 3] = i * 4 + 1;
        indexData[i * 6 + 4] = i * 4 + 3;
        indexData[i * 6 + 5] = i * 4 + 2;
      }

      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);

      // Record number of indices.
      this.indexBufferSize = indexData.length;
    }
  });

  
  // Subclass the custom layer view from GraphicsLayer.
  const AnimatedPointLayer = GraphicsLayer.createSubclass({
    createLayerView: function(view) {
      // We only support MapView, so we only need to return a
      // custom layer view for the `2d` case.
      if (view.type === "2d") {
        return new CustomLayerView2D({
          view: view,
          layer: this
        });
      }
    }
  });


  /* ==========================================================
    Initialize map
  ========================================================== */


  var map = setUpMap();


  /*
  window.addEventListener('orientationchange', ()=> {
    const isMobileCheck  = (screen.height < 719 || screen.width < 1023) ? true : false;
    if (isMobileCheck !== isMobile) {
      isMobile = isMobileCheck
      resetMap();
      if (isMobile) {
        document.documentElement.setAttribute('data-mobile', 'true');
      } else {
        document.documentElement.setAttribute('data-mobile', 'false');
      }
    }
  });
  */



   //document.onclick = clearInterval(resetMapSetInterval);
   function resetMap() {
     resetButtonClickHandler();
     goHome();
     if (isMobile){
      map.infoPane.destroy();
     }
     const instructionsDiv = document.getElementsByClassName('instructions')[0];
     const instructionsContainer = document.getElementsByClassName('instructions__container')[0];
     setFlex(instructionsContainer, true);
     setFlex(instructionsDiv, true);
     instructionsDiv.classList.remove('instructions--inactive');
     instructionsContainer.classList.remove('instructions--inactive');
     document.addEventListener('click', hideInstructionsDiv, {once:true})
   }

  /* ==========================================================
     Functions to query & select localities layer
    ========================================================== */


    async function getQuery(feature) {
      const queryObject = {
        'region': feature.attributes.region_type,
        'name': feature.attributes.name,
      }
      let response = await fetch('/query', {
        method: 'POST',
        headers: {'Content-Type': 'application/json;charset=utf-8'},
        body: JSON.stringify(queryObject)
      });
      let data = await response.text()
      if (data) {
        return JSON.parse(data);
      } else {
        return data;
      }
    }

    // Starting point to display the geometry of a feature, query the database
    // and display all returned info onto the map/info panels
    function main(feature) {
      zoomToFeature(feature);
      addAreaHighlight(feature.geometry);
      // Get query object from database
      getQuery(feature).then(data => {
        // If response has data, use it to populate info cards
        if (data) {
          populateInfoCards(data);
        } else {
          populateNullCards(feature.attributes.name)
        }
      });
      displayIntersectingAreas(feature.attributes);
    }


    function returnZoomScale(feature) {
      const geometry = feature.geometry;
      let screenArea = window.innerHeight * window.innerWidth;
      var featureArea;
      if (feature.attributes.name === 'Los Angeles' || feature.attributes.name === 'Ventura') {
        featureArea = (geometry.extent.height/4.15) * geometry.extent.width;
      } else {
        featureArea = geometry.extent.height * geometry.extent.width;
      }

      if (featureArea > 90000000){
        const scale = (featureArea/screenArea) * 150;
        return scale;
      } else {
        const scale = (featureArea/screenArea) * 1000
        return scale;
      }
      
    }

    function zoomToFeature(feature) {
      const geometry = feature.geometry;
      const featureName = feature.attributes.name;
      const geometryOffset = -(geometry.extent.width / 2);
      const goToOptions = {
        animate: true,
        duration: 800,
        ease: 'ease-in'
      }

      const zoomOptions = {
        true: {
          'Los Angeles': {
            center: [-118.3, 34.25],
            scale: returnZoomScale(feature),
          },
          'Santa Barbara': {
            center: [-120.1, 34.8],
          },
          default: {
            center: geometry,
          }
        },
        false: {
          'Los Angeles': {
            center: [-118.735491, 34.222515],
            scale: returnZoomScale(feature),
          },
          'Ventura': {
            center: [-119.254898, 34.515522],
            scale: returnZoomScale(feature),
          },
          default: {
            center: geometry.extent.expand(2).offset(geometryOffset, 0),
          }

        }
      }
      if (featureName in zoomOptions[isMobile]) {
        map.view
        .goTo(zoomOptions[isMobile][featureName], goToOptions)
        .catch(function (error) {
          if (error.name != 'AbortError') {
            console.error(error);
          }
        }, goToOptions);
      } else {
        map.view
          .goTo(zoomOptions[isMobile].default, goToOptions)
          .catch(function (error) {
            if (error.name != 'AbortError') {
              console.error(error);
            }
          }, goToOptions);
      }
    }


    function toggleButton(buttons, bool) {
      if (bool) {
        for (let button of buttons) {
          button.classList.remove('button--removed');
        }
      } else {
        for (let button of buttons) {
          button.classList.add('button--removed');
        }
      }
    }
    


    function selectFeaturesFromClick(screenPoint) {
      clearGraphics();
      const includeLayers = [
        map.countiesLayer,
        map.regionsLayer,
        map.neighborhoodsLayer,
        map.areasLayer
      ]
  
      // hitTest returns feature that intersects with tap/click
      // i.e. screenPoint
      map.view.hitTest( screenPoint, {include: includeLayers})
      .then(feature => {
        // Test if any map features were clicked/returned
        if (feature.results[0]) {
          main(feature.results[0].graphic);
        // If nothing returned, reset map
        } else {
          resetButtonClickHandler();
        }
      })
    }

    function populateNullCards(featureName) {
      if (isMobile) {
        hideDiv(document.getElementsByClassName('info-card__content')[0]);
        displayDiv(document.getElementsByClassName('null-card__content')[0]);
      } else {
        const infoCard = document.getElementById('infoCard');
        if (infoCard.style.display != 'none') {
          hideDiv(infoCard);
          setTimeout(()=> {
            displayDiv('#noInfoCard');
          }, 550);
        } else {
          displayDiv('#noInfoCard');
        }
      }

      for (let div of document.getElementsByClassName('featureName')) {
        div.innerText = featureName;
      }

    }
    function populateInfoCards(stats) {
      const taxaInfoDiv = document.getElementsByClassName('taxa--info')[0];
      const taxaNullDiv = document.getElementsByClassName('taxa--null')[0];
      const photosDiv = document.getElementById('photos');
      const photosNullDiv = document.getElementsByClassName('photos--null')[0];
      const photoLegend = document.getElementsByClassName('photo-indicator')[0];
      let photosButton = document.getElementsByClassName('photos__button');
      let timeButton = document.getElementsByClassName('time__button');

      // Hide appropriate divs
      if (isMobile) {
        hideDiv(document.getElementsByClassName('null-card__content')[0]);
        document.getElementsByClassName('info-card__content')[0].style.display='block';
      } else {
        hideDiv('#noInfoCard');
      }

      // Highlight locality selected in query
      (map.highlight) ? map.highlight.remove() : map.highlight;
      map.highlight = map.localitiesView.highlight(stats.oids);

      // Set feature name to all title divs
      for (let div of document.getElementsByClassName('featureName')) {
        div.innerText = stats.name;
      }

      // Set excavation site number 
      document.querySelector('.excavation-number[lang=en]')
      .innerHTML = `${(stats.number_of_sites).toLocaleString()}`;

      document.querySelector('.excavation-number[lang=es]')
      .innerHTML = `${(stats.number_of_sites).toLocaleString('es')}`;

      // Reset taxa lists
      const taxaLists = document.getElementsByClassName('taxa__list');
      for (let list of taxaLists) {
        list.innerHTML = '';
      }

      // Handle taxa object
      if (stats.number_of_specimens > 0) {
        setFlex(taxaNullDiv, false);
        setFlex(taxaInfoDiv, true);
        const taxa = stats.taxa;
        const fossilsFound = Object.values(taxa).reduce((a, b) => a + b);
        document.querySelector('.fossils-found[lang=en]')
        .innerHTML = fossilsFound.toLocaleString();
        document.querySelector('.fossils-found[lang=es]')
        .innerHTML = fossilsFound.toLocaleString('es');
        populateTaxa(taxa);
      } else {
        // Hide taxa divs
        setFlex(taxaInfoDiv, false);
        setFlex(taxaNullDiv, true);
      }
    
      // Handle photos
      if (stats.photos.length > 0) {
        for (let button of photosButton) {
          button.classList.remove('button--removed');
        }
        populateSplide(stats.photos);
        setFlex(photosDiv, true);
        setFlex(photosNullDiv, false);
        setFlex(photoLegend, true);
      } else {
        for (let button of photosButton) {
          button.classList.add('button--removed');
        }
        //setFlex(photosNullDiv, true);
        setFlex(photosDiv, false);
        setFlex(photoLegend, false);
      }

      // Display div
      displayDiv('#infoCard');
      if(isMobile){
        map.infoPane.present({animate:true})
      }

      // Handle timescale
      if (stats.endDate !== null && stats.startDate != null) {
        setFlex(document.getElementById('time'), true);
        toggleButton(timeButton, true);
        if (stats.endDate === 0) {
          stats.endDate = 0.0117;
        }
        moveTimescale(stats.startDate, stats.endDate);
        addTimescaleText(stats.startDate, stats.endDate);
      } else {
        setFlex(document.getElementById('time'), false);
        toggleButton(timeButton, false);
        //setDisplay(document.getElementsByClassName('time__button')[0], false);
      }

      displayUnderwaterText(stats.immersion);

      // Scroll to top of card container div
      ($('.card__content')).animate({scrollTop:10}, 50);
    }

    
    function addAreaHighlight(geometry) {
      const selectedAreaGraphic = new Graphic({
        geometry: geometry,
        symbol: {
          type: "simple-fill",
          color: [73, 128, 123, 0.15],
          outline: {
            // autocasts as new SimpleLineSymbol()
            color: [73, 128, 123, 1],
            width: 4, // points
          },
        }
      });
      map.areaGraphics.graphics.removeAll();
      map.areaGraphics.graphics.add(selectedAreaGraphic);
      
     /*
     const selectedAreaGraphic = new Graphic({
       geometry: geometry
     });
     map.selectedAreaGraphics.graphics.removeAll();
     map.selectedAreaGraphics.graphics.add(selectedAreaGraphic);
    */
    }


    /* ==========================================================
     Taxa list functions
    ========================================================== */

    function populateTaxa(taxa) {
      // Categories of taxonomic groups
      let taxaObj = {
        'Clams, oysters': {
          'fileName': 'clam',
          'category': 'invertebrate',
          'es': 'Almejas, ostras, vieiras',
          'en': 'Clams, oysters, scallops',
        },
        'Snails': {
          'fileName': 'snail',
          'category': 'invertebrate',
          'es': 'Caracoles',
          'en': 'Snails'
        },
        'Sea urchins': {
          'fileName':'urchin',
          'category': 'invertebrate',
          'es': 'Erizos de mar',
          'en': 'Sea urchins',
        },
        'Worms': {
          'fileName': 'worm',
          'category': 'invertebrate',
          'es': 'Gusanos',
          'en': 'Worms',
        },
        'Crabs, shrimps': {
          'fileName': 'crab',
          'category': 'invertebrate',
          'es': 'Cangrejos, camarones',
          'en': 'Crabs, shrimp',
        },
        'Nautiloids': {
          'fileName': 'ammonoid',
          'category': 'invertebrate',
          'es': 'Ammonoideos, nautiloideos, pulpos',
          'en': 'Ammonoids, nautiloids, octopuses'
        },
        'Corals': {
          'fileName': 'coral',
          'category': 'invertebrate',
          'es': 'Corales',
          'en': 'Corals'
        },
        'Barnacles': {
          'fileName': 'barnacle',
          'category': 'invertebrate',
          'es': 'Percebes',
          'en': 'Barnacles',
        },
        'Scaphopods': {
          'fileName': 'scaphopod',
          'category': 'invertebrate',
          'es': 'Conchas colmillo',
          'en': 'Tusk shells'
        },
        'Sharks, rays': {
          'fileName': 'shark',
          'category': 'vertebrate',
          'es': 'Tiburones, rayas',
          'en': 'Sharks, rays',
        },
        'Fish': {
          'fileName': 'fish',
          'category': 'vertebrate',
          'es': 'Peces',
          'en': 'Fish',
        },
        'Birds': {
          'fileName': 'bird',
          'category': 'vertebrate',
          'es': 'Aves',
          'en': 'Birds',
        },
        'Whales, dolphins': {
          'fileName': 'whale',
          'category': 'vertebrate',
          'es': 'Ballenas, delfines',
          'en': 'Whales, dolphins',
        },
        'Microfossils': {
          'fileName': 'magnifying-glass',
          'category': 'invertebrate',
          'es': 'Microfósiles',
          'en': 'Microfossils'
        },
        'Walruses, seals': {
          'fileName': 'walrus',
          'category': 'vertebrate',
          'es': 'Focas, otarios, morsas',
          'en': 'Seals, sea lions, walruses'
        },
      }
      // Create document fragments to insert taxa items
      let invertFrag = document.createDocumentFragment();
      let vertFrag = document.createDocumentFragment();
      // Get reference to the top and bottom lists for the invert/vert lists
      const vertList = document.getElementsByClassName('vert__list')[0];
      const invertList = document.getElementsByClassName('invert__list')[0];
      // Sort taxa object and by using Object.entries to create an array of arrays
      const sortedTaxaLists = Object.entries(taxa).sort((a,b) => b[1]-a[1])
      for (const taxonList of sortedTaxaLists) {
        let taxon, number;
        [taxon, number] = taxonList;
        let cell = document.createElement(`div`);
        let taxaIcon = document.createElement(`img`);
        if (taxaObj[taxon]) {
          const fileName = taxaObj[taxon]['fileName'];
          const category = taxaObj[taxon]['category'];
          const spanishName = taxaObj[taxon]['es'];
          const englishName = taxaObj[taxon]['en'];
          taxaIcon.src = `/static/images/${fileName}.svg`;
          // Create english and spanish text elements
          const englishTaxonText = document.createElement("p"); 
          const spanishTaxonText = document.createElement("p");
          // Add their language attributes
          englishTaxonText.lang = 'en';
          spanishTaxonText.lang = 'es';
          cell.classList.add('taxa__cell');
          taxaIcon.classList.add('taxa__icon');
          englishTaxonText.innerHTML = `${number.toLocaleString()}<br>${englishName}`;
          spanishTaxonText.innerHTML = `${number.toLocaleString('es')}<br>${spanishName}`;
          cell.append(taxaIcon, englishTaxonText, spanishTaxonText);
          // Append cell to appropriate fragment
          if (category === "invertebrate") {
            invertFrag.append(cell);
          } else if (category === "vertebrate") {
            vertFrag.append(cell);
          }
        }
      }
      // Append all lists to their fragments
      invertList.append(invertFrag);
      vertList.append(vertFrag);
    }

    /* ==========================================================
     Splide functions
    ========================================================== */

      // Adds photos and captions to splide carousel
    function populateSplide(photos) {
      // Display photo indicator to legend
      resetSplide();
      const splideListFrag = document.createDocumentFragment();
      const splideList = document.getElementsByClassName('splide__list')[0];
      const url = 'https://fossilmap.sfo3.cdn.digitaloceanspaces.com/images/'
      photos.forEach((photo) => {
        // Create divs for slide
        const img = document.createElement('img');
        const li = document.createElement('li');
        const captions = formatCaptions(photo);
        // Format HTML for Splide carousel
        //img.setAttribute('data-splide-lazy', photo.url);
        img.src = url + photo.key + "_500px.png"
        li.classList.add('splide__slide');
        const newSlide = splideListFrag.appendChild(li);
        const div = document.createElement('div');
        div.className = 'splide__slide--imageContainer';
        newSlide.appendChild(div).appendChild(img);
        newSlide.appendChild(captions);
      });
      splideList.append(splideListFrag);
      splide = newSplide();
      // Create point graphic for initial slide
      createPhotoPointGraphic(photos[0].point.coordinates);
      // Splide event listener for changes in active slide
      splide.on("visible", slide => {
        // Create point graphic when slide is advanced by getting index
        // of current slide and getting coordinates from photos array
        const slideArray = Array.from(slide.slide.parentElement.children);
        const slideIndex = slideArray.indexOf(slide.slide);
        createPhotoPointGraphic(photos[slideIndex].point.coordinates);
      })
      setFlex(sliderDiv, true);
    }


    // Foramts captions from photos array for splide carousel
    function formatCaptions(photo) {

      function returnDescription(photo) {
        const dictionary = {
          'Ammonoid': 'ammonoideo',
          'Barnacle': 'percebes',
          'Bird': 'ave',
          'Clam': 'almejas',
          'Coral': 'coral',
          'Crab': 'cangrejo',
          'Desmostylian': 'desmostylia',
          'Diatom': 'diatomea',
          'Dolphin': 'delfín',
          'Fish': 'pez',
          'Microfossil': 'microfósiles',
          'Nautiloid': 'nautiloideo',
          'Oyster': 'ostra',
          'Ray': 'raya',
          'Scallop': 'vieira',
          'Scaphopod': 'conchas colmillo',
          'Seal': 'foca',
          'Sea lion': 'otario',
          'Sea urchin': 'erizo de mar',
          'Shark': 'tiburones',
          'Shrimp': 'camarón',
          'Snail': 'caracol',
          'Turtle': 'tortuga',
          'Walrus': 'morsa',
          'Whale': 'ballena',
          'Worm': 'gusano',
        };
        const descriptionCaptionEnglish = document.createElement('p');
        const descriptionCaptionSpanish = document.createElement('p');
        descriptionCaptionEnglish.classList.add('caption__description');
        descriptionCaptionSpanish.classList.add('caption__description');
        descriptionCaptionEnglish.setAttribute('lang', 'en');
        descriptionCaptionSpanish.setAttribute('lang', 'es');
        descriptionCaptionEnglish.innerHTML = photo.description;
        descriptionCaptionSpanish.innerHTML = 'Fósil de ' + dictionary[photo.common_name];
        return [descriptionCaptionEnglish, descriptionCaptionSpanish]
      }

      // Returns properly formatted age captions for specimen photo captions
      function handleAges(photo) {
        const ageCaptionEnglish = document.createElement('p');
        const ageCaptionSpanish = document.createElement('p');
        ageCaptionEnglish.setAttribute('lang', 'en');
        ageCaptionSpanish.setAttribute('lang', 'es');
        const startAge = photo.start_age;
        const endAge = photo.end_age;
        const endAgeEnglish = (endAge >= 1) ? endAge.toLocaleString(): (endAge * 1000000).toLocaleString();
        const endAgeSpanish = (endAge >= 1) ? endAge.toLocaleString('es'): (endAge * 1000000).toLocaleString('es');
        const startAgeEnglish = (startAge >= 1) ? startAge.toLocaleString(): (startAge * 1000000).toLocaleString();
        const startAgeSpanish = (startAge >= 1) ? startAge.toLocaleString('es'): (startAge * 1000000).toLocaleString('es');
        if (startAge >= 1 && endAge >= 1) {
          ageCaptionEnglish.innerHTML = `${endAgeEnglish}–${startAgeEnglish} million years old`;
          ageCaptionSpanish.innerHTML = `Entre ${endAgeEnglish} y ${startAgeEnglish} millones de años`;
        } else if (startAge < 1 && endAge < 1) {
          ageCaptionEnglish.innerHTML = `${endAgeEnglish}–${startAgeEnglish} thousand years old`;
          ageCaptionSpanish.innerHTML = `Entre ${endAgeSpanish} y ${startAgeSpanish} miles de años`;
        } else if (startAge >= 1 && endAge < 1) {
          ageCaptionEnglish.innerHTML = `${endAgeEnglish} thousand years – ${startAgeEnglish} million years old`;
          ageCaptionSpanish.innerHTML = `Entre ${endAgeSpanish} miles y ${startAgeSpanish} millones de años`;
        } else if (!endAge) {
          ageCaptionEnglish.innerHTML = (startAge > 1) ? `${startAgeEnglish} million years old`: `${startAgeEnglish} thousand years old`;
          ageCaptionSpanish.innerHTML = (startAge > 1) ? `${startAgeSpanish} millones de años`: `${startAgeEnglish} millones de años`;
        }
        return [ageCaptionEnglish, ageCaptionSpanish]
      }

      // Create captions divs 
      const taxonCaption = document.createElement('p');
      const descriptionCaption = document.createElement('p');
      const catNumberCaption = document.createElement('p')
      const captionsDiv = document.createElement('div');

      // Add classes to style captions
      taxonCaption.classList.add('caption__taxon');
      descriptionCaption.classList.add('caption__description');

      // Add photo info to divs
      taxonCaption.innerHTML = photo.taxon;
      const [ageCaptionEnglish, ageCaptionSpanish] = handleAges(photo);
      const [descriptionCaptionEnglish, descriptionCaptionSpanish] = returnDescription(photo);
      catNumberCaption.innerHTML = `${photo.display_id}`;
      captionsDiv.classList.add('splide__captions');

      // Append caption divs to parent divs
      captionsDiv.append(
        descriptionCaptionEnglish,
        descriptionCaptionSpanish,
        taxonCaption,
        ageCaptionEnglish,
        ageCaptionSpanish,
        catNumberCaption
      );

      return captionsDiv;
    }


    // Mounts splide 
    function newSplide() {
       const splide = new Splide('.splide', {
        //lazyLoad: 'sequential',
      }).mount();
      return splide;
    }

    // Reformats html to remove photos/captions from splide slider div
    function resetSplide() {
      const splideTrack = document.getElementsByClassName("splide__list")[0];
      const splidePagination = document.getElementsByClassName(
        "splide__pagination"
      )[0];
      splideTrack.innerHTML = "";
      if (splidePagination) {
        splidePagination.remove();
      }
    }

    // Creates a point graphic at active splide slide so that viewer
    // can see where the fossil in each photo was found
    function createPhotoPointGraphic(coordinates) {
      var visibleAttachmentGeometry = webMercatorUtils.geographicToWebMercator({
        type: "point", // autocasts as new Point()
        longitude: coordinates[0], // Coordinates from monogDB list long first
        latitude: coordinates[1]
      });
      
      // Create graphic around record currntly being displayed in Splide carousel
      const selectedPhotoGraphic = new Graphic({
        geometry: visibleAttachmentGeometry,
        symbol: {
          type: "simple-marker",
          style: "circle",
          color: "orange",
          size: "12px", // pixels
          outline: {
            // autocasts as new SimpleLineSymbol()
            color: [255, 255, 0],
            width: 2, // points
          },
        },
      });
      map.selectedPhotoGraphicsLayer.removeAll();
      map.selectedPhotoGraphicsLayer.add(selectedPhotoGraphic);
    }


    /* ==========================================================
     Timescale functions
    ========================================================== */

    // Moves timescale indicator div based on age range array
    function moveTimescale(startDate, endDate) {
      const timescaleBar = document.getElementById('indicator'); 
      const timescaleDiv = document.getElementsByClassName('timescale__container')[0]; 
      const totalAge = 100;
      startDate = (startDate) > 100 ? 100 : startDate
      const fossilAgeRange = startDate - endDate;
      timescaleBar.style.right = `${(endDate/totalAge)*100}%`;    
      const timescaleWidth = timescaleDiv.clientWidth;
      const timeRatio = timescaleWidth/totalAge;
      timescaleBar.style.width = `${timeRatio*fossilAgeRange}px`;
    }

    function addTimescaleText(startDate, endDate) {
      let englishText, spanishText;
      [englishText, spanishText] = document.getElementsByClassName('time__range');
      if (startDate > 1 && endDate > 1) {
        endDate = endDate.toFixed(0);
        startDate = startDate.toFixed(0);
        englishText.innerHTML = `${endDate}-${startDate} million years old`;
        spanishText.innerHTML = `${endDate} y ${startDate} millones de años de antigüedad.`;
      } else if (startDate > 1 && endDate < 1) {
        endDate = (endDate *1000).toFixed(0);
        startDate = startDate.toFixed(0);
        englishText.innerHTML = `${endDate} thousand-${startDate} million years old`;
        spanishText.innerHTML = `${endDate} miles y ${startDate} millones de años de antigüedad.`;
      } else if (startDate < 1 && endDate < 1) {
        endDate = (endDate *1000).toFixed(0);
        startDate = (startDate *1000).toFixed(0);
        englishText.innerHTML = `${endDate}-${startDate} thousands of years old`;
        spanishText.innerHTML = `${endDate} y ${startDate} miles de años de antigüedad.`;
      }
    }

    function displayUnderwaterText(immersion) {
      const underwaterContainer = document.getElementsByClassName('underwater__container')[0];
      const timeSeperator = document.getElementById('timeSeperator');
      const timeDiv = document.getElementById('time');
      const underwaterEnglish = document.querySelector('.underwater__age[lang=en]');
      const underwaterSpanish = document.querySelector('.underwater__age[lang=es]');
  
      setFlex(underwaterContainer, true);
      setFlex(timeSeperator, true);
      timeDiv.style.minHeight = '';
  
      if (immersion >= 1 ) {
        underwaterEnglish.innerHTML = `${immersion} million years ago`;
        underwaterSpanish.innerHTML = `${immersion} millones de años de antigüedad`;
      } else if (!immersion || immersion === 0) {
        setFlex(underwaterContainer, false);
        setFlex(timeSeperator, false)
        timeDiv.style.minHeight = 'auto';
      } else {
        underwaterEnglish.innerHTML = `${(immersion * 100000).toLocaleString()} thousand years ago`;
        underwaterSpanish.innerHTML = `${(immersion * 100000).toLocaleString('es')} miles de años de antigüedad`;
      }
    }

    /* ==========================================================
     Intersecting features functions
    ========================================================== */

    function displayIntersectingAreas(feature) {
      //const featureUID = `${feature.region_type}_${feature.OBJECTID}`
      const featureName = feature.name
      map.areasView.visible = true;
      map.areasView.filter = {
        where: "parent_region = '" + featureName + "'"
      }
    }



    /* ==========================================================
     Event handler functions
    ========================================================== */

   // Refresh map after period of inactivity
   var resetMapSetInterval = setInterval(resetMap, 60000);

   document.addEventListener('click', function(event) {
     // Idle timer event handling
     clearInterval(resetMapSetInterval);
     resetMapSetInterval = setInterval(resetMap, 60000);
     // Close button event handling
     if (event.target.classList.contains('close-button')) {
       resetButtonClickHandler();
     // Zoom buttons event handling
     } else if (event.target.id === "zoomIn"){
       map.zoomViewModel.zoomIn();
     } else if (event.target.id === "zoomOut"){
       map.zoomViewModel.zoomOut();
     }
   });

   document.addEventListener('touchstart', function(event) {
     // Idle timer event handling
     clearInterval(resetMapSetInterval);
     resetMapSetInterval = setInterval(resetMap, 60000);
     //Close button event handling
     if (event.target.classList.contains('close-button')) {
       resetButtonClickHandler();
     }
   }, {passive:true});
   
   document.addEventListener('mousewheel', function(){
     clearInterval(resetMapSetInterval);
     resetMapSetInterval = setInterval(resetMap, 60000);
   }), {passive:true};


    // Click event for select feature from feature layers
    map.view.on("click", function (event) {
      selectFeaturesFromClick(event);
    });

    // Event handler for reset widget
    function resetButtonClickHandler() {
      displayIntersectingAreas('')
      clearGraphics();
      clearWidgets();
      setFlex(document.getElementsByClassName('photo-indicator')[0], false);
      map.view.focus();
    }

    function goHome() {
      const goToOptions = {
        animate: true,
        duration: 400,
        ease: 'ease-in'
      }
      map.view.goTo({ center: [-118.215, 34.225], scale: map.scale }, goToOptions);
    }

    // Event handler for language switcher
    const switcher = document.getElementById('languageSwitch');
    switcher.addEventListener('change', ()=>{
      if (switcher.checked) {
        document.body.setAttribute('lang', 'es');
      } else {
        document.body.setAttribute('lang', 'en');
      }
    })



  /* ==========================================================
     Functions to reset/initialize app
    ========================================================== */


    function hideDiv(divName) {
      const div = (typeof divName == 'object') ? divName : document.querySelector(divName);
      div.classList.remove('card--active');
      setTimeout(() => {
        setDisplay(div, false);
      }, 550);
    }
   
  
    function displayDiv(divName) {
      const div = (typeof divName == 'object') ? divName : document.querySelector(divName);
      setDisplay(div, true);
      //div.classList.remove('card--active');
      setTimeout(()=>{div.classList.add('card--active')}, 5);



      /*
      const contentCard = document.getElementsByClassName(`${cardName} content-card`)[0];
      const animateCard = document.getElementsByClassName(`${cardName} animate-card`)[0];
      animateCard.style.opacity = 1;
      animateCard.style.left = "0%";
      setFlex(contentCard, true);
      animateCard.style.opacity = 0;
      */
    }
  
  
    // Clears all info card panels in ui-top-left containers
    function clearWidgets() {
      const cards = document.getElementsByClassName('content-card');
      for (let card of cards) {  
        hideDiv(card);
      }
      if (isMobile) {
        map.infoPane.hide({animate:true})
      }
    }
  
    // Clears all map graphics (outlines)
    function clearGraphics() {
      map.view.graphics.removeAll();
      map.areaGraphics.graphics.removeAll();
      map.selectedPhotoGraphicsLayer.removeAll();
      (map.highlight) ? map.highlight.remove() : map.highlight;
    }
    
    // Toggles hidden property
    function setFlex(element, boolean) {
      element.style.display = boolean ? 'flex' : 'none';
    }
  
  
    // Toggles hidden property
    function setDisplay(element, boolean) {
      element.style.display = boolean ? 'inline-block' : 'none';
    }
  
  


    /* ==========================================================
    Function to set up the view, map and add widgets & layers
    ========================================================== */


  function setUpMap() {
    
    
    // Create new Basemap
    var basemap = new Basemap({
      baseLayers: [
        /*
        new TileLayer({
          url: 'https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer',
          opacity:0.85,
        }),
        */
        new VectorTileLayer({
          portalItem: {
            id: '43ed5ecba7dd4a75b1395c2f3fa3951b' //lauDarkBasemaps
          },
          blendMode:'multiply'
        })
      ],
    });

    /*
    const waterColorOcean = new VectorTileLayer({
      portalItem: {
        id:'9fcb87276abf4113ae6e464d27199090'
      },
      visible: false,
    })

    var lauBaseMap = new VectorTileLayer({
      portalItem: {
        id: '0f3e9032ce854630bcd37d117ee2b6cb', // Custom LAU Basemap
      },
      blendMode: 'multiply',
      visible:false,
    });



    const boundariesRenderer = {
      type: 'simple',
      symbol: {
        type: 'simple-fill',
        color: [255,255,255],
        style: 'solid',
      }
    }

    const boundariesLayer = new FeatureLayer({
      portalItem: {
        id: '9fcb87276abf4113ae6e464d27199090'
      },
      outFields: ['OBJECTID_12'],
      blendMode: 'destination-in',
      renderer: boundariesRenderer,
      visible: false,
    });


    const baseGroupLayer = new GroupLayer({
      layers:  [hillshade,lauBaseMap, boundariesLayer],
      effect:'drop-shadow(2px, 2px, 5px, rgba(0,0,0,0.15))',
      visible: false,
    });

    const selectedAreaGraphicsLayer = new GraphicsLayer({
      blendMode:'destination-in'
    });

    var defaultVectorTileLayer = new VectorTileLayer({
      portalItem: {
        id: 'c65f3f7dc5754366b4e515e73e2f7d8b', // Custom LAU Basemap
      },
      blendMode: 'multiply',
      opacity:1
    });

    const defaultSelectedFeatureGroup = new GroupLayer({
      layers: [
        defaultVectorTileLayer,
        selectedAreaGraphicsLayer
      ],
      effect:'drop-shadow(2px, 2px, 5px, rgba(0,0,0,0.95))',
      visible: true,
    });

    var bathyVectorTileLayer = new VectorTileLayer({
      portalItem: {
        id: '90a4db2ddbab4d18bbdf8528720de7cb', // Custom LAU Basemap
      },
      blendMode: 'multiply',
      opacity:1
    });

    const bathySelectedFeatureGroup = new GroupLayer({
      layers: [
        bathyVectorTileLayer,
        selectedAreaGraphicsLayer
      ],
      effect:'drop-shadow(2px, 2px, 5px, rgba(0,0,0,0.95))',
      visible: false,
    });

    var waterColorVectorTileLayer = new VectorTileLayer({
      portalItem: {
        id: '0f3e9032ce854630bcd37d117ee2b6cb', // Custom LAU Basemap
      },
      blendMode: 'multiply',
      opacity:1
    });

    const waterColorSelectedFeatureGroup = new GroupLayer({
      layers: [
        waterColorVectorTileLayer,
        selectedAreaGraphicsLayer
      ],
      effect:'drop-shadow(2px, 2px, 5px, rgba(0,0,0,0.95))',
      visible: false,
    });


    
   /*
   var basemap = new VectorTileLayer({
    portalItem: {
      id: 'c65f3f7dc5754366b4e515e73e2f7d8b', // Custom LAU Basemap
    }
   })
   */

    var map = new Map({
      basemap: basemap,
    });

    // Returns zoom number based on width and height of client window screen
    function returnZoom() {
      const width = window.screen.width;
      const height = window.screen.height;
      const pixelRatio = window.devicePixelRatio;
      const resolution = height * width;
      const zoom = (resolution < 800000) ? 7 : 8;
      return zoom;
    }

    // Returns scale number based on width and height of client window screen
    function returnScale(){
      const width = window.screen.width;
      const height = window.screen.height;
      const resolution = height * width;
      if (resolution > 700000) {
        return 700000 + (1000000 - resolution/2) * 0.25;
      } else {
        return 700000 + (1000000 - resolution/2);
      }

    }

    const zoom = returnZoom();
    const scale = returnScale();

    var view = new MapView({
      container: 'viewDiv',
      map: map,
      center: [-118.215, 34.225], // longitude, latitude ,
      scale: scale,
      constraints: {
        snapToZoom: false,
        rotationEnabled: false,
        minZoom: zoom, // Maximum zoom "out"
        maxZoom: 14, // Maximum zoom "in"
        geometry: {
          type: "extent",
          xmin: -121.5,
          ymin:  32.7,
          xmax: -114.7,
          ymax:  36.0
        }
      },
      popup: {
        autoOpenEnabled: false,
      },
      highlightOptions: {
        color: [42, 208, 212, 0.75],
        fillOpacity: 0.4,
      },
      ui: {
        components: [],
      },
    });

    const zoomViewModel = new ZoomViewModel({
      view: view,
    });


    // Create renderers, LabelClasses and FeatureLayers
    const localitiesRenderer = {
      type: 'simple',
      symbol: {
        type: 'simple-marker',
        size: 6,
        color: [67, 120, 116, 0.5],
        outline: {
          width: 0,
          color: [67, 120, 116, 0.1],
        },
      },
    };

  
    const polygonFeatureRenderer = {
      type: 'simple',
      symbol: {
        type: 'simple-fill',
        style: 'none',
        outline: {
          color: [15, 15, 15, 0.75],
          width: '2px',
        },
      },
    };

    const countiesLabelClass = new LabelClass({
      labelExpressionInfo: { expression: '$feature.NAME' },
      symbol: {
        type: 'text', // autocasts as new TextSymbol()
        color: 'rgb(199, 199, 199))',
        haloSize: 0.5,
        haloColor: 'rgb(66,66,66)',
        font: {
          // autocast as new Font()
          family: 'Avenir Next LT Pro Regular',
          weight: 'bold',
          size: 13,
        },
      },
    });

    const regionsLabelClass = new LabelClass({
      labelExpressionInfo: { expression: '$feature.NAME' },
      symbol: {
        type: 'text', // autocasts as new TextSymbol()
        color: 'rgb(199, 199, 199)',
        haloSize: 0.5,
        haloColor: 'rgb(66,66,66)',
        deconflictionStrategy: 'static',
        font: {
          // autocast as new Font()
          family: 'Avenir Next LT Pro Regular',
          weight: 'normal',
          size: 9.5,
        },
      },
    });

    const areasLabelClass = new LabelClass({
      labelExpressionInfo: {
        expression: "Replace(Trim($feature.name), ' ', TextFormatting.NewLine)",
        //expression: '$feature.name'
      },
      symbol: {
        type: 'text', // autocasts as new TextSymbol()
        color: 'rgb(199, 199, 199)',
        haloSize: 0.5,
        haloColor: 'rgb(66,66,66)',
        deconflictionStrategy: 'static',
        font: {
          // autocast as new Font()
          family: 'Avenir Next LT Pro Regular',
          weight: 'bold',
          size: 9,
        },
      },
    });

    var countiesMaxScale = 600000;
    var regionsMaxScale = 188895;
    //var neighborhoodsMinScale = 144448;

    const clientFeatureLayer = new FeatureLayer({
      title: 'Areas',
      spatialReference: {
        wkid: 4326,
      },
      fields: [
        {
          name: 'region_type',
          alias: 'Region Type',
          type: 'string',
        },
        {
          name: 'objectId',
          alias: 'ObjectId',
          type: 'oid',
        },
        {
          name: 'name',
          alias: 'Name',
          type: 'string',
        },
        {
          name: 'legacyId',
          alias: 'Legacy object ID',
          type: 'string',
        },
      ],
      objectIdField: 'objectId',
      geometryType: 'polygon',
      outFields: ['*'],
      source: [],
      renderer: polygonFeatureRenderer,
      labelingInfo: [areasLabelClass],
    });

    // Define feature layers and add to map
    const localitiesLayer = new GeoJSONLayer({
      url: '/static/layers/lauLocalities.geojson',
      renderer: localitiesRenderer,
    });

    const countiesLayer = new GeoJSONLayer({
      url:'/static/layers/lauCountiesSimplified.geojson',
      maxScale: countiesMaxScale,
      labelingInfo: [countiesLabelClass],
      renderer: polygonFeatureRenderer,
      title: 'county',
      outFields: ['name', 'OBJECTID_1', 'OBJECTID', 'region_type'],
    });

    const regionsLayer = new GeoJSONLayer({
      url: '/static/layers/lauRegionsSimplified.geojson',
      minScale: countiesMaxScale,
      maxScale: regionsMaxScale,
      labelingInfo: [regionsLabelClass],
      renderer: polygonFeatureRenderer,
      title: 'region',
      outFields: ['name', 'OBJECTID', 'region_type', 'parent_region'],
    });


    /*
    const neighborhoodsLayer = new GeoJSONLayer({
      url: '/static/layers/lauNeighborhoodsSimplified.geojson',
      minScale:regionsMaxScale,
      labelingInfo: [regionsLabelClass],
      renderer: polygonFeatureRenderer,
      title: 'neighborhood',
      outFields: ['name', 'OBJECTID', 'region_type', 'parent_region'],
    });
    */

    const neighborhoodsLayer = new FeatureLayer({
      url: 'https://services3.arcgis.com/pIjZlCuGxnW1cJpM/arcgis/rest/services/lauNeighborhoodsSimplified/FeatureServer',
      minScale:regionsMaxScale,
      labelingInfo: [regionsLabelClass],
      renderer: polygonFeatureRenderer,
      title: 'neighborhood',
      outFields: ['name', 'region_type', 'parent_region'],
    });


    /*
    const areasLayer = new GeoJSONLayer({
      url:
        '/static/layers/lauAreasSimplified.geojson',
      renderer: polygonFeatureRenderer,
      labelingInfo: [areasLabelClass],
      title: 'area',
      outFields: ['*'],
    });
    */

    const areasLayer = new FeatureLayer({
      url:
        'https://services3.arcgis.com/pIjZlCuGxnW1cJpM/arcgis/rest/services/lauAreasView/FeatureServer',
      renderer: polygonFeatureRenderer,
      labelingInfo: [areasLabelClass],
      title: 'area',
      outFields: ['*'],
    });

    
  
    // Create new GraphicLayers
    const selectedFeatureGraphicLayer = (isMobile) ? 
      new GraphicsLayer() :
      new GraphicsLayer({
        effect: "drop-shadow(0px, 2px, 2px rgba(63, 153, 149, 0.75))",
      });
    const intersectingFeatureGraphicLayer = new GraphicsLayer();
    const selectedPhotoGraphicsLayer = new AnimatedPointLayer();
    
    const layers = [
      intersectingFeatureGraphicLayer,
      neighborhoodsLayer,
      regionsLayer,
      countiesLayer,
      clientFeatureLayer,
      areasLayer,
      selectedFeatureGraphicLayer,
      localitiesLayer,
      selectedPhotoGraphicsLayer,
      //areaGraphicsGroupLayer,
    ]

    map.addMany(layers);

    var infoPane;
    if (isMobile) {
      infoPane = new CupertinoPane(
        '.cupertino-pane', // Pane container selector
        { 
          parentElement: '.ui-top-left', // Parent container
          breaks: {
              middle: { enabled: false, height: 300,  },
              bottom: { enabled: true, height: 100, bounce: true},
          },
          cssClass: 'card--active',
          simulateTouch: true,
          initialBreak:'bottom',
          buttonDestroy:false,
          onDrag: () => console.log('Drag event')
        }
      );
    }

    


    var returnObject = {
      'map': map,
      'view': view,
      'basemap':basemap,
      'scale': scale,
      'zoomViewModel': zoomViewModel,
      'areaGraphics': selectedFeatureGraphicLayer,
      //'areaGraphicsGroupLayer': areaGraphicsGroupLayer,
      'countiesLayer': countiesLayer,
      'regionsLayer': regionsLayer,
      'neighborhoodsLayer': neighborhoodsLayer,
      'intersectingGraphicsLayer' : intersectingFeatureGraphicLayer,
      'selectedPhotoGraphicsLayer': selectedPhotoGraphicsLayer,
      'clientFeatureLayer': clientFeatureLayer,
      //'selectedAreaGraphics': selectedAreaGraphicsLayer,
      'areasView': '',
      areasLayer: areasLayer,
      'infoPane': infoPane,

    };

    view.whenLayerView(areasLayer).then(layerView =>{
      returnObject.areasView = layerView;
      returnObject.areasView.visible = false;
    })


    view.whenLayerView(localitiesLayer).then(layerView =>{
      returnObject.localitiesView = layerView;
    })



    // Make widgets visible to map view
    for (let widget of document.getElementsByClassName('widget')) {
      widget.style.opacity = '1';
    }


    /*
    if (isMobile) {
      view.ui.add(searchWidget);
    }
    */


    // Add ui elements to map view
    
    var ui = document.getElementsByClassName('ui-container');
    for (let e of ui) {
      view.ui.add(e);
    }

    return returnObject
  }

  function hideInstructionsDiv() {
    const instructionsDiv = document.getElementsByClassName('instructions')[0];
    const instructionsContainer = document.getElementsByClassName('instructions__container')[0];
    instructionsDiv.classList.add('instructions--inactive');
    instructionsContainer.classList.add('instructions--inactive');
    setTimeout(()=> {
      instructionsContainer.style.display = 'None';
    }, 750);
    //map.view.focus();
  }

  document.addEventListener('click', hideInstructionsDiv);
  //document.addEventListener('mousewheel', hideInstructionsDiv);

})





