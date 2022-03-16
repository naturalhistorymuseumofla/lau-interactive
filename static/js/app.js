
var isMobile  = (screen.height < 719 || screen.width < 1023) ? true : false;

if (isMobile) {
  document.documentElement.setAttribute('data-mobile', 'true');
}

var exportView;

require([
  'esri/Map',
  'esri/views/MapView',
  'esri/layers/FeatureLayer',
  'esri/layers/GraphicsLayer',
  'esri/Graphic',
  'esri/layers/VectorTileLayer',
  'esri/widgets/Zoom/ZoomViewModel',
  'esri/layers/support/LabelClass',
  //"esri/views/2d/layers/BaseLayerViewGL2D",
  //"esri/core/promiseUtils",
  //"esri/core/watchUtils",
  "esri/geometry/support/webMercatorUtils",
  "esri/widgets/Search/SearchViewModel",
  "esri/tasks/Locator",
], function (
  Map,
  MapView,
  FeatureLayer,
  GraphicsLayer,
  Graphic,
  VectorTileLayer,
  ZoomViewModel,
  LabelClass,
  //BaseLayerViewGL2D,
  //promiseUtils,
  //watchUtils,
  webMercatorUtils,
  SearchVM,
  Locator
) {

  // Initialize splide and map objects
  var splide = newSplide();
  var map = setUpMap();
  exportView = map.view;


 /* ==========================================================
    Functions to query & select localities layer
  ========================================================== */

  // Starting point to display the geometry of a feature, query the database
  // and display all returned info onto the map/info panels
  function main(feature, mapPoint, search=false) {

    if (feature) {
      // Used when querying database (since a selected graphic from hitTest should be used)
      map.selectedFeature.name = feature.attributes.name;
      map.selectedFeature.region = (map.currentFeature.region=='county') ? 'region' :
      (map.currentFeature.region == 'region') ? 'neighborhood' : ''
    } else {
      map.selectedFeature.name = '';
    }
    
    // Get query object from database
    getArea(mapPoint, search).then(data => {
      // If response has data, use it to populate info cards
      if (data) {
        map['currentFeature'] = {'name':data.name, 'region': data.region};
        addAreaHighlight(data); 
        if (data.region === 'county' || data.region == 'region') {
          // All of the subregions of a selected area (i.e. regions in a county)
          getIntersectingAreas(data).then(areas => {
            addIntersectingAreas(areas.features);
          });
        }
        if (data.number_of_sites) {
          populateInfoCards(data);
        } else {
          populateNullCards(data.name);
        }
      } else {
        // If nothing was selected and no data was returned from database query, reset map
        resetButtonClickHandler();
      }
    });
  }

  function returnZoomScale() {
    let screenArea = window.innerHeight * window.innerWidth;
    var featureArea;
    if (featureArea > 90000000){
      const scale = (featureArea/screenArea) * 150;
      return scale;
    } else {
      const scale = (featureArea/screenArea) * 1000
      return scale;
    }
  }

  // goTo function logic
  function zoomToFeature(geometry, name) {
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
          scale: returnZoomScale(geometry),
        },
        'Santa Barbara': {
          center: [-120.1, 34.8],
        },
        default: geometry
      },
      false: {
        'Los Angeles': {
          center: [-118.735491, 34.222515],
          scale: returnZoomScale(geometry),
        },
        'Ventura': {
          center: [-119.254898, 34.515522],
          scale: returnZoomScale(geometry),
        },
        default: {
          center: geometry.extent.expand(2).offset(geometryOffset, 0),
        }
      }
    };
    
    if (name in zoomOptions[isMobile]) {
      map.view
      .goTo(zoomOptions[isMobile][name], goToOptions)
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

  // Adds sub-region geometry as features in clientFeatureLayer using geometry returned from db
  function addIntersectingAreas(areas) {
    resetClientFeatureLayer();
    const areaGraphics = [];
    // Iterate over array of areas returned from MongoDB and convert them into Polygons
    areas.forEach((area) => {
      //let polygon = new Polygon;
      // Converts geojson features into Polygons
      let coordinates = (area.geometry.type === 'MultiPolygon') ? area.geometry.coordinates.flat(1) : area.geometry.coordinates;
      //polygon.rings = coordinates;
      let areaGraphic = new Graphic({
        geometry: {
          type: 'polygon',
          rings: coordinates
        },
        attributes: {
          name: area.name,
          region_type: area.region,
        },
        labelPlacement: 'always-horizontal',
        symbol: {
          type: "simple-fill",  // autocasts as new SimpleFillSymbol()
          style: 'none',
          outline: {
            color: [15, 15, 15, 0.75],
            width: '2px',
          },
        }
      });
      areaGraphics.push(areaGraphic);
    });
    // Construct edits object for applyEdits method of clientFeatureLayer
    const edits = {
      addFeatures: areaGraphics,
      //deleteFeatures: (oldFeatureLength)? oldFeatures : ''
    };
    applyEditsToClientFeatureLayer(edits);
  }

  // Functions to create/update clientFeatureLayer
  function resetClientFeatureLayer() {
    // Uses objectIds stored in the map.intersectingFeatures array to delete old intersecting
    // features from clientFeatureLayer
    let oldFeatureLength = map.intersectingFeatures;
    if (oldFeatureLength) {
      const edits = {
        deleteFeatures: map.intersectingFeatures,
      };
      applyEditsToClientFeatureLayer(edits);
    }
  }

  // Helper function to applyEdits to clientFeatureLayer
  function applyEditsToClientFeatureLayer(edits) {
    map.clientFeatureLayer
      .applyEdits(edits)
      .then(function (results) {
        if (results.deleteFeatureResults.length > 0) {
          // If all features in the clientFeatureLayer were deleted, then intersectingFeatures
          // should be falsy 
          map.intersectingFeatures = 0;
        }
        // If features were added - call queryFeatures to return newly added graphics
        if (results.addFeatureResults.length > 0) {
          map.intersectingFeatures = results.addFeatureResults.length;
          var objectIds = [];
          results.addFeatureResults.forEach(function (feature) {
            objectIds.push(feature.objectId);
          });
          map.intersectingFeatures = objectIds.map(i => ({objectId: i}));
          // Query the newly added features from the layer
          map.clientFeatureLayer.queryFeatures({
              objectIds: objectIds
          })
        }
      })
      .catch(function (error) {
        console.log(error);
      });
  }

  // Function that retrieves data/geometry that intersected with screenpoint from db
  async function getArea(mapPoint, search=false) {
    const scale = map.view.scale;
    let region = (scale > 600000) ? 'county' :
                  (600000 > scale && scale > 188895) ? 'region' :'neighborhood';
    const queryObject = {
      'latitude': mapPoint.latitude,
      'longitude': mapPoint.longitude,
      'region': region,
      'currentFeature': ('currentFeature' in map) ? map.currentFeature : '',
      'selectedFeature': (map.selectedFeature.name) ? map.selectedFeature : '',
      'search': search,
    };
    let response = await fetch('/spatial-query', {
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

  // Retrieves intersecting areas from db
  async function getIntersectingAreas(feature) {
    const region = (feature.region == 'county') ? 'region' : 'neighborhood'
    const queryObject = {
      'name': feature.name,
      'region': region,
    };
    let response = await fetch('/intersecting-areas-query', {
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

  // Queries database for features based on screenPoint
  function selectFeaturesFromClick(screenPoint) {
    const mapPoint = map.view.toMap(screenPoint);
    // A hitTest only needs to be performed if there are features in the clientFeatureLayer
    if (map.intersectingFeatures) {
      map.view.hitTest(screenPoint, {include: map.clientFeatureLayer})
      .then(feature => {
        if (feature.results[0]) { // A feature was returned
          clearGraphics();
          main(feature.results[0].graphic, mapPoint)
        } else { // No feature was returned
          clearGraphics();
          main(null, mapPoint);
        }
      })
    } else {
      clearGraphics();
      main(null, mapPoint);
    }
  }

  // Adds null card with feature name
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

  // Populate all info cards (photos, timescale, taxa) with data from db
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

  // Adds highlight around selected feature as a graphic using geometry returned from db
  function addAreaHighlight(area) {
    // Adds the blue highlight polygon as a graphic to a graphic layer
    const geometry = area.geometry;
    // Converts coordinates from geojson to ArcGIS Polygon rings
    const coordinates = (geometry.type === 'MultiPolygon') ? geometry.coordinates.flat(1) : geometry.coordinates;
    const selectedAreaGraphic = new Graphic({
      geometry: {
        type: 'polygon',
        rings: coordinates
      },
      attributes: {
        name: area.name,
        region_type: area.region,
        //parent_region: parent_region
      },
      labelPlacement: 'always-horizontal',
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
    zoomToFeature(selectedAreaGraphic.geometry, area.name);
  }


 /* ==========================================================
    Taxa list functions
    ========================================================== */

  // Takes taxa data and builds a css grid with snippets of info
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
        'es': 'Ammoniodeos, nautiloideos, pulpos',
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
    // Create captions divs 
    const taxonCaption = document.createElement('p');
    const ageCaption = document.createElement('p');
    const descriptionCaption = document.createElement('p');
    const catNumberCaption = document.createElement('p')
    const captionsDiv = document.createElement('div');

    // Add classes to style captions
    taxonCaption.classList.add('caption__taxon');
    descriptionCaption.classList.add('caption__description');

    // Add photo info to divs
    taxonCaption.innerHTML = photo.taxon;
    ageCaption.innerHTML = photo.age.replace(' - ', '-').toLowerCase(); // Fix this in the database
    descriptionCaption.innerHTML = photo.description;
    catNumberCaption.innerHTML = `${photo.display_id}`;
    captionsDiv.classList.add('splide__captions');

    // Append caption divs to parent divs
    captionsDiv.append(
      descriptionCaption,
      taxonCaption,
      ageCaption,
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
    Animated webGL point layer
    ========================================================== */

  /*
  // A 2D webGL layer for animated point for selected photo
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
  */

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
    } if (!immersion || immersion === 0) {
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
    const featureName = feature.name;
    /*
    map.intersectingAreas.filter = {
      where: `name = "${featureName}"`
    }
    */
    /*
    const featureName = feature.name
    map.areasView.visible = true;
    map.areasView.filter = {
      where: "parent_region = '" + featureName + "'"
    }
    */
  }


 /* ==========================================================
    Event handler functions
    ========================================================== */

  document.addEventListener('click', hideInstructionsDiv, {once:true});

  // Refresh map after period of inactivity
  var resetMapSetInterval = setInterval(resetMap, 60000);

  document.addEventListener('click', function(event) {
    // Idle timer event handling
    clearInterval(resetMapSetInterval);
    resetMapSetInterval = setInterval(resetMap, 60000);
    const classList = event.target.classList;
    // Close button event handling
    if (event.target.classList.contains('close-button')) {
      resetButtonClickHandler();
    // Zoom buttons event handling
    } else if (event.target.id === "zoomIn"){
      map.zoomViewModel.zoomIn();
    } else if (event.target.id === "zoomOut"){
      map.zoomViewModel.zoomOut();
    } else if (!classList.contains('search__suggest-list') && !classList.contains('search__suggest-list-item') && !classList.contains('search__input')) {
      document.getElementsByClassName('search__suggest-list')[0].innerHTML = '';
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
  }, {passive:true});

  // Click event for select feature from feature layers
  map.view.on("click", function (event) {
    event.preventDefault();
    selectFeaturesFromClick(event);
  });


  function removeSearchActive() {
    const searchDiv = document.getElementsByClassName('search')[0];
    const searchInput = document.getElementsByClassName('search__input')[0];
    const suggestList = document.getElementsByClassName('search__suggest-list')[0];
    document.body.setAttribute('search-active', 'false')
    document.getElementsByClassName('search__container')[0].setAttribute('search-active', 'false');
    document.getElementsByClassName('search__suggest')[0].setAttribute('search-active', 'false');
    searchDiv.setAttribute('search-active', 'false');
    searchInput.setAttribute('search-active', 'false');
    suggestList.setAttribute('search-active', 'false');
  }

  // Event handler for reset widget
  function resetButtonClickHandler() {
    document.getElementsByClassName('search__suggest-list')[0].innerHTML = '';
    document.getElementsByClassName('search__input')[0].value = '';
    removeSearchActive();
    displayIntersectingAreas('')
    clearGraphics();
    clearWidgets();
    setFlex(document.getElementsByClassName('photo-indicator')[0], false);
    map.view.focus();
  }

  // Used in resetMap function
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
  });


 /* ==========================================================
    Functions to reset/initialize app
  ========================================================== */

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
    map.intersectingGraphicsLayer.removeAll();
    map.areaGraphics.graphics.removeAll();
    resetClientFeatureLayer();
    map.selectedFeature = {name: '', region: ''}
    if ('intersectingAreas' in map) {
      map.map.layers.remove(map.intersectingAreas);
      delete map.intersectingAreas;
    }
    if ('highlightLayer' in map) {
      map.map.layers.remove(map.highlightLayer);
      delete map.highlightLayer;
    }
    map.selectedPhotoGraphicsLayer.graphics.removeAll();
    //map.map.layers.remove(map.intersectingAreas);
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

  // Helper function for toggling buttons, such as the time button
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
    
  // Resets map
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
    Function to set up the view, map and add widgets & layers
    ========================================================== */

  function setUpMap() {

    const basemapLayer = new VectorTileLayer({
      portalItem: {
        id: '43ed5ecba7dd4a75b1395c2f3fa3951b' //lauDarkBasemaps
      },
    });

    var map = new Map();

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
        return 700000 + (1000000 - resolution/2) * 0.1;
      } else {
        return 700000 + (1000000 - resolution/2);
      }
    }

    var view = new MapView({
      container: 'viewDiv',
      map: map,
      center: [-118.215, 34.225], // longitude, latitude ,
      scale: returnScale(),
      constraints: {
        snapToZoom: false,
        rotationEnabled: false,
        minZoom: returnZoom(), // Maximum zoom "out"
        maxZoom: 14, // Maximum zoom "in"
        geometry: {
          type: "extent",
          xmin: -121.5,
          ymin:  32.7,
          xmax: -114.7,
          ymax:  36.0
        },
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

    const pointLabelRenderer = {
      type: 'simple',
      symbol: {
        type: 'simple-marker',
        size: 0,
      }
    }

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

    const highlightFeatureRenderer = {
      type: 'simple',
      symbol: {
        type: 'simple-fill',
        style: 'none',
        outline: {
          color: [15, 50, 200, 0.75],
          width: '2px',
        },
      },
    };

    const countiesLabelClass = new LabelClass({
      labelExpressionInfo: { expression: '$feature.NAME' },
      labelPlacement: 'above-center',
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
      labelPlacement: 'above-center',
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
    const localitiesLayer = new FeatureLayer({
      url: 'https://services3.arcgis.com/pIjZlCuGxnW1cJpM/arcgis/rest/services/lauLocalitiesView/FeatureServer',
      renderer: localitiesRenderer,
      title: 'localityLayer',
      objectIdField: "ObjectId",
      outFields: ['ObjectId', 'site']
    });

    const countiesLayer = new FeatureLayer({
      url:  'https://services3.arcgis.com/pIjZlCuGxnW1cJpM/arcgis/rest/services/lauCountiesCentroids/FeatureServer',
      renderer: pointLabelRenderer,
      labelingInfo: [countiesLabelClass],
      maxScale: countiesMaxScale,
      outFields: ["name"]
    });

    const regionsLayer = new FeatureLayer({
      url:  'https://services3.arcgis.com/pIjZlCuGxnW1cJpM/arcgis/rest/services/lauRegionsCentroids/FeatureServer',
      renderer: pointLabelRenderer,
      labelingInfo: [regionsLabelClass],
      minScale: countiesMaxScale,
      maxScale: regionsMaxScale,
      outFields: ["name"]
    });

    const neighborhoodsLayer = new FeatureLayer({
      url: 'https://services3.arcgis.com/pIjZlCuGxnW1cJpM/arcgis/rest/services/lauNeighborhoodsCentroids/FeatureServer',
      renderer: pointLabelRenderer,
      labelingInfo: [regionsLabelClass],
      minScale:regionsMaxScale,
      outFields: ["name"]
    });

    //const AnimatedPointLayer = new GraphicsLayer();

    /*
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
    */
    
    
    // VectorTileLayer for areas polygons
    const areasLayer = new VectorTileLayer({
      portalItem: {
        id: '6e3c7ac158dd401c81f0075c1a97543b' //lauDarkBasemaps
      },
    });
 
    // Graphics Layers 
    const areaGraphics = new GraphicsLayer({
      effect: "drop-shadow(0px, 2px, 2px rgba(63, 153, 149, 0.75))",
    });

    const intersectingGraphicsLayer = new GraphicsLayer({
      labelingInfo:[map.areasLabelClass],
    });

    // Animated Point Layer for selected photo graphic
    const selectedPhotoGraphicsLayer = new GraphicsLayer();
    
    const layers = [
      basemapLayer,
      intersectingGraphicsLayer,
      clientFeatureLayer,
      neighborhoodsLayer,
      regionsLayer,
      countiesLayer,
      areasLayer,
      localitiesLayer,
      areaGraphics,
      selectedPhotoGraphicsLayer,
    ]

    map.addMany(layers);

    // Add drawer UI for mobile
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


    // Create layerView
    view.whenLayerView(localitiesLayer).then(layerView =>{
      returnObject.localitiesView = layerView;
    });


    // Create Search widget using viewmodel 
    const search = new SearchVM({
      view: view,
      popupEnabled: false,
      includeDefaultSources: false,
      maxSuggestions: 5,
      goToOverride: e => '',
      sources: [
        {
          locator: new Locator({
            url: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer",
          }),
          placeholder: "Search",
          outFields: ['Match_addr', 'Addr_type'],
          singleLineFieldName: "SingleLine", // Required for search to return results for impartial search terms
          name: "ArcGIS World Geocoding Service",
          filter: {
            geometry: view.constraints.geometry,
          },
        },
      ],
    });
    
    const searchDiv = document.getElementsByClassName('search')[0];
    const searchInput = document.getElementsByClassName('search__input')[0];
    const suggestList = document.getElementsByClassName('search__suggest-list')[0];
  
    searchInput.addEventListener('input', e => {
      search.suggest(searchInput.value).then(results => {
        let suggestions = results.results[0].results;
        suggestList.innerHTML = '';
        suggestions.forEach(suggestion => {
          const li = document.createElement('li');
          li.classList.add('search__suggest-list-item');
          li.setAttribute('role', 'option'); 
          const svg = '<span><svg class="map-icon" transform="translate(-6.63 -0.33)" viewBox="0 0 36.74 49.34"><path class="cls-1" d="M43.37,17.78C43.37,8.14,35.15.33,25,.33S6.63,8.14,6.63,17.78a16.74,16.74,0,0,0,2.93,9.44h0L23.48,48.86a1.83,1.83,0,0,0,3,0L40.45,27.22h0A16.74,16.74,0,0,0,43.37,17.78ZM25,25.39a7.1,7.1,0,1,1,7.09-7.09A7.09,7.09,0,0,1,25,25.39Z" transform="translate(-6.63 -0.33)"</svg></span>'
          li.innerHTML = `${svg}${suggestion.text}`;
          li.addEventListener('click', e => {
            search.search(li.textContent);
            searchInput.value = li.textContent;
          });
          suggestList.appendChild(li);
        });
      });
    });

    search.on('search-complete', e => {
      suggestList.innerHTML = '';
      removeSearchActive();
    });
  
    searchDiv.addEventListener('submit', e => {
      e.preventDefault();
      search.search(searchInput.value);
    });

    search.on('search-complete', e => {
      const feature = e.results[0].results[0].feature;
      main('', feature.geometry, true);
    });

    
    function addSearchActive() {
      document.body.setAttribute('search-active', 'true')
      document.getElementsByClassName('search__container')[0].setAttribute('search-active', 'true');
      document.getElementsByClassName('search__suggest')[0].setAttribute('search-active', 'true');
      searchDiv.setAttribute('search-active', 'true');
      searchInput.setAttribute('search-active', 'true');
      suggestList.setAttribute('search-active', 'true');
    }


    if(isMobile) {
      searchInput.addEventListener('input', addSearchActive);
      searchInput.addEventListener('focus', addSearchActive);
    }


  

    // Make widgets visible to map view
    for (let widget of document.getElementsByClassName('widget')) {
      widget.style.opacity = '1';
    }

    // Add ui elements to map view
    var ui = document.getElementsByClassName('ui-container');
    for (let e of ui) {
      view.ui.add(e);
    }
    


    var returnObject = {
      'map': map,
      'view': view,
      'scale': returnScale(),
      'zoomViewModel': zoomViewModel,
      'countiesMaxScale': countiesMaxScale,
      'regionsMaxScale': regionsMaxScale,
      'areaGraphics': areaGraphics,
      'intersectingGraphicsLayer' : intersectingGraphicsLayer,
      'selectedPhotoGraphicsLayer': selectedPhotoGraphicsLayer,
      'clientFeatureLayer': clientFeatureLayer,
      'infoPane': infoPane,
      'areasLayer': areasLayer,
      'areasLabelClass': areasLabelClass,
      'intersectingFeatures': 0,
      'selectedFeature': {
        name: '',
        region: '',
      }
    };

    return returnObject
  }
});

export {exportView};

