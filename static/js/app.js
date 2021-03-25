      
/*
Script that loads esri modules, map and data. Inlcudes all functions
to compute and display locality data using the ArcGIS API for JavaSccript
*/


// Load all required Esri AMD modules with esri dojo loader
require([
  `esri/Map`,
  `esri/views/MapView`,
  `esri/layers/FeatureLayer`,
  `esri/layers/GraphicsLayer`,
  `esri/widgets/Sketch/SketchViewModel`,
  `esri/Graphic`,
  `esri/tasks/support/AttachmentQuery`,
  `esri/Basemap`,
  `esri/layers/VectorTileLayer`,
  `esri/widgets/Zoom/ZoomViewModel`,
  `esri/layers/support/LabelClass`,
  `esri/geometry/geometryEngine`,
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
      splide,
      captionsJSON;


    // DOM elements  
    const sliderDiv = document.getElementById(`sliderDiv`);
    const zoomInDiv = document.getElementById(`zoomIn`);
    const zoomOutDiv = document.getElementById(`zoomOut`);
    const featureCountDiv = document.getElementById(`excavationNumber`);
    const invertCountDiv = document.getElementById(`invertCount`);
    const vertCountDiv = document.getElementById(`vertCount`);
    const drawSvg = document.getElementById(`drawPath`);
    const resetSvg = document.getElementById(`resetWidget`);
    const locationButton = document.getElementById('locationButton');
    const locationDiv = document.getElementById('location');
    const collectionButton = document.getElementById('collectionButton');
    const collectionDiv = document.getElementById('collection');
    const collectionCaption = document.getElementById('collectionButtonCaption');
    const locationCaption = document.getElementById('locationButtonCaption');
    const photoLegend = document.getElementsByClassName('photo-indicator')[0];
    const taxaGrid = document.getElementsByClassName('taxa__grid')[0];
    const timescaleDiv = document.getElementsByClassName('timescale__container')[0];
    const timescaleBar = document.getElementById('indicator');
    const infoCardDiv = document.getElementById('infoCard');
    const noInfoCardDiv = document.getElementById('noInfoCard');
    const collectionInfoDiv = document.getElementsByClassName('collection--info')[0];
    const collectionNullDiv = document.getElementsByClassName('collection--null')[0];
    const taxaInfoDiv = document.getElementsByClassName('taxa--info')[0];
    const taxaNullDiv = document.getElementsByClassName('taxa--null')[0];
    const uiTopLeftCollection = document.getElementsByClassName('ui-top-left');
    const instructionsContainer = document.getElementsByClassName('instructions__container')[0];
    const instructionsDiv = document.getElementsByClassName('instructions')[0];


        

  /* ==========================================================
      Initialize map
    ========================================================== */

    setUpMap();

    // Used to query feature service based on returned feature layer 
    // attribute name
    var regionsObject = {
      Neighborhoods: neighborhoodsLayer,
      Regions: regionsLayer,
      Counties: countiesLayer,
    };

    // Refresh map after period of inactivity
    var resetMapSetInterval = setInterval(resetButtonClickHandler, 90000);
    document.onclick = clearInterval(resetMapSetInterval);

    view.when(() => {
      setNavigationBounds();
    });

    // Stops panning of the map past a defined bounding box
    function setNavigationBounds() {
      var initialExtent = view.extent;
      view.watch(`stationary`, function (event) {
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
      Event handler functions
      ========================================================== */

    // Instructions pop-up animation

    document.onclick = function() {
      instructionsDiv.style.top = `150%`;
      setTimeout(()=> {
        instructionsContainer.style.display = 'none';
      }, 401);
    }

    // Add event listeners to custom widgets
    drawSvg.addEventListener(`click`, drawButtonClickHandler);
    resetSvg.addEventListener(`click`, resetButtonClickHandler);
    zoomInDiv.addEventListener(`click`, zoomInClickHandler);
    zoomOutDiv.addEventListener(`click`, zoomOutClickHandler);


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
      sketchViewModel.create(`polygon`, { mode: `freehand` });
    }

    // Click event for the Zoom widgets
    function zoomInClickHandler() {
      zoomViewModel.zoomIn();
    }
    function zoomOutClickHandler() {
      zoomViewModel.zoomOut();
    }

    // Click event to select feature from feature layers
    view.on(`click`, function (event) {
      selectFeaturesFromClick(event);
    });

    // Add selectLocalities function to creation of new Sketch
    sketchViewModel.on(`create`, function (event) {
      if (event.state === `complete`) {
        // This polygon will be used to query features that intersect it;
        selectLocalities(event.graphic);
      }
    });

      
    locationButton.addEventListener('click', () => {
      setFlex(collectionDiv, false);
      setFlex(locationDiv, true);
      setFlex(photoLegend, false);
      locationButton.classList.add('button--active');
      collectionButton.classList.remove('button--active');
      collectionCaption.classList.remove(`button__caption--active`);
      locationCaption.classList.add(`button__caption--active`);
      view.graphics.items[0].visible = false;
    })

    collectionButton.addEventListener('click', () => {
      setFlex(locationDiv, false);
      setFlex(collectionDiv, true); 
      locationButton.classList.remove('button--active');
      collectionButton.classList.add('button--active');
      collectionCaption.classList.add(`button__caption--active`);
      locationCaption.classList.remove(`button__caption--active`);
      if (splide) {
        const splideSlides = splide.Components.Elements.slides
        setFlex(photoLegend, true);
        view.graphics.items[0].visible = true;
        if (splideSlides[0].classList.contains('is-active')){
          // Move timescale at initial Splide slide
          const specimenID = splideSlides[0].getElementsByTagName('img')[0].id;
          const timeRange = returnTimeRange(specimenID)
          moveTimescale(timeRange);
        }
      }
    })

    /* ==========================================================
      Timescale functions
      ========================================================== */

      // Returns an array of ages sorted ascending from AgeRange
      function returnTimeRange(specimenID) {
        var ageRange, age;
        ageRange = captionsJSON[specimenID][`AgeRange`]
        age = captionsJSON[specimenID][`Age`]
        return [ageRange, age]
      }

      // Moves timescale indicator div based on age range array
      function moveTimescale(ageArray) {
        let ageRange, age, minAge, maxAge;
        [ageRange, age] = ageArray;
        ageRange = ageRange.split(` - `);
        const sortedAgeArray = ageRange.sort((a,b) => a-b);
        [minAge, maxAge] = sortedAgeArray;
        if (maxAge) {
          var fossilAgeRange = maxAge-minAge;
        } else {
          var fossiAgeRange = minAge;
        }
        
        const totalAge = 100;
        timescaleBar.style.right = `${(minAge/totalAge)*100}%`;    
        const timescaleWidth = timescaleDiv.clientWidth;
        const timeRatio = timescaleWidth/totalAge;
        timescaleBar.style.width = `${timeRatio*fossilAgeRange}px`;
      }

    /* ==========================================================
      Splide functions
      ========================================================== */
    function loadJSON(callback) {
      var xobj = new XMLHttpRequest();
      xobj.overrideMimeType(`application/json`);
      xobj.open(`GET`, `./static/captions.json`, true);
      xobj.onreadystatechange = function () {
        if (xobj.readyState == 4 && xobj.status == `200`) {
          callback(xobj.responseText);
        }
      };
      xobj.send(null);
    }

    function removeFileExtension(fileName) {
      return fileName.substr(0, fileName.lastIndexOf(`.`));
    }

    // Reformats html to remove photos/captions from splide slider div
    function resetSplide() {
      const splideTrack = document.getElementsByClassName(`splide__list`)[0];
      const splidePagination = document.getElementsByClassName(
        `splide__pagination`
      )[0];
      splideTrack.innerHTML = ``;
      if (splidePagination) {
        splidePagination.remove();
      }
    }

    loadJSON((json) => {
      captionsJSON = JSON.parse(json);
    });

    // returns a div with properly formatted captions from input photo filename
    function formatCaptions(attachment) {
      const attachmentName = removeFileExtension(attachment.name);
      const specimenCaption = document.createElement(`p`);
      const taxonCaption = document.createElement(`b`);
      const ageCaption = document.createElement(`p`);
      const descriptionCaption = document.createElement(`p`);
      const catNumber = attachmentName.replace(`_`, ` `).replace(`-`, `.`);
      const catNumberCaption = document.createTextNode(` (${catNumber})`);
      const captionsDiv = document.createElement(`div`);
      captionsDiv.classList.add(`splide__captions`);


      const attachmentRecord = captionsJSON[attachmentName];
      taxonCaption.innerHTML = attachmentRecord[`Taxon`];
      ageCaption.innerHTML = `${attachmentRecord[`AgeRange`]} ${attachmentRecord[`Age`]}`;
      descriptionCaption.innerHTML = attachmentRecord[`Description`];
    

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
      var img = document.createElement(`img`);
      var li = document.createElement(`li`);
      var splideList = document.getElementsByClassName(`splide__list`)[0];
      var captions = formatCaptions(attachment);

      // Format HTML for Splide carousel
      li.classList.add(`splide__slide`);
      li.classList.add(attachment.parentObjectId);
      img.id = attachment.name.split(`.`)[0];
      img.src = attachment.url;

      var newSlide = splideList.appendChild(li);
      var div = document.createElement(`div`);
      div.className = `splide__slide--imageContainer`;

      newSlide.appendChild(div).appendChild(img);
      newSlide.appendChild(captions);
    }

    // Mounts splide 
    function newSplide() {
      splide = new Splide(`.splide`, {
        lazyLoad: true,
      }).mount();
    }

    /* ==========================================================
      Functions to reset/initialize app
      ========================================================== */

    function hideDiv(div) {
      div.style.left = `-125%`;
    }

    function displayDiv(div) {
      div.style.display = `flex`;
      div.style.left = `0`;
    }

    function clearWidgets() {
      for (let container of uiTopLeftCollection) {
        container.style.left=`-100%`;
      }
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


    /* ==========================================================
      ClientFeatureLayer functions
      ========================================================== */

    // A clientFeatuerLayer is used to display intersecting regions
    // of a selecteed polygon, regardless of the zoom level of the
    // ma.

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
              `features have been removed`
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
                console.log(results.features.length, `features have been added.`);
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

    // Zooms to feature after it is selected
    function zoomToFeature(featureName, geometry) {
      const geometryOffset = -(geometry.extent.width / 2);
      const goToOptions = {
        animate: true,
        duration: 600,
        ease: `ease-in-out`
      }

      if (featureName === `Los Angeles`) {
        view
          .goTo({
            center: [-118.735491, 34.222515],
            zoom: 8
          }, goToOptions)
          .catch(function (error) {
            if (error.name != `AbortError`) {
              console.error(error);
            }
          }, goToOptions);
      } else if (featureName == `Ventura`) {
        view
          .goTo({
            center: [-119.254898, 34.515522],
            zoom: 8,
          }, goToOptions)
          .catch(function (error) {
            if (error.name != `AbortError`) {
              console.error(error);
            }
          });
      } else {
        view
          .goTo(geometry.extent.expand(2).offset(geometryOffset, 0), goToOptions)
          .catch(function (error) {
            if (error.name != `AbortError`) {
              console.error(error);
            }
          });
      }
    }

    // Formats json representation of taxa from aggregated intersected
    // localities
    function formatTaxa(taxa) {
      const taxaList = taxa.map(taxon => JSON.parse(taxon));

      var combinedTaxaObject = {};

      for (var i=0; i< taxaList.length; i++) {
        Object.keys(taxaList[i]).map(taxon =>{
          var locTaxa = taxaList[i];
          if (taxon == 'Insects' || taxon == 'Hydrozoa') {
            //pass
          } else {
            if (combinedTaxaObject[taxon]) {
              combinedTaxaObject[taxon] += locTaxa[taxon];
            } else {
              combinedTaxaObject[taxon] = locTaxa[taxon];
            }
          }

        })
      }
      return combinedTaxaObject
      }  

    
    // Formats each call in taxa grid with a taxon
    function formatTaxaCell(taxonName, taxonNumber) {
      if (taxonName === `Clams, oysters, ect.`) {
        taxonName = `Clams, oysters`;
      } else if (taxonName === `Ammonoids, nautiloids`) {
        taxonName = `Nautiloids`;
      }
      var cell = document.createElement(`div`);
      var taxaIcon = document.createElement(`div`);
      var taxonDiv = document.createElement(`p`);
      cell.classList.add('taxa__cell');
      taxaIcon.classList.add('taxa__icon');
      taxonDiv.innerHTML = `${taxonNumber.toString()} ${taxonName}`;
      cell.append(taxaIcon, taxonDiv);
      taxaGrid.append(cell);
    }

    // Displays info cards after intersecting localities have been queried
    function populateInfoCards(returnedLocalities, polygonName) {
      taxaGrid.innerHTML=``;
      // Get counts of Invert/Vert localities based on Category field of 'attributes' property of selected locality records
      const objectIds = returnedLocalities.map(
        (loc) => loc[`attributes`][`OBJECTID`]
      );
      const fossilsFound = returnedLocalities.length;
      
      // Set name of feature name to all title divs
      for (let div of document.getElementsByClassName('featureName')) {
        div.innerText = polygonName;
      }

      // Display/hide divs based on fossils returned from query
      if (fossilsFound > 0) {
        setTimeout
        hideDiv(noInfoCardDiv);
        displayDiv(infoCardDiv);
        const taxa = (returnedLocalities.map(
          loc => loc[`attributes`][`taxa`])).filter(taxa => !(taxa=='')
        );
        
        if (taxa.length !== 0) {
          setFlex(taxaNullDiv, false);
          setFlex(taxaInfoDiv, true);
          const formattedTaxa = formatTaxa(taxa);
          for (const taxon in formattedTaxa) {
            formatTaxaCell(taxon, formattedTaxa[taxon]);
          }
        } else {
          setFlex(taxaInfoDiv, false);
          setFlex(taxaNullDiv, true);

        }


        createSplideFromAttachments(localitiesLayer, objectIds);
        // Hide/Display other divs

        // Send info to div
        featureCountDiv.innerHTML = fossilsFound.toString() + ` excavation sites`;
        //setTimeout(() => (infoCard.style.height = `auto`), 301);
      } else {
        hideDiv(infoCard);
        displayDiv(noInfoCardDiv);
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
      ]
      // hitTest returns feature that intersects with tap/click, 
      // i.e. screenPoint
      view
        .hitTest(screenPoint, { include: includeLayers })
        .then(function (response) {
          var returnedFeature = response.results[0].graphic;
          if (response.results.length > 0) {
            const regionsQuery = {
              where: `name = '${returnedFeature.attributes.name}'`,
              returnGeometry: true,
              outFields: [`*`],
            };
            // Queries feature service of selected feature using 
            // the query object defined above as params
            regionsObject[returnedFeature.attributes.region_type]
              .queryFeatures(regionsQuery)
              .then(function (f) {
                var clickFeature = f.features[0];
                selectLocalities(clickFeature);
                displayIntersectingFeatures(clickFeature);
                const selectedFeatureGraphic = new Graphic({
                  geometry: clickFeature.geometry,
                  symbol: {
                    type: `simple-fill`,
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

    // Returns locality features that intersect with feature geometry
    function selectLocalities(feature) {
      if (feature.attributes) {
        var featureName = feature.attributes.name;
      } else {
        var featureName = `the area`;
      }
      // Results in faster query time if the polygon feature is simplified
      const geometry = geometryEngine.simplify(feature.geometry);
      zoomToFeature(featureName, geometry);
      const query = {
        geometry: geometry,
        spatialRelationship: `intersects`,
        outFields: [`*`],
        maxRecordCountFactor: 3,
      };
      // Queries localityLayer with query object defined above as params
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

    // Populates client feature layer with regions that intersect
    // the input (selected) region feature
    function displayIntersectingFeatures(feature) {
      const regionType = feature.layer.title;
      const query = {
        where: "parent_region = '" + feature.attributes.name + "'",
        returnGeometry: true,
        outFields: [`*`],
      };
      clientFeatureLayer.queryFeatures().then(function (results) {
        const removeFeatures = {
          deleteFeatures: results.features,
        };
        applyEditsToClientFeatureLayer(removeFeatures);
      });

      if (regionType == `Counties`) {
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
        document.getElementById(`attachmentCount`).innerText = attachmentList.length;
        if (attachmentList.length > 0) {
          setFlex(collectionInfoDiv, true);
          setFlex(collectionNullDiv, false);

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
          splide.on(`active`, function (slide) {
            const slideObjectId = slide.slide.classList[1];
            createPointGraphicAtObjectId(slideObjectId);
            //const slideAgeRangeText = slide.slide.lastElementChild.children[0].innerText;
            const slideImg = slide.slide.getElementsByTagName('img')[0];
            const specimenID = slideImg.id;
            const timeRange = returnTimeRange(specimenID);
            moveTimescale(timeRange);


          });
        } else {
          collectionNullDiv.style.display = 'block';
          setFlex(collectionInfoDiv, false);
          setFlex(photoLegend, false);
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
          type: `point`, // autocasts as new Point()
          longitude: attachment.features[0].geometry.longitude,
          latitude: attachment.features[0].geometry.latitude,
        };
        // Create graphic around record currntly being displayed in Splide carousel
        const selectedGraphic = new Graphic({
          geometry: visibleAttachmentGeometry,
          symbol: {
            type: `simple-marker`,
            style: `circle`,
            color: `orange`,
            size: `12px`, // pixels
            outline: {
              // autocasts as new SimpleLineSymbol()
              color: [255, 255, 0],
              width: 2, // points
            },
          },
        });
        view.graphics.removeAll();
        view.graphics.add(selectedGraphic);
        if (locationButton.classList.contains('button--active')) {
          view.graphics.items[0].visible = false;
        }   
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
                id: `c65f3f7dc5754366b4e515e73e2f7d8b`, // Custom LAU Basemap
              },
            }),
          ],
        });
    
        map = new Map({
          basemap: basemap,
        });
    
        view = new MapView({
          container: `viewDiv`,
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
            type: `simple-fill`,
            color: [0, 185, 235, 0.2],
            size: `1px`,
            outline: {
              color: [0, 185, 235, 0.5],
              width: `3px`,
            },
          },
        });
    
        zoomViewModel = new ZoomViewModel({
          view: view,
        });
    
        // Configure widget icons
        drawWidget.addEventListener(
          `click`,
          function (event) {
            event.preventDefault;
            drawSvg.classList.remove(`draw-widget__animation`);
            drawWidget.offsetWidth;
            drawSvg.classList.add(`draw-widget__animation`);
          },
          false
        );
    
        var resetSvg = document.getElementById("resetSvg");
    
        resetWidget.addEventListener(
          `click`,
          function (event) {
            event.preventDefault;
            resetSvg.classList.remove(`reset-widget__animation`);
            resetWidget.offsetWidth;
            resetSvg.classList.add(`reset-widget__animation`);
          },
          false
        );
    
        // Create renderers, LabelClasses and FeatureLayers
        const localitiesRenderer = {
          type: `simple`,
          symbol: {
            type: `simple-marker`,
            size: 6,
            color: [20, 204, 180, 0.5],
            outline: {
              width: 0,
              color: [247, 247, 247, 0.5],
            },
          },
        };
    
        const heatmapRenderer = {
          type: `heatmap`,
          colorStops: [
            { color: `rgba(63, 40, 102, 0)`, ratio: 0 },
    
            { color: `#5d32a8`, ratio: 0.332 },
    
            { color: `#a46fbf`, ratio: 0.747 },
            { color: `#c29f80`, ratio: 0.83 },
            { color: `#e0cf40`, ratio: 0.913 },
            { color: `#ffff00`, ratio: 1 }
          ],
          maxPixelIntensity: 25,
          minPixelIntensity: 0
        };
        
    
        const polygonFeatureRenderer = {
          type: `simple`,
          symbol: {
            type: `simple-fill`,
            style: `none`,
            outline: {
              color: [128, 128, 128, 0.5],
              width: `1.5px`,
            },
          },
        };
    
        const countiesLabelClass = new LabelClass({
          labelExpressionInfo: { expression: `$feature.NAME` },
          symbol: {
            type: `text`, // autocasts as new TextSymbol()
            color: `rgb(40, 40, 40)`,
            haloSize: 0.5,
            haloColor: `white`,
            font: {
              // autocast as new Font()
              family: `Avenir Next LT Pro Regular`,
              weight: `bold`,
              size: 13,
            },
          },
        });
    
        const regionsLabelClass = new LabelClass({
          labelExpressionInfo: { expression: `$feature.NAME` },
          symbol: {
            type: `text`, // autocasts as new TextSymbol()
            color: `rgb(40, 40, 40)`,
            haloSize: 0.5,
            haloColor: `white`,
            deconflictionStrategy: `static`,
            font: {
              // autocast as new Font()
              family: `Avenir Next LT Pro Regular`,
              weight: `normal`,
              size: 9.5,
            },
          },
        });
    
        const areasLabelClass = new LabelClass({
          labelExpressionInfo: {
            expression: "Replace(Trim($feature.name), ' ', TextFormatting.NewLine)",
          },
          symbol: {
            type: `text`, // autocasts as new TextSymbol()
            color: `rgb(40, 40, 40)`,
            haloSize: 0.5,
            haloColor: `white`,
            deconflictionStrategy: `static`,
            font: {
              // autocast as new Font()
              family: `Avenir Next LT Pro Regular`,
              weight: `bold`,
              size: 9.5,
            },
          },
        });
    
        var countiesMaxScale = 1155581;
        var regionsMaxScale = 288895;
        var neighborhoodsMinScale = 144448;
    
        clientFeatureLayer = new FeatureLayer({
          title: `Areas`,
          spatialReference: {
            wkid: 4326,
          },
          fields: [
            {
              name: `region_type`,
              alias: `Region Type`,
              type: `string`,
            },
            {
              name: `objectId`,
              alias: `ObjectId`,
              type: `oid`,
            },
            {
              name: `name`,
              alias: `Name`,
              type: `string`,
            },
            {
              name: `legacyId`,
              alias: `Legacy object ID`,
              type: `string`,
            },
          ],
          objectIdField: `objectId`,
          geometryType: `polygon`,
          outFields: [`*`],
          source: [],
          renderer: polygonFeatureRenderer,
          labelingInfo: [areasLabelClass],
        });
    
        // Define feature layers and add to map

        localitiesLayer = new FeatureLayer({
          url:
            `https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/LAU_Localities_View/FeatureServer`,
          renderer: localitiesRenderer,
        });
    
        countiesLayer = new FeatureLayer({
          url:
            `https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Counties_View/FeatureServer`,
          maxScale: countiesMaxScale,
          labelingInfo: [countiesLabelClass],
          renderer: polygonFeatureRenderer,
          title: `Counties`,
          outFields: [`*`],
        });
    
        regionsLayer = new FeatureLayer({
          url:
            `https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Regions_(v2)_View/FeatureServer`,
          minScale: countiesMaxScale,
          maxScale: regionsMaxScale,
          labelingInfo: [regionsLabelClass],
          renderer: polygonFeatureRenderer,
          title: `Regions`,
          outFields: [`*`],
        });
    
        neighborhoodsLayer = new FeatureLayer({
          url:
            `https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Neighborhoods_View/FeatureServer`,
          minScale: neighborhoodsMinScale,
          labelingInfo: [regionsLabelClass],
          renderer: polygonFeatureRenderer,
          title: `Neighborhoods`,
          outFields: [`*`],
        });
    
        map.addMany([
          neighborhoodsLayer,
          regionsLayer,
          countiesLayer,
          clientFeatureLayer,
          localitiesLayer,
        ]);
    
        // Make widgets visible to map view
        for (let widget of document.getElementsByClassName(`widget`)) {
          widget.style.opacity = `1`;
        }
    
        // Add ui elements to map view
        var ui = document.getElementsByClassName('ui-container');
        for (let e of ui) {
          view.ui.add(e);
        }
      
        // Set localityLayerView to layerView when localities are selected (for highlight)
        view.whenLayerView(localitiesLayer).then(function (layerView) {
          localityLayerView = layerView;
        });

        // Stops loading animation and makes map view visible after 
        // localityLayerView has finished loading
        /*
        setTimeout(()=> {
          localityLayerView.when(function() {
            setVisible('#loading', false);
            document.getElementById('viewDiv').style.opacity = '1';
            instructionsDiv.style.opacity = '1';          
          }).catch(function(error){
            console.log("error: ", error);
          });
        }, 2000)
        */
      }
});



// Applies styling to splide arrows
let splideArrows = document.getElementsByClassName('splide__arrow');
for (let arrow of splideArrows) {
  arrow.classList.add('hvr-grow-shadow--arrow');
}