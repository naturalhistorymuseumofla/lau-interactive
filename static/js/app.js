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
) {


  const zoomInDiv = document.getElementById("zoomIn");
  const zoomOutDiv = document.getElementById("zoomOut");
  var neighborhoodsView;
  var countiesView;
  var regionsView;
  var areasView;

  
  /* ==========================================================
    Initialize map
  ========================================================== */

  var map = setUpMap();


   // Refresh map after period of inactivity
   var resetMapSetInterval = setInterval(resetButtonClickHandler, 90000);
   document.onclick = clearInterval(resetMapSetInterval);
 
 
   map.view.when(() => {
     setNavigationBounds();
   });
 
 
   // Stops panning of the map past a defined bounding box
   function setNavigationBounds() {
     var view = map.view;
     var initialExtent = view.extent;
     view.watch("stationary", function (event) {
       if (!event) {
         return;
       }
       // If the map has moved to the point where it's center is
       // outside the initial boundaries, then move it back to the
       // edge where it moved out
       var currentCenter = view.extent.center;
       if (!initialExtent.contains(currentCenter)) {
         var newCenter = view.extent.center;
 
 
         // check each side of the initial extent and if the
         // current center is outside that extent,
         // set the new center to be on the edge that it went out on
         if (currentCenter.x < initialExtent.xmin) {
           newCenter.x = initialExtent.xmin;
         }
         if (currentCenter.x > initialExtent.xmax) {
           newCenter.x = initialExtent.xmax;
         }
         if (currentCenter.y < initialExtent.ymin) {
           newCenter.y = initialExtent.ymin;
         }
         if (currentCenter.y > initialExtent.ymax) {
           newCenter.y = initialExtent.ymax;
         }
         view.goTo(newCenter);
       }
     });
   }

  /* ==========================================================
     Functions to query & select localities layer
    ========================================================== */

    function zoomToFeature(feature) {
      const geometry = feature.geometry;
      const featureName = feature.attributes.name;
      const geometryOffset = -(geometry.extent.width / 2);
      const goToOptions = {
        animate: true,
        duration: 600,
        ease: 'ease-in-out'
      }
  
  
      if (featureName === 'Los Angeles') {
        map.view
          .goTo({
            center: [-118.735491, 34.222515],
            zoom: 8
          }, goToOptions)
          .catch(function (error) {
            if (error.name != 'AbortError') {
              console.error(error);
            }
          }, goToOptions);
      } else if (featureName == 'Ventura') {
        map.view
          .goTo({
            center: [-119.254898, 34.515522],
            zoom: 8,
          }, goToOptions)
          .catch(function (error) {
            if (error.name != 'AbortError') {
              console.error(error);
            }
          });
      } else {
        map.view
          .goTo(geometry.extent.expand(2).offset(geometryOffset, 0), goToOptions)
          .catch(function (error) {
            if (error.name != 'AbortError') {
              console.error(error);
            }
          });
      }
    }

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

    function selectFeaturesFromClick(screenPoint) {
      // clearGraphics();
    
      var includeLayers = [
        map.countiesLayer,
        map.regionsLayer,
        map.neighborhoodsLayer,
        map.clientFeatureLayer,
        map.areasLayer
      ]
      
      // hitTest returns feature that intersects with tap/click
      // i.e. screenPoint
      map.view.hitTest(screenPoint, {include: includeLayers})
        .then(feature => {
          var returnedFeature = feature.results[0].graphic;
          zoomToFeature(returnedFeature);
          
          addAreaHighlight(returnedFeature.geometry)
          if (feature.results.length > 0) {
            // Get query object from database
            getQuery(returnedFeature).then(data => {
              // If response has data, use it to populate info cards
              if (data) {
                populateInfoCards(data);
              } else {
                populateNullCards(returnedFeature.attributes.name)
              }
            })
          } else {
            //resetButtonClickHandler
          }
          displayIntersectingAreas(returnedFeature.attributes)
        })
    }

    function populateNullCards(featureName) {
      const infoCardDiv = document.getElementById('infoCard');
      const noInfoCardDiv = document.getElementById('noInfoCard');
      hideDiv(infoCard);
      displayDiv(noInfoCardDiv);

      for (let div of document.getElementsByClassName('featureName')) {
        div.innerText = featureName;
      }

    }
    function populateInfoCards(stats) {
      const infoCardDiv = document.getElementById('infoCard');
      const noInfoCardDiv = document.getElementById('noInfoCard');
      const taxaInfoDiv = document.getElementsByClassName('taxa--info')[0];
      const taxaNullDiv = document.getElementsByClassName('taxa--null')[0];
      const excavationDiv = document.getElementById('excavationNumber');
      const photosDiv = document.getElementsByClassName('photos--info')[0];
      const photosNullDiv = document.getElementsByClassName('photos--null')[0];

      // Display appropriate divs
      hideDiv(noInfoCardDiv);
      displayDiv(infoCardDiv);

      // Set feature name to all title divs
      for (let div of document.getElementsByClassName('featureName')) {
        div.innerText = stats.name;
      }

      // Set excavation site number 
      excavationDiv.innerHTML = `${stats.number_of_sites} excavation sites`;

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
        populateTaxaLists(taxa);

        // Display or hide more buttons based on number of taxa
        const moreButtons = document.getElementsByClassName('more');
        for (let button of moreButtons) {
          displayMoreButton(button);
        }
      } else {
        setFlex(taxaInfoDiv, false);
        setFlex(taxaNullDiv, true);
      }
    
      // Handle photos
      if (stats.photos.length > 0) {
        populateSplide(stats.photos);
        setFlex(photosDiv, true);
        setFlex(photosNullDiv, false);
        //setFlex(photoLegend, true);
      } else {
        setFlex(photosNullDiv, true);
        setFlex(photosDiv, false);
        //setFlex(photoLegend, false);
      }
    }

    function addAreaHighlight(geometry) {
      const selectedAreaGraphic = new Graphic({
        geometry: geometry,
        symbol: {
          type: "simple-fill",
          color: [0, 185, 235, 0.2],
          outline: {
            // autocasts as new SimpleLineSymbol()
            color: [0, 185, 235, 1],
            width: 4, // points
          },
        }
      });
      map.areaGraphics.graphics.removeAll();
      map.areaGraphics.graphics.add(selectedAreaGraphic);
    }


    /* ==========================================================
     Taxa list functions
    ========================================================== */

    function populateTaxaLists(taxa) {
      let taxaObj = {
        'Clams, oysters': {
          'fileName': 'clam',
          'category': 'invertebrate'
        },
        'Snails': {
          'fileName': 'snail',
          'category': 'invertebrate' 
        },
        'Sea urchins': {
          'fileName':'urchin',
          'category': 'invertebrate'
        },
        'Worms': {
          'fileName': 'worm',
          'category': 'invertebrate'
        },
        'Crustaceans': {
          'fileName': 'crab',
          'category': 'invertebrate'
        },
        'Nautiloids': {
          'fileName': 'ammonoid',
          'category': 'invertebrate'
        },
        'Trilobites': {
          'fileName': 'trilobite',
          'category': 'invertebrate'
        },
        'Corals': {
          'fileName': 'coral',
          'category': 'invertebrate'
        },
        'Barnacles': {
          'fileName': 'barnacle',
          'category': 'invertebrate'
        },
        'Scaphopods': {
          'fileName': 'scaphopod',
          'category': 'invertebrate'
        },
        'Shrimps': {
          'fileName': 'shrimp',
          'category': 'invertebrate'
        },
        'Sharks, rays': {
          'fileName': 'shark',
          'category': 'vertebrate'
        },
        'Fish': {
          'fileName': 'fish',
          'category': 'vertebrate'
        },
        'Birds': {
          'fileName': 'bird',
          'category': 'vertebrate'
        },
        'Whales, dolphins': {
          'fileName': 'whale',
          'category': 'vertebrate'
        },
        'Microfossils': {
          'fileName': 'magnifying-glass',
          'category': 'invertebrate'
        },
        'Walruses, seals': {
          'fileName': 'walrus',
          'category': 'vertebrate'
        },
      }
      for (const taxon in taxa) {
        const vertTopList = document.getElementsByClassName('vert__top-list')[0];
        const invertTopList = document.getElementsByClassName('invert__top-list')[0];
        const vertBottomList = document.getElementsByClassName('vert__bottom-list')[0];
        const invertBottomList = document.getElementsByClassName('invert__bottom-list')[0];
        var cell = document.createElement(`div`);
        var taxaIcon = document.createElement(`img`);
        if (taxaObj[taxon]) {
          const fileName = taxaObj[taxon]['fileName'];
          const category = taxaObj[taxon]['category'];
          taxaIcon.src = `/static/images/${fileName}.svg`;
          var taxonDiv = document.createElement("p");
          cell.classList.add('taxa__cell');
          taxaIcon.classList.add('taxa__icon');
          taxonDiv.innerHTML = `${taxa[taxon].toString()}<br>${taxon}`;
          cell.append(taxaIcon, taxonDiv);
          if (category === "invertebrate") {
            (invertTopList.childElementCount === 4) ? invertBottomList.append(cell) :
            invertTopList.append(cell);
          } else if (category === "vertebrate") {
            (vertTopList.childElementCount === 4) ? vertBottomList.append(cell) :
            vertTopList.append(cell);
          }
        } 
      }
    }

    /* ==========================================================
     Splide functions
    ========================================================== */

      // Adds photos and captions to splide carousel
    function populateSplide(photos) {
      resetSplide();
      photos.forEach((photo) => {
        // Create divs for Splide
        const img = document.createElement('img');
        const li = document.createElement('li');
        const splideList = document.getElementsByClassName('splide__list')[0];
        const captions = formatCaptions(photo);

        // Format HTML for Splide carousel
        img.src = photo.url;
        li.classList.add('splide__slide');
        const newSlide = splideList.appendChild(li);
        const div = document.createElement('div');
        div.className = 'splide__slide--imageContainer';

        newSlide.appendChild(div).appendChild(img);
        newSlide.appendChild(captions);
      })
      const splide = newSplide();
      // Splide event listener for changes in active slide
      splide.on("active", slide => {
        console.log(slide.slide.classList[1]);
      })
      displayDiv(sliderDiv);
    }


    // Foramts captions from photos array for splide carousel
    function formatCaptions(photo) {
      // Create captions divs 
      const specimenCaption = document.createElement('p');
      const taxonCaption = document.createElement('b');
      const ageCaption = document.createElement('p');
      const descriptionCaption = document.createElement('p');
      const captionsDiv = document.createElement('div');

      // Add photo info to divs
      taxonCaption.innerHTML = photo.taxon;
      ageCaption.innerHTML = photo.age;
      descriptionCaption.innerHTML = photo.description;
      const catNumberCaption = document.createTextNode(` (${photo.specimen_id})`);
      captionsDiv.classList.add('splide__captions');

      // Append caption divs to parent divs
      specimenCaption.append(taxonCaption, catNumberCaption);
      captionsDiv.append(specimenCaption, ageCaption, descriptionCaption);

      return captionsDiv;
    }

    // Mounts splide 
    function newSplide() {
      splide = new Splide('.splide', {
        lazyLoad: true,
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
      var visibleAttachmentGeometry = {
        type: "point", // autocasts as new Point()
        longitude: coordinates[0], // Coordinates from monogDB list long first
        latitude: coordinates[1]
      };
      
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
      if (locationButton.classList.contains('button--active')) {
        //view.graphics.items[0].visible = false;
      }   
    }

    /* ==========================================================
     Intersecting features functions
    ========================================================== */

    function displayIntersectingAreas(feature) {
      //const featureUID = `${feature.region_type}_${feature.OBJECTID}`
      const featureName = feature.name
      areasView.visible = true;
      areasView.filter = {
        where: "parent_region = '" + featureName + "'"
      }
    }

    // Add corresponding intersecting features as graphics to a 
    // clientFeatureLayer
    function displayIntersectingGraphics(feature) {
      const intersectionObj = {
        'county': map.regionsLayer,
        'region': map.neighborhoodsLayer
      }
      const query = {
        where: `parent_region = '${feature.attributes.name}'`,
        returnGeometry: true,
        outFields: ["*"],
      }
      removeFeatures();
      intersectionObj[feature.attributes.region_type]
      .queryFeatures(query)
        .then(results => {
          addFeatures(results);
        })
    }

    // Adds features to clientFeatureLayer
    function addFeatures(results) {
      var graphics = [];
      results.features.forEach(feature => {
        var graphic = new Graphic({
          source: results.features,
          geometry: feature.geometry,
          attributes: {
            name: feature.attributes.name,
            region_type: feature.layer.title,
          },
        });
        graphics.push(graphic);
      });
      const edits = {
        addFeatures: graphics,
      };
      applyEditsToClientFeatureLayer(edits);
    }

    
    // Removes all features from clientFeatureLayer, resetting it
    function removeFeatures() {
      map.clientFeatureLayer.queryFeatures().then(function (results) {
        const removeFeatures = {
          deleteFeatures: results.features,
        };
        applyEditsToClientFeatureLayer(removeFeatures);
      });
    }

    // Helper function that applies edits made ot clientFeatureLayer
    function applyEditsToClientFeatureLayer(edits) {
      map.clientFeatureLayer
        .applyEdits(edits)
        .then(results => {
          // if features were added - call queryFeatures to return newly added graphics
          if (results.addFeatureResults.length > 0) {
            var objectIds = [];
            results.addFeatureResults.forEach(feature => {
              objectIds.push(feature.objectId);
            });
            // query the newly added features from the layer
            map.clientFeatureLayer
              .queryFeatures({
                objectIds: objectIds,
              })
          }
        })
        .catch(error => {
          console.log(error);
        });
    }



    /* ==========================================================
     Event handler functions
    ========================================================== */

    // Add event listeners to custom widgets
    document.getElementById('resetWidget')
    .addEventListener("click", resetButtonClickHandler);

    // Click events for zoom widgets
    zoomInDiv.addEventListener("click", () => {
      map.zoomViewModel.zoomIn();
    });
    zoomOutDiv.addEventListener("click", () => {
      map.zoomViewModel.zoomOut();
    });

    // Click event for select feature from feature layers
    map.view.on("click", function (event) {
      selectFeaturesFromClick(event);
    });

    // Event handler for reset widget
    function resetButtonClickHandler() {
      map.view.goTo({ center: [-118.248638, 34.06266], zoom: 8 });
      /*
      if (highlight) {
        highlight.remove();
      }
      if (polygonHighlight) {
        polygonHighlight.remove();
      }
      */
      displayIntersectingAreas('')
      removeFeatures();
      clearGraphics();
      clearWidgets();
    }



  /* ==========================================================
     Functions to reset/initialize app
    ========================================================== */


    function hideDiv(div) {
      div.style.left = "-125%";
    }
  
  
    function displayDiv(div) {
      div.style.display = "flex";
      div.style.left = "0";
    }
  
  
    // Clears all info card panels in ui-top-left containers
    function clearWidgets() {
      const uiTopLeft = document.getElementsByClassName('ui-top-left');
      for (let container of uiTopLeft) {
        container.style.left="-100%"
      }
    }
  
    // Clears all map graphics (outlines)
    function clearGraphics() {
      map.view.graphics.removeAll();
      map.areaGraphics.graphics.removeAll();
    }
    
  
    // Toggles visibility
    function setVisible(selector, boolean) {
      document.querySelector(selector).style.visibility = boolean ? 'visible' : 'hidden';
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
        new VectorTileLayer({
          portalItem: {
            id: 'c65f3f7dc5754366b4e515e73e2f7d8b', // Custom LAU Basemap
          },
        }),
      ],
    });

    var map = new Map({
      basemap: basemap,
    });

    var view = new MapView({
      container: 'viewDiv',
      map: map,
      center: [-118.248638, 34.06266], // longitude, latitude ,
      zoom: 8,
      constraints: {
        snapToZoom: true,
        rotationEnabled: false,
        minZoom: 7,
      },
      popup: {
        autoOpenEnabled: false,
      },
      highlightOptions: {
        color: [0, 185, 235, 0.75],
        fillOpacity: 0.4,
      },
      ui: {
        components: [],
      },
    });

    // Create new GraphicLayers
    
    const selectedFeatureGraphicLayer = new GraphicsLayer();
    map.add(selectedFeatureGraphicLayer);

    const intersectingFeatureGraphicLayer = new GraphicsLayer();
    map.add(intersectingFeatureGraphicLayer);

    const selectedPhotoGraphicsLayer = new GraphicsLayer();
    map.add(selectedPhotoGraphicsLayer);

    /*
    sketchGraphicsLayer = new GraphicsLayer();
    map.add(sketchGraphicsLayer);

    // Create the new sketch view model and sets its layer
    sketchViewModel = new SketchViewModel({
      view: view,
      layer: sketchGraphicsLayer,
      updateOnGraphicClick: false,
      polygonSymbol: {
        type: 'simple-fill',
        color: [0, 185, 235, 0.2],
        size: '1px',
        outline: {
          color: [0, 185, 235, 0.5],
          width: '3px',
        },
      },
    });
    */

    const zoomViewModel = new ZoomViewModel({
      view: view,
    });

    // Configure widget icons
    drawWidget.addEventListener(
      'click',
      function (event) {
        event.preventDefault;
        drawSvg.classList.remove('draw-widget__animation');
        drawWidget.offsetWidth;
        drawSvg.classList.add('draw-widget__animation');
      },
      false
    );

    var resetSvg = document.getElementById('resetSvg');

    resetWidget.addEventListener(
      'click',
      function (event) {
        event.preventDefault;
        resetSvg.classList.remove('reset-widget__animation');
        resetWidget.offsetWidth;
        resetSvg.classList.add('reset-widget__animation');
      },
      false
    );

    // Create renderers, LabelClasses and FeatureLayers
    const localitiesRenderer = {
      type: 'simple',
      symbol: {
        type: 'simple-marker',
        size: 6,
        color: [20, 204, 180, 0.15],
        outline: {
          width: 0,
          color: [247, 247, 247, 0.5],
        },
      },
    };

    const heatmapRenderer = {
      type: 'heatmap',
      colorStops: [
        { color: 'rgba(63, 40, 102, 0)', ratio: 0 },

        { color: '#5d32a8', ratio: 0.332 },

        { color: '#a46fbf', ratio: 0.747 },
        { color: '#c29f80', ratio: 0.83 },
        { color: '#e0cf40', ratio: 0.913 },
        { color: '#ffff00', ratio: 1 }
      ],
      maxPixelIntensity: 25,
      minPixelIntensity: 0
    };
    

    const polygonFeatureRenderer = {
      type: 'simple',
      symbol: {
        type: 'simple-fill',
        style: 'none',
        outline: {
          color: [128, 128, 128, 0.5],
          width: '1.5px',
        },
      },
    };

    const countiesLabelClass = new LabelClass({
      labelExpressionInfo: { expression: '$feature.NAME' },
      symbol: {
        type: 'text', // autocasts as new TextSymbol()
        color: 'rgb(40, 40, 40)',
        haloSize: 0.5,
        haloColor: 'white',
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
        color: 'rgb(40, 40, 40)',
        haloSize: 0.5,
        haloColor: 'white',
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
        color: 'rgb(40, 40, 40)',
        haloSize: 0.5,
        haloColor: 'white',
        deconflictionStrategy: 'static',
        font: {
          // autocast as new Font()
          family: 'Avenir Next LT Pro Regular',
          weight: 'bold',
          size: 9,
        },
      },
    });

    var countiesMaxScale = 1155581;
    var regionsMaxScale = 288895;
    var neighborhoodsMinScale = 144448;

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
      url:'/static/layers/lauCounties.geojson',
      maxScale: countiesMaxScale,
      labelingInfo: [countiesLabelClass],
      renderer: polygonFeatureRenderer,
      title: 'county',
      outFields: ['name', 'OBJECTID_1', 'OBJECTID', 'region_type'],
    });

    const regionsLayer = new GeoJSONLayer({
      url: '/static/layers/lauRegions.geojson',
      minScale: countiesMaxScale,
      maxScale: regionsMaxScale,
      labelingInfo: [regionsLabelClass],
      renderer: polygonFeatureRenderer,
      title: 'region',
      outFields: ['name', 'OBJECTID', 'region_type', 'parent_region'],
    });

    const neighborhoodsLayer = new GeoJSONLayer({
      url: '/static/layers/lauNeighborhoods.geojson',
      minScale: neighborhoodsMinScale,
      labelingInfo: [regionsLabelClass],
      renderer: polygonFeatureRenderer,
      title: 'neighborhood',
      outFields: ['name', 'OBJECTID', 'region_type', 'parent_region'],
    });

    
    const areasLayer = new GeoJSONLayer({
      url:
        '/static/layers/lauAreas.geojson',
      renderer: polygonFeatureRenderer,
      labelingInfo: [areasLabelClass],
      title: 'area',
      outFields: ['*'],
    });
    

    const layers = [
      neighborhoodsLayer,
      regionsLayer,
      countiesLayer,
      clientFeatureLayer,
      areasLayer,
      localitiesLayer,
    ]

    map.addMany(layers);

    /*
    let [neighborhoodsView, 
      regionsView, 
      countiesView, 
      localitiesView] = layers.map((layer) => {
      return view.whenLayerView(layer).then((layerView) => {
        return layerView
      })
    });
    */

    view.whenLayerView(countiesLayer).then(layerView => {
      countiesView = layerView;
    })

    view.whenLayerView(regionsLayer).then(layerView => {
      regionsView = layerView;
    })

    view.whenLayerView(neighborhoodsLayer).then(layerView => {
      neighborhoodsView = layerView;
    })

    view.whenLayerView(areasLayer).then(layerView =>{
      areasView = layerView;
      areasView.visible=false;
    })

    /*
    view.when(layers.map((layer) => {
      view.whenLayerView(layer).then((layerView) =>{
        return
      })
    }))
    */

    // Make widgets visible to map view
    for (let widget of document.getElementsByClassName('widget')) {
      widget.style.opacity = '1';
    }

    // Add ui elements to map view
    var ui = document.getElementsByClassName('ui-container');
    for (let e of ui) {
      view.ui.add(e);
    }
  
    // Stops loading animation and makes map view visible after 
    // localityLayerView has finished loading
    /*
    setTimeout(()=> {
      localitiesLayer.when(function() {
        const instructionsDiv = document.getElementsByClassName('instructions')[0];
        const instructionsContainer = document.getElementsByClassName('instructions__container')[0];
        //document.getElementById('viewDiv').style.opacity = '1';
        instructionsDiv.style.opacity = '1';     
        instructionsContainer.style.opacity = 1;     
      }).catch(function(error){
        console.log('error: ', error);
      });
    }, 2000)
    */

    const returnObject = {
      'map': map,
      'view': view,
      'zoomViewModel': zoomViewModel,
      //'localitiesView': localitiesView,
      'neighborhoodsView': neighborhoodsView,
      'regionsView': regionsView,
      'countiesView': countiesView,
      'areaGraphics': selectedFeatureGraphicLayer,
      'countiesLayer': countiesLayer,
      'regionsLayer': regionsLayer,
      'neighborhoodsLayer': neighborhoodsLayer,
      'intersectingGraphicsLayer' : intersectingFeatureGraphicLayer,
      'selectedPhotoGraphicsLayer': selectedPhotoGraphicsLayer,
      'clientFeatureLayer': clientFeatureLayer,
      'areasLayer': areasLayer
    };

    return returnObject
  }


  function displayMoreButton(button) {
    let bottomLists = document.getElementsByClassName('taxa__bottom-list');
    let isPopulated = false;
    for (let list of bottomLists){
      list.childElementCount > 0 ? isPopulated = true: isPopulated = false;
    }
    isPopulated ? setDisplay(button, true) : setDisplay(button, false);
  }

    //Add Event listener to "more" buttons
  const moreButton = document.getElementsByClassName('more')[0];
  moreButton.addEventListener('click', () => {

    let bottomLists = document.getElementsByClassName('taxa__bottom-list');
    let ifExpanded = moreButton.classList.toggle('button--active');
    if (ifExpanded) {
      moreButton.innerHTML = '- Less';
      for (let list of bottomLists) {
        list.style.maxHeight = list.scrollHeight + 'px';
      }
      const position = moreButton.parentElement.offsetTop;
      ($('.card__content')).animate({
        scrollTop: position
      }, 400);
    } else {
      moreButton.innerHTML = '+ More';
      for (let list of bottomLists) {
        list.style.maxHeight = null;
      }
    }
  })

  document.addEventListener('click', () => {
    const instructionsDiv = document.getElementsByClassName('instructions')[0];
    const instructionsContainer = document.getElementsByClassName('instructions__container')[0];
    instructionsDiv.style.top = '150%';
    instructionsContainer.style.opacity = 0;
    setTimeout(()=> {
      instructionsContainer.style.display = 'None';
    }, 750)

  })

  document.addEventListener('touchstart', () => {
    const instructionsDiv = document.getElementsByClassName('instructions')[0];
    const instructionsContainer = document.getElementsByClassName('instructions__container')[0];
    instructionsDiv.style.top = '150%';
    instructionsContainer.style.opacity = 0;
    setTimeout(()=> {
      instructionsContainer.style.display = 'None';
    }, 750)

  })
  

})
