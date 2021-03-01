

// Applies styling to splide arrows
let splideArrows = document.getElementsByClassName('splide__arrow');
for (let arrow of splideArrows) {
  arrow.classList.add('hvr-grow-shadow--arrow');
}



  

require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/layers/GraphicsLayer",
  "esri/widgets/Sketch/SketchViewModel",
  "esri/Graphic",
  "esri/tasks/support/AttachmentQuery",
  "esri/Basemap",
  "esri/layers/VectorTileLayer",
  "esri/widgets/Zoom/ZoomViewModel",
  "esri/layers/support/LabelClass",
  "esri/geometry/geometryEngine",
], function (
  Map,
  MapView,
  FeatureLayer,
  GraphicsLayer,
  SketchViewModel,
  Graphic,
  AttachmentQuery,
  Basemap,
  VectorTileLayer,
  ZoomViewModel,
  LabelClass,
  geometryEngine
) {
  var view,
    map,
    localitiesLayer,
    localityLayerView,
    countiesLayer,
    regionsLayer,
    neighborhoodsLayer,
    clientFeatureLayer,
    selectedFeatureGraphicLayer,
    sketchGraphicsLayer,
    sketchViewModel,
    zoomViewModel,
    highlight,
    polygonHighlight,
    splide;

  // Get DOM elements
  var infoDiv = document.getElementById("infoDiv");
  var sliderDiv = document.getElementById("sliderDiv");
  var zoomDiv = document.getElementById("zoomDiv");
  var zoomInDiv = document.getElementById("zoomIn");
  var zoomOutDiv = document.getElementById("zoomOut");
  var featureCountDiv = document.getElementById("excavationNumber");
  var invertCountDiv = document.getElementById("invertCount");
  var vertCountDiv = document.getElementById("vertCount");
  var noFossilsInfo = document.getElementById("noFossilsInfo");
  var taxaInfo = document.getElementById("taxaInfo");
  var drawSvg = document.getElementById("drawPath");
  var resetSvg = document.getElementById("resetSvg");

  var locationButton = document.getElementById('locationButton');
  var locationDiv = document.getElementById('location');
  var collectionButton = document.getElementById('collectionButton');
  var collectionDiv = document.getElementById('collection');
  var collectionCaption = document.getElementById('collectionButtonCaption');
  var locationCaption = document.getElementById('locationButtonCaption');
  var cardDiv = document.getElementsByClassName('card')[0];
  var photoLegend = document.getElementsByClassName('photo-indicator')[0];
  var taxaGrid = document.getElementsByClassName('taxa__grid')[0];
  var timescaleDiv = document.getElementById('timeDiv');
  var timescaleBar = document.getElementById('indicator');

      

  /* ==========================================================
     Initialize map
    ========================================================== */

  setUpMap();

  var regionsObject = {
    Neighborhoods: neighborhoodsLayer,
    Regions: regionsLayer,
    Counties: countiesLayer,
  };

  var resetMapSetInterval = setInterval(resetButtonClickHandler, 90000);
  document.onclick = clearInterval(resetMapSetInterval);

  // Add event listeners to custom widgets
  drawSvg.addEventListener("click", drawButtonClickHandler);
  resetSvg.addEventListener("click", resetButtonClickHandler);
  zoomInDiv.addEventListener("click", zoomInClickHandler);
  zoomOutDiv.addEventListener("click", zoomOutClickHandler);

  view.when(function () {
    setNavigationBounds();
  });

  function setNavigationBounds() {
    var initialExtent = view.extent;
    view.watch("stationary", function (event) {
      if (!event) {
        return;
      }
      //If the map has moved to the point where it's center is
      //outside the initial boundaries, then move it back to the
      //edge where it moved out
      var currentCenter = view.extent.center;
      if (!initialExtent.contains(currentCenter)) {
        var newCenter = view.extent.center;

        //check each side of the initial extent and if the
        //current center is outside that extent,
        //set the new center to be on the edge that it went out on
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
     Event handler functions
    ========================================================== */

  // Instructions pop-up animation
  document.onclick = function() {
    document.getElementsByClassName('instructions')[0].style.top = "150%";
    document.getElementsByClassName('ui-top-left')[0].style.left="0"
  }

  // Event handler for reset widget
  function resetButtonClickHandler() {
    sketchViewModel.cancel();
    view.goTo({ center: [-118.248638, 34.06266], zoom: 8 });
    if (highlight) {
      highlight.remove();
    }
    if (polygonHighlight) {
      polygonHighlight.remove();
    }
    resetClientFeatureLayer();
    clearGraphics();
    clearWidgets();
  }

  // Click event for the SketchViewModel widget
  function drawButtonClickHandler() {
    if (polygonHighlight) {
      polygonHighlight.remove();
    }
    clearGraphics();
    sketchViewModel.create("polygon", { mode: "freehand" });
  }

  // Click event for the Zoom widgets
  function zoomInClickHandler() {
    zoomViewModel.zoomIn();
  }
  function zoomOutClickHandler() {
    zoomViewModel.zoomOut();
  }

  // Click event to select feature from feature layers
  view.on("click", function (event) {
    selectFeaturesFromClick(event);
  });

  // Add selectLocalities function to creation of new Sketch
  sketchViewModel.on("create", function (event) {
    if (event.state === "complete") {
      // This polygon will be used to query features that intersect it;
      selectLocalities(event.graphic);
    }
  });

  /* ==========================================================
     Timescale functions
    ========================================================== */

    // Returns an array of ages sorted ascending from AgeRange
    function returnTimeRange(ageRange, age) {
      var rangeArray = ageRange.split(" - ").map(age => parseFloat(age));
      if (age === "years old") {
        rangeArray.map(age => age * .001);
      }
      sortedAgeArray = rangeArray.sort((a,b) => a-b);
    }

    function moveTimescale(ageArray) {
      [minAge, maxAge] = ageArray;
      const timescaleWidth = timescaleDiv.clientWidth;
      const rightPosition = `${(minAge/timescaleWidth) * 100}%`
      timescaleBar.style.right = rightPosition;
      var indicatorLineDiv = document.getElementsByClassName("indicator-line")[0]
      
      const totalAge = minAge + maxAge;
      const timeratio = (maxAge - minAge)/totalAge * timescaleWidth;
      indicatorLineDiv.style.width = timeRatio + "px";

    }

  /* ==========================================================
     Splide functions
    ========================================================== */
  function loadJSON(callback) {
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open("GET", "captions.json", true);
    xobj.onreadystatechange = function () {
      if (xobj.readyState == 4 && xobj.status == "200") {
        callback(xobj.responseText);
      }
    };
    xobj.send(null);
  }

  function removeFileExtension(fileName) {
    return fileName.substr(0, fileName.lastIndexOf("."));
  }

  // Reformats html to remove photos/captions from splide
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

  // returns a div with properly formatted captions from input photo filename
  function formatCaptions(attachment) {
    var attachmentName = removeFileExtension(attachment.name);
    var specimenCaption = document.createElement("p");
    var taxonCaption = document.createElement("b");
    var ageCaption = document.createElement("p");
    var descriptionCaption = document.createElement("p");
    var catNumber = attachmentName.replace("_", " ").replace("-", ".");
    var catNumberCaption = document.createTextNode(` (${catNumber})`);
    var captionsDiv = document.createElement("div");
    captionsDiv.classList.add("splide__captions");

    loadJSON((json) => {
      var captionsJSON = JSON.parse(json);
      var attachmentRecord = captionsJSON[attachmentName];
      taxonCaption.innerHTML = attachmentRecord["Taxon"];
      ageCaption.innerHTML = `${attachmentRecord["AgeRange"]} ${attachmentRecord["Age"]}`;
      descriptionCaption.innerHTML = attachmentRecord["Description"];
      const ageRange = returnTimeRange(attachmentRecord["AgeRange"], attachmentRecord["Age"]);
      moveTimescale(ageRange);

    });

    specimenCaption.append(
      taxonCaption,
      catNumberCaption,
    );

    captionsDiv.append(
      specimenCaption,
      ageCaption,
      descriptionCaption
    );
    return captionsDiv;
  }

  // Adds attachment photo to splide carousel after formatting splide
  function addPhotoToSplide(attachment) {
    var img = document.createElement("img");
    var li = document.createElement("li");
    var splideList = document.getElementsByClassName("splide__list")[0];
    var captions = formatCaptions(attachment);

    // Format HTML for Splide carousel
    li.classList.add("splide__slide");
    li.classList.add(attachment.parentObjectId);
    img.src = attachment.url;

    var newSlide = splideList.appendChild(li);
    var div = document.createElement("div");
    div.className = "splide__slide--imageContainer";

    newSlide.appendChild(div).appendChild(img);
    newSlide.appendChild(captions);
  }

  function newSplide() {
    splide = new Splide(".splide", {
      lazyLoad: true,
    }).mount();
  }

  /* ==========================================================
     Functions to reset/initialize app
    ========================================================== */

  function hideDiv(div) {
    div.style.marginLeft = "-1000px";
  }

  function displayDiv(div) {
    div.style.display = "flex";
    div.style.marginLeft = "0px";
  }

  function clearWidgets() {
    hideDiv(sliderDiv);
    hideDiv(infoDiv);
  }

  function resetInfoDiv() {
    featureCountDiv.innerHTML = "";
    invertCountDiv.innerHTML = "";
    vertCountDiv.innerHTML = "";
  }

  function clearGraphics() {
    sketchGraphicsLayer.removeAll();
    selectedFeatureGraphicLayer.removeAll();
    view.graphics.removeAll();
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
    element.style.display = boolean ? 'block' : 'none';
  }



  /* ==========================================================
     UI functions
    ========================================================== */
  
  locationButton.addEventListener('click', function(){
    setFlex(collectionDiv, false);
    setFlex(locationDiv, true);
    setFlex(photoLegend, false);
    locationButton.classList.add('button--active');
    collectionButton.classList.remove('button--active');
    collectionCaption.classList.remove("button__caption--active");
    locationCaption.classList.add("button__caption--active");
  })

  collectionButton.addEventListener('click', function(){
    
    setFlex(locationDiv, false);
    setFlex(collectionDiv, true);
    setFlex(photoLegend, true);
    locationButton.classList.remove('button--active');
    collectionButton.classList.add('button--active');
    collectionCaption.classList.add("button__caption--active");
    locationCaption.classList.remove("button__caption--active");
  })

  /* ==========================================================
     ClientFeatureLayer functions
    ========================================================== */

  function resetClientFeatureLayer() {
    clientFeatureLayer.queryFeatures().then(function (results) {
      const removeFeatures = {
        deleteFeatures: results.features,
      };
      applyEditsToClientFeatureLayer(removeFeatures);
    });
  }

  function addEdits(results) {
    var graphics = [];
    results.features.forEach(function (feature) {
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
    console.log(edits);
    applyEditsToClientFeatureLayer(edits);
  }

  function applyEditsToClientFeatureLayer(edits) {
    clientFeatureLayer
      .applyEdits(edits)
      .then(function (results) {
        // if edits were removed
        if (results.deleteFeatureResults.length > 0) {
          console.log(
            results.deleteFeatureResults.length,
            "features have been removed"
          );
        }
        // if features were added - call queryFeatures to return newly added graphics
        if (results.addFeatureResults.length > 0) {
          var objectIds = [];
          results.addFeatureResults.forEach(function (feature) {
            objectIds.push(feature.objectId);
          });
          // query the newly added features from the layer
          clientFeatureLayer
            .queryFeatures({
              objectIds: objectIds,
            })
            .then(function (results) {
              console.log(results.features.length, "features have been added.");
            });
        }
      })
      .catch(function (error) {
        console.log(error);
      });
  }

  /* ==========================================================
     Functions to query & select localities layer
    ========================================================== */

  // Zooms to input feature
  function zoomToFeature(featureName, geometry) {
    const geometryOffset = -(geometry.extent.width / 2);

    if (featureName === "Los Angeles") {
      view
        .goTo({
          center: [-118.735491, 34.222515],
          zoom: 8,
        })
        .catch(function (error) {
          if (error.name != "AbortError") {
            console.error(error);
          }
        });
    } else if (featureName == "Ventura") {
      view
        .goTo({
          center: [-119.254898, 34.515522],
          zoom: 8,
        })
        .catch(function (error) {
          if (error.name != "AbortError") {
            console.error(error);
          }
        });
    } else {
      view
        .goTo(geometry.extent.expand(2).offset(geometryOffset, 0))
        .catch(function (error) {
          if (error.name != "AbortError") {
            console.error(error);
          }
        });
    }
  }

  // Formats list of taxa
  function formatTaxa(taxa) {
    const taxaList = taxa.map(taxon => JSON.parse(taxon));

    var combinedTaxaObject = {};

    for (var i=0; i< taxaList.length; i++) {
      Object.keys(taxaList[i]).map(taxon =>{
        var locTaxa = taxaList[i];
        if (combinedTaxaObject[taxon]) {
          combinedTaxaObject[taxon] += locTaxa[taxon];
        } else {
          combinedTaxaObject[taxon] = locTaxa[taxon];
        }
      })
    }
    return combinedTaxaObject
    }  

  
  // Formats taxa cell in taxa grid
  function formatTaxaCell(taxonName, taxonNumber) {
    if (taxonName === "Clams, oysters, ect.") {
      taxonName = "Clams, oysters";
    } else if (taxonName === "Ammonoids, nautiloids") {
      taxonName = "Nautiloids";
    }
    var cell = document.createElement("div");
    var taxaIcon = document.createElement("div");
    var taxonDiv = document.createElement("p");
    cell.classList.add('taxa__cell');
    taxaIcon.classList.add('taxa__icon');
    taxonDiv.innerHTML = `${taxonNumber.toString()} ${taxonName}`;
    cell.append(taxaIcon, taxonDiv);
    taxaGrid.append(cell);
  }

  // Displays info cards after intersecting localities have been queried
  function populateInfoCards(returnedLocalities, polygonName) {
    taxaGrid.innerHTML="";
    // Get counts of Invert/Vert localities based on Category field of 'attributes' property of selected locality records
    const objectIds = returnedLocalities.map(
      (loc) => loc["attributes"]["OBJECTID"]
    );

    const fossilsFound = returnedLocalities.length;

    // Display/hide divs based on fossils returned from query
    if (fossilsFound > 0) {

      const taxa = (returnedLocalities.map(
        loc => loc["attributes"]["taxa"])).filter(taxa => !(taxa=='')
        ); 

      const formattedTaxa = formatTaxa(taxa);
      for (const taxon in formattedTaxa) {
        formatTaxaCell(taxon, formattedTaxa[taxon]);
      }

      createSplideFromAttachments(localitiesLayer, objectIds);
      // Hide/Display other divs

      // Send info to div
      featureCountDiv.innerHTML = fossilsFound.toString() + " excavation sites";
      document.getElementById("featureName").innerHTML = polygonName;
      invertCountDiv.innerHTML = invertCount + " invertebrates";
      vertCountDiv.innerHTML = vertCount + " vertebrates";
    } else {
      if (taxaInfo.style.display === "block") {
        hideDiv(infoDiv);
        setTimeout(() => {
          taxaInfo.style.display = "none";
          displayDiv(infoDiv);
          displayDiv(noFossilsInfo);
        }, 500);
      }
      hideDiv(sliderDiv);
    }
  }

  // Highlights selected localities
  function highlightLocalities(queriedLocalities) {
    // Remove exisiting highlighted features
    if (highlight) {
      highlight.remove();
    }
    // Highlight query results
    highlight = localityLayerView.highlight(queriedLocalities);
  }

  // Selects feature from feature layer after click event
  function selectFeaturesFromClick(screenPoint) {
    clearGraphics();
    var includeLayers = [
      countiesLayer,
      neighborhoodsLayer,
      regionsLayer,
      clientFeatureLayer,
    ];
    view
      .hitTest(screenPoint, { include: includeLayers })
      .then(function (response) {
        var returnedFeature = response.results[0].graphic;
        if (response.results.length > 0) {
          const regionsQuery = {
            where: `name = '${returnedFeature.attributes.name}'`,
            returnGeometry: true,
            outFields: ["*"],
          };
          regionsObject[returnedFeature.attributes.region_type]
            .queryFeatures(regionsQuery)
            .then(function (f) {
              var clickFeature = f.features[0];
              selectLocalities(clickFeature);
              displayIntersectingFeatures(clickFeature);
              const selectedFeatureGraphic = new Graphic({
                geometry: clickFeature.geometry,
                symbol: {
                  type: "simple-fill",
                  color: [0, 185, 235, 0.2],
                  outline: {
                    // autocasts as new SimpleLineSymbol()
                    color: [0, 185, 235, 1],
                    width: 4, // points
                  },
                },
              });
              selectedFeatureGraphicLayer.graphics.removeAll();
              selectedFeatureGraphicLayer.graphics.add(selectedFeatureGraphic);
            })
            .catch(function (error) {
              console.log(error);
            });
        } else {
          resetButtonClickHandler();
        }
      });
  }

  // Selects locality features from geometry
  function selectLocalities(feature) {
    if (feature.attributes) {
      var featureName = feature.attributes.name;
    } else {
      var featureName = "the area";
    }
    const geometry = geometryEngine.simplify(feature.geometry);
    zoomToFeature(featureName, geometry);
    const query = {
      geometry: geometry,
      spatialRelationship: "intersects",
      outFields: ["*"],
      maxRecordCountFactor: 3,
    };
    localitiesLayer
      .queryFeatures(query)
      .then(function (results) {
        const queriedLocalities = results.features;
        populateInfoCards(queriedLocalities, featureName);
        highlightLocalities(queriedLocalities);
      })
      .catch(function (error) {
        console.log(error);
      });
  }

  // Populates client feature layer with features that intersect input feature
  function displayIntersectingFeatures(feature) {
    const regionType = feature.layer.title;
    const query = {
      where: "parent_region = '" + feature.attributes.name + "'",
      returnGeometry: true,
      outFields: ["*"],
    };
    clientFeatureLayer.queryFeatures().then(function (results) {
      const removeFeatures = {
        deleteFeatures: results.features,
      };
      applyEditsToClientFeatureLayer(removeFeatures);
    });

    if (regionType == "Counties") {
      regionsLayer.queryFeatures(query).then(function (results) {
        addEdits(results);
      });
    } else {
      neighborhoodsLayer.queryFeatures(query).then(function (results) {
        addEdits(results);
      });
    }
  }

  /* ==========================================================
     Functions that create image carousel 
    ========================================================== */

  // Create Splide image carousel from object IDs
  function createSplideFromAttachments(layer, ids) {
    var attachmentQuery = new AttachmentQuery({
      objectIds: ids,
    });

    layer.queryAttachments(attachmentQuery).then(function (attachments) {
      const attachmentList = Object.values(attachments).map(
        (attachment) => attachment[0]
      );
      if (attachmentList.length > 0) {

        var selectedAttachmentList = [];
        if (attachmentList.length > 7) {
          let i = 0;
          while(i < 7) {
            const randomNumber = Math.floor(Math.random() * attachmentList.length);
            const randomAttachment = attachmentList.splice(randomNumber, 1)[0];
            selectedAttachmentList.push(randomAttachment);
            i++;
          } 
        } else {
          selectedAttachmentList = attachmentList;
        } 

        resetSplide();

        // Retrieve list of urls of attached images from selected localities
        selectedAttachmentList.forEach((attachment) => {
          addPhotoToSplide(attachment);
        });

        // Create new Splide image slider and set container div to visible
        newSplide();
        displayDiv(sliderDiv);

        // Create graphic at initial Splide slide
        createPointGraphicAtObjectId(attachmentList[0].parentObjectId);

        // Splide event listener
        splide.on("active", function (slide) {
          const slideObjectId = slide.slide.classList[1];
          createPointGraphicAtObjectId(slideObjectId);
        });
      } else {
        hideDiv(sliderDiv);
      }
    });
  }

  // Creates a graphic for locality that is in view of Splide carousel
  function createPointGraphicAtObjectId(objectId) {
    var highlightQuery = {
      objectIds: [objectId],
      outFields: ["*"],
      returnGeometry: true,
    };
    localityLayerView.queryFeatures(highlightQuery).then(function (attachment) {
      var visibleAttachmentGeometry = {
        type: "point", // autocasts as new Point()
        longitude: attachment.features[0].geometry.longitude,
        latitude: attachment.features[0].geometry.latitude,
      };
      // Create graphic around record currntly being displayed in Splide carousel
      const selectedGraphic = new Graphic({
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
      view.graphics.removeAll();
      view.graphics.add(selectedGraphic);
    });
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
              id: "c65f3f7dc5754366b4e515e73e2f7d8b", // Custom LAU Basemap
            },
          }),
        ],
      });
  
      map = new Map({
        basemap: basemap,
      });
  
      view = new MapView({
        container: "viewDiv",
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
      sketchGraphicsLayer = new GraphicsLayer();
      map.add(sketchGraphicsLayer);
  
      selectedFeatureGraphicLayer = new GraphicsLayer();
      map.add(selectedFeatureGraphicLayer);
  
      // Create the new sketch view model and sets its layer
      sketchViewModel = new SketchViewModel({
        view: view,
        layer: sketchGraphicsLayer,
        updateOnGraphicClick: false,
        polygonSymbol: {
          type: "simple-fill",
          color: [0, 185, 235, 0.2],
          size: "1px",
          outline: {
            color: [0, 185, 235, 0.5],
            width: "3px",
          },
        },
      });
  
      zoomViewModel = new ZoomViewModel({
        view: view,
      });
  
      // Configure widget icons
      drawWidget.addEventListener(
        "click",
        function (event) {
          event.preventDefault;
          drawSvg.classList.remove("draw-widget__animation");
          drawWidget.offsetWidth;
          drawSvg.classList.add("draw-widget__animation");
        },
        false
      );
  
      var resetSvg = document.getElementById("resetSvg");
  
      resetWidget.addEventListener(
        "click",
        function (event) {
          event.preventDefault;
          resetSvg.classList.remove("reset-widget__animation");
          resetWidget.offsetWidth;
          resetSvg.classList.add("reset-widget__animation");
        },
        false
      );
  
      // Create renderers, LabelClasses and FeatureLayers
      const localitiesRenderer = {
        type: "simple",
        symbol: {
          type: "simple-marker",
          size: 6,
          color: [20, 204, 180, 0.5],
          outline: {
            width: 0.5,
            color: [247, 247, 247, 0.5],
          },
        },
      };
  
      const heatmapRenderer = {
        type: "heatmap",
        colorStops: [
          { color: "rgba(63, 40, 102, 0)", ratio: 0 },
  
          { color: "#5d32a8", ratio: 0.332 },
  
          { color: "#a46fbf", ratio: 0.747 },
          { color: "#c29f80", ratio: 0.83 },
          { color: "#e0cf40", ratio: 0.913 },
          { color: "#ffff00", ratio: 1 }
        ],
        maxPixelIntensity: 25,
        minPixelIntensity: 0
      };
      
  
      const polygonFeatureRenderer = {
        type: "simple",
        symbol: {
          type: "simple-fill",
          style: "none",
          outline: {
            color: [128, 128, 128, 0.5],
            width: "1.5px",
          },
        },
      };
  
      const countiesLabelClass = new LabelClass({
        labelExpressionInfo: { expression: "$feature.NAME" },
        symbol: {
          type: "text", // autocasts as new TextSymbol()
          color: "rgb(40, 40, 40)",
          haloSize: 0.5,
          haloColor: "white",
          font: {
            // autocast as new Font()
            family: "Avenir Next LT Pro Regular",
            weight: "bold",
            size: 13,
          },
        },
      });
  
      const regionsLabelClass = new LabelClass({
        labelExpressionInfo: { expression: "$feature.NAME" },
        symbol: {
          type: "text", // autocasts as new TextSymbol()
          color: "rgb(40, 40, 40)",
          haloSize: 0.5,
          haloColor: "white",
          deconflictionStrategy: "static",
          font: {
            // autocast as new Font()
            family: "Avenir Next LT Pro Regular",
            weight: "normal",
            size: 9.5,
          },
        },
      });
  
      const areasLabelClass = new LabelClass({
        labelExpressionInfo: {
          expression: "Replace(Trim($feature.name), ' ', TextFormatting.NewLine)",
        },
        symbol: {
          type: "text", // autocasts as new TextSymbol()
          color: "rgb(40, 40, 40)",
          haloSize: 0.5,
          haloColor: "white",
          deconflictionStrategy: "static",
          font: {
            // autocast as new Font()
            family: "Avenir Next LT Pro Regular",
            weight: "bold",
            size: 9.5,
          },
        },
      });
  
      var countiesMaxScale = 1155581;
      var regionsMaxScale = 288895;
      var neighborhoodsMinScale = 144448;
  
      clientFeatureLayer = new FeatureLayer({
        title: "Areas",
        spatialReference: {
          wkid: 4326,
        },
        fields: [
          {
            name: "region_type",
            alias: "Region Type",
            type: "string",
          },
          {
            name: "objectId",
            alias: "ObjectId",
            type: "oid",
          },
          {
            name: "name",
            alias: "Name",
            type: "string",
          },
          {
            name: "legacyId",
            alias: "Legacy object ID",
            type: "string",
          },
        ],
        objectIdField: "objectId",
        geometryType: "polygon",
        outFields: ["*"],
        source: [],
        renderer: polygonFeatureRenderer,
        labelingInfo: [areasLabelClass],
      });
  
      localitiesLayer = new FeatureLayer({
        url:
          "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/LAU_Localities_View/FeatureServer",
        renderer: localitiesRenderer,
      });
  
      countiesLayer = new FeatureLayer({
        url:
          "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Counties_View/FeatureServer",
        maxScale: countiesMaxScale,
        labelingInfo: [countiesLabelClass],
        renderer: polygonFeatureRenderer,
        title: "Counties",
        outFields: ["*"],
      });
  
      regionsLayer = new FeatureLayer({
        url:
          "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Regions_(v2)_View/FeatureServer",
        minScale: countiesMaxScale,
        maxScale: regionsMaxScale,
        labelingInfo: [regionsLabelClass],
        renderer: polygonFeatureRenderer,
        title: "Regions",
        outFields: ["*"],
      });
  
      neighborhoodsLayer = new FeatureLayer({
        url:
          "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Neighborhoods_View/FeatureServer",
        minScale: neighborhoodsMinScale,
        labelingInfo: [regionsLabelClass],
        renderer: polygonFeatureRenderer,
        title: "Neighborhoods",
        outFields: ["*"],
      });
  
      // Add all features layers to map
      map.addMany([
        neighborhoodsLayer,
        regionsLayer,
        countiesLayer,
        clientFeatureLayer,
        localitiesLayer,
      ]);
  
      // Add widgets to view
      //view.ui.components = [];
  
      for (let widget of document.getElementsByClassName("widget")) {
        widget.style.opacity = "1";
      }
  
    var ui = document.getElementsByClassName('ui-container');
    for (let e of ui) {
      view.ui.add(e);
    }
  
      // Set localityLayerView to layerView when localities are selected (for highlight)
      view.whenLayerView(localitiesLayer).then(function (layerView) {
        localityLayerView = layerView;
      });

      view.when(function() {
        setVisible('#viewDiv', true);
        setVisible('#loading', false);
      }).catch(function(error){
        console.log("error: ", error);
      });
    
  
  
    }
});
