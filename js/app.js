
import { resetSplide, formatHTMLForSplide, newSplide, splide } from "../js/splideFunctions.js";

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
  "esri/geometry/geometryEngine"
  ], function (Map,
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
               ){
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
        splideHighlight,
        featureName,
        query;
    
    // Get DOM elements 
    var infoDiv = document.getElementById("infoDiv");
    var sliderDiv = document.getElementById("sliderDiv");
    var noFossilsDiv = document.getElementById("noFossilsDiv");
    var zoomDiv = document.getElementById("zoomDiv");
    var zoomInDiv = document.getElementById("zoom-in");
    var zoomOutDiv = document.getElementById("zoom-out");
    var featureCountDiv = document.getElementById("featureCount");
    var invertCountDiv = document.getElementById("invertCount");
    var vertCountDiv = document.getElementById("vertCount");
    var noFossilsInfo = document.getElementById("noFossilsInfo");
    var taxaInfo = document.getElementById("taxaInfo");

    /* ==========================================================
     Initialize map
    ========================================================== */


    setUpMap();

    var resetMapSetInterval = setInterval(resetButtonClickHandler, 90000);
    document.onclick = clearInterval(resetMapSetInterval)

    // Add event listeners to custom widgets
    document.getElementById("select-by-polygon").addEventListener("click", polygonButtonClickHandler);
    document.getElementById("return-to-extent").addEventListener("click", resetButtonClickHandler);
    zoomInDiv.addEventListener("click", zoomInClickHandler);
    zoomOutDiv.addEventListener("click", zoomOutClickHandler)
     
    view.when(function() {
      setNavigationBounds();
      }
    )

    function setNavigationBounds() {
      var initialExtent = view.extent;
      view.watch('stationary', function(event) {
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

    // Event handler for reset widget
    function resetButtonClickHandler() {
      sketchViewModel.cancel();
      view.goTo({center:[-118.248638, 34.062660], zoom:8});
      if (highlight) {
        highlight.remove()
      }
      if (polygonHighlight) {
        polygonHighlight.remove();
      }
      resetClientFeatureLayer();
      clearGraphics();
      clearWidgets();
    }

    // Click event for the SketchViewModel widget
    function polygonButtonClickHandler() {
      if (polygonHighlight) {
        polygonHighlight.remove();
      }
      hideDiv(noFossilsDiv)
      featureName = ""
      clearGraphics();
      sketchViewModel.create("polygon", {mode: "freehand"});
    }

    // Click event for the Zoom widgets
    function zoomInClickHandler() {
      zoomViewModel.zoomIn();
    }
    function zoomOutClickHandler() {
      zoomViewModel.zoomOut();
    }

    // Click event to select feature from feature layers
    view.on("click", function(event) {
      selectFeaturesFromClick(event);
    });

    // Add selectFeatures function to creation of new Sketch
    sketchViewModel.on("create", function (event){
      if (event.state === "complete") {
        // This polygon will be used to query features that intersect it;
        selectFeatures(event.graphic);
      }
    });

    /* ==========================================================
     Functions to reset/initialize app
    ========================================================== */
    
    function hideDiv(div) {
      div.style.marginLeft="-1000px"
    }

    function displayDiv(div) {
      div.style.display="block";
      div.style.marginLeft="0px"
    }
    
    function clearWidgets() {
      hideDiv(sliderDiv);
      hideDiv(infoDiv);
      hideDiv(noFossilsDiv);
    }

    function resetInfoDiv() {
      featureCountDiv.innerHTML = "";
      invertCountDiv.innerHTML = "";
      vertCountDiv.innerHTML = "";
    }

    function clearGraphics() {
      sketchGraphicsLayer.removeAll();
      selectedFeatureGraphicLayer.removeAll();
      view.graphics.removeAll()
    }

    // Functions to create/update clientFeatureLayer
    function resetClientFeatureLayer() {
      clientFeatureLayer.queryFeatures().then(function(results){
        const removeFeatures = {
          deleteFeatures: results.features
        };
        applyEditsToClientFeatureLayer(removeFeatures);
      });
    }

    function addEdits(results) {
      var graphics = [];
      results.features.forEach(function(feature){
        var graphic = new Graphic({
          geometry: feature.geometry,
          attributes: feature.attributes
        });
        graphics.push(graphic)
      })
      const edits = {
        addFeatures: graphics
      }; 
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
                objectIds: objectIds
              })
              .then(function (results) {
                console.log(
                  results.features.length,
                  "features have been added."
                );
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

    // Select feature from feature layer after click event
    function selectFeaturesFromClick(screenPoint) {
      clearGraphics();
      var includeLayers = [countiesLayer, neighborhoodsLayer, regionsLayer, clientFeatureLayer]
      view.hitTest(screenPoint, {include: includeLayers}).then(function(response) {
        if (response.results.length > 0) {
          var clickFeature = response.results[0].graphic;
          featureName = clickFeature.attributes["name"]
          selectFeatures(clickFeature);
          displayIntersectionFeatures(clickFeature);
  
          const selectedFeatureGraphic = new Graphic({
            geometry: clickFeature.geometry,
            symbol: {
              type: "simple-fill",
              color: [0, 185, 235, 0.2],
              outline: {
                // autocasts as new SimpleLineSymbol()
                color: [0, 185, 235, 1],
                width: 4 // points
              }
            }
          });

          selectedFeatureGraphicLayer.graphics.removeAll();
          selectedFeatureGraphicLayer.graphics.add(selectedFeatureGraphic);   
        } else {
          resetButtonClickHandler();
        }
      });
    }
    
    // Selects locality features from geometry
    function selectFeatures(polygon) {

      var geometry = geometryEngine.simplify(polygon.geometry, 1000);

      // Clear old text from infoDiv

      resetSplide();


      query.geometry = geometry;
      query.spatialRelationship = "intersects";
      query.outFields = ["*"];
      query.returnGeometry = true;

      localitiesLayer.queryFeatures(query).then(function(results) {
        var queriedLocalities = results.features;
        
        // Get counts of Invert/Vert localities based on Category field of 'attributes' property of selected locality records
        var objectIds = queriedLocalities.map(loc => loc["attributes"]["OBJECTID"])
        var invertCount = queriedLocalities.filter(loc => loc["attributes"]["category"] == "Invertebrate").length;
        var vertCount = queriedLocalities.filter(loc => loc["attributes"]["category"] == "Vertebrate").length;
        var taxa = (queriedLocalities.map(loc => loc["attributes"]["taxa"])).filter(taxa => !(taxa==''));

        // Function to get attachments and display splide
        createSplideFromAttachments(localitiesLayer, objectIds)

        var geometryOffset = -(geometry.extent.width/2)

        if (featureName === "Los Angeles"){
          view.goTo({
             
            center: [-118.737708, 33.925803],
            zoom: 8
          })
          .catch(function(error){
            if (error.name != "AbortError") {
              console.error(error);
            }
          })
        } else if (featureName == "Ventura") {
          view.goTo({
            center: [-119.254898, 34.515522],
            zoom: 8
          })

        .catch(function(error){
          if (error.name != "AbortError") {
            console.error(error);
          }
        })
        } else {
          view.goTo(geometry.extent.expand(2).offset(geometryOffset,0)).catch(function(error){
            if (error.name != "AbortError") {
              console.error(error);
            }
          })
        }

        // If records are returned from locality query
        if (queriedLocalities.length > 0) {
          noFossilsInfo.style.display = "none";
          displayDiv(taxaInfo);
          displayDiv(infoDiv);
          // Send info to div
          var fossilsFound = queriedLocalities.length.toString();
          if (featureName) {
            document.getElementById("featureCount").innerHTML = fossilsFound;
            document.getElementById("featureText").innerHTML = " fossils found in </br>" + featureName + "!";
          } else {
            document.getElementById("featureCount").innerHTML = fossilsFound;
            document.getElementById("featureText").innerHTML = " fossils found in </br> in the area!";
          }

          invertCountDiv.innerHTML = invertCount + " invertebrates"
          vertCountDiv.innerHTML = vertCount + " vertebrates"
          
        } else {
          taxaInfo.style.display = "none";
          displayDiv(noFossilsInfo);
        }

        // Remove exisiting highlighted features
        if (highlight) {
          highlight.remove();
        }
        // Highlight query results
        highlight = localityLayerView.highlight(queriedLocalities) 
        
      }).catch(function(error){
        console.log(error);
      });
    }


    function displayIntersectionFeatures(feature) {
      var regionType = feature.layer.title;

      var query = {
        where: "parent_region = '" + featureName + "'",
        returnGeometry: true
      }
  
      clientFeatureLayer.queryFeatures().then(function(results){
        const removeFeatures = {
          deleteFeatures: results.features
        };
        applyEditsToClientFeatureLayer(removeFeatures);
      });
  
      if (regionType == "Counties") {
        regionsLayer.queryFeatures(query).then(function(results){
          addEdits(results);
        });
      } else {
        neighborhoodsLayer.queryFeatures(query).then(function(results){
          addEdits(results);
        });
      }
    }

    /* ==========================================================
     Functions that create image carousel 
    ========================================================== */

    // Create Splide image carousel from object IDs 
    function createSplideFromAttachments(layer, ids) {
      resetSplide();
      var attachmentList;
      // Query to retrieve attachments  
      var attachmentQuery = new AttachmentQuery({
        objectIds: ids
      });
      layer.queryAttachments(attachmentQuery).then(function(attachments){
        attachmentList = Object.values(attachments).map(attachment => attachment[0]);

      // Retrieve list of urls of attached images from selected localities
      attachmentList.forEach(attachment => {
        formatHTMLForSplide(attachment);
      });

      // Create new Splide image slider and set container div to visible
      var slidePagination = document.getElementById("slidePagination");
      if (slidePagination) {
        slidePagination.remove();
      }

      if (attachmentList.length > 0) {
        displayDiv(sliderDiv);
        newSplide();

        // Create graphic at initial Splide slide
        createPointGraphicAtObjectId(attachmentList[0].parentObjectId);
        
        // Splide event listener
        splide.on('active', function(slide) {
          if (splideHighlight) {
            splideHighlight.remove();
          }
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
        outFields: ["*"]
      };
      localitiesLayer.queryFeatures(highlightQuery).then(function(attachment){
        var visibleAttachmentGeometry = {
          type: "point",  // autocasts as new Point()
          longitude: attachment.features[0].attributes.longitude,
          latitude: attachment.features[0].attributes.latitude
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
              width: 2 // points
            }
          }
        });
        view.graphics.removeAll()
        view.graphics.add(selectedGraphic);   
      })
    };

      /* ==========================================================
    Function to set up the view, map and add widgets & layers
    ========================================================== */

    function setUpMap () {
      // Create new Basemap
      var basemap = new Basemap({
        baseLayers: [
        new VectorTileLayer({
          portalItem: {
            id: "c65f3f7dc5754366b4e515e73e2f7d8b" // Modified Grey Basemap
            }
          })
        ]
      });

      map = new Map({
        basemap: basemap,
      });

      view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-118.248638, 34.062660], // longitude, latitude ,
        zoom: 8,
        constraints: {
          snapToZoom: true,
          rotationEnabled: false,
          minZoom: 7
        },
        popup: {
          autoOpenEnabled: false
        },
        highlightOptions: {
          color: [0, 185, 235, .75],
          fillOpacity: 0.4
        },
        ui : {
          components: []
        }
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
            width: "3px"
          }
        }
      });

      zoomViewModel = new ZoomViewModel({
        view: view
      });
      
      // Configure widget icons 
      var drawContainer = document.getElementById("select-by-polygon");
      var drawSvg = document.getElementById("brush-path");

      drawContainer.addEventListener("click", function(event) {
        event.preventDefault;
        drawSvg.classList.remove("draw-animation");
        drawContainer.offsetWidth;
        drawSvg.classList.add("draw-animation");
      }, false);

      var resetContainer = document.getElementById("return-to-extent");
      var resetSvg = document.getElementById("reset-widget")

      resetContainer.addEventListener("click", function(event) {
        event.preventDefault;
        resetSvg.classList.remove("reset-animation");
        resetContainer.offsetWidth;
        resetSvg.classList.add("reset-animation");         
      }, false)

      // Create renderers, LabelClasses and FeatureLayers 
      const localitiesRenderer = {
        type: "simple",
        symbol: {
          type: "simple-marker",
          size: 6,
          color: [20, 204, 180, 0.5],
          outline: {
              width: 0.5,
              color: [247, 247, 247, 0.5]
          }
        }
      };

      const polygonFeatureRenderer = {
        type: "simple",
        symbol: {
          type: "simple-fill",
          style: "none",
          outline : {
            color: [128, 128, 128, 0.5],
            width: "1.5px"
          }
        }
      }  

      const countiesLabelClass = new LabelClass({
        labelExpressionInfo: { expression: "$feature.NAME" },
        symbol: {
          type: "text",  // autocasts as new TextSymbol()
          color: "black",
          haloSize: 0.5,
          haloColor: "white",
          font: {  // autocast as new Font()
            family: "Avenir Next LT Pro Regular",
            weight: "bold",
            size: 13
          }
        }
      });

      const regionsLabelClass = new LabelClass({
        labelExpressionInfo: { expression: "$feature.NAME" },
        symbol: {
          type: "text",  // autocasts as new TextSymbol()
          color: "black",
          haloSize: 0.5,
          haloColor: "white",
          deconflictionStrategy: "static",
          font: {  // autocast as new Font()
            family: "Avenir Next LT Pro Regular",
            weight: "normal",
            size: 9.5
          }
        }
      });

      const clientLabelClass = new LabelClass({
        labelExpressionInfo: { expression: "$feature.NAME" },
        symbol: {
          type: "text",  // autocasts as new TextSymbol()
          color: "black",
          haloSize: 0.5,
          haloColor: "white",
          deconflictionStrategy: "static",
          font: {  // autocast as new Font()
            family: "Avenir Next LT Pro Regular",
            weight: "bold",
            size: 9
          }
        }
      });

      var countiesMaxScale = 1155581;
      var regionsMaxScale = 288895;
      var neighborhoodsMinScale = 144448;

      clientFeatureLayer = new FeatureLayer({
        title: "Areas",
        fields: [
          {
            name: "objectId",
            alias: "ObjectID",
            type: "oid"
          },
          {
            name: "name",
            alias: "Name",
            type: "string"
          },
          {
            name: "type",
            alias: "Type",
            type: "string"
          },
          {
            name: "region_type",
            alias: "Region Type",
            type: "string"
          }
        ],
        objectIdField: "ObjectID",
        geometryType: "polygon",
        source: [],
        renderer: polygonFeatureRenderer,
        labelingInfo: [clientLabelClass]
      });

      localitiesLayer = new FeatureLayer({
        url:
        "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/LAU_Localities/FeatureServer",
        renderer: localitiesRenderer
      });

      query = localitiesLayer.createQuery();

      countiesLayer = new FeatureLayer({
        url:
        "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Counties_(v2)/FeatureServer",
        maxScale: countiesMaxScale,
        labelingInfo: [countiesLabelClass],
        renderer: polygonFeatureRenderer,
        title: "Counties"
      });

      regionsLayer = new FeatureLayer({
        url:
        "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_County_Subdivisions/FeatureServer",
        minScale: countiesMaxScale,
        maxScale: regionsMaxScale,
        labelingInfo: [regionsLabelClass],
        renderer: polygonFeatureRenderer,
        title: "Regions"
      });

      neighborhoodsLayer = new FeatureLayer({
        url:
        "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Neighborhoods/FeatureServer",
        minScale: neighborhoodsMinScale,
        labelingInfo: [regionsLabelClass],
        renderer: polygonFeatureRenderer,
        title: "Neighborhoods"
      });

      // Add all features layers to map
      map.addMany([neighborhoodsLayer, regionsLayer, countiesLayer, clientFeatureLayer, localitiesLayer])

      

      // Add widgets to view
      //view.ui.components = [];
      view.ui.add("select-by-polygon", "top-right");
      view.ui.add("return-to-extent", "top-right");
      view.ui.add(zoomDiv, "bottom-right");
      view.ui.add("widgetContainer", "top-left")
      /*
      view.ui.add(infoDiv, "top-left");
      view.ui.add(sliderDiv, "top-left");
      view.ui.add(noFossilsDiv, "top-left");
      */


   
      // Set localityLayerView to layerView when localities are selected (for highlight)
      view.whenLayerView(localitiesLayer).then(function (layerView) {
        localityLayerView = layerView;
      });

    }
});
