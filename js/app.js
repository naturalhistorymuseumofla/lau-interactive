
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
  "esri/views/layers/support/FeatureEffect",
  "esri/layers/ImageryLayer"
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
        splide,
        query;
    
    // Get DOM elements 
    var infoDiv = document.getElementById("infoDiv");
    var sliderDiv = document.getElementById("sliderDiv");
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
      featureName = "";
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
     Splide functions
    ========================================================== */
    function loadJSON(callback) {   
      var xobj = new XMLHttpRequest();
          xobj.overrideMimeType("application/json");
      xobj.open('GET', 'captions.json', true); 
      xobj.onreadystatechange = function () {
            if (xobj.readyState == 4 && xobj.status == "200") {
              callback(xobj.responseText);
            }
      }
      xobj.send(null);  
    }


    function removeFileExtension(fileName) {
      return fileName.substr(0, fileName.lastIndexOf("."))
    }

    // Reformats html to remove photos/captions from splide
    function resetSplide() {
      sliderDiv.innerHTML="";
      let splideTrack = document.createElement("div");
      let splideList = document.createElement("ul");
      let header = document.createElement("h1");
      header.innerHTML="Swipe to see local fossils"
      sliderDiv.appendChild(header);
      sliderDiv.appendChild(splideTrack);
      splideTrack.appendChild(splideList);
      splideTrack.classList.add("splide__track");
      splideList.classList.add("splide__list");
    };

    // returns a div with properly formatted captions from input photo filename
    function formatCaptions(attachment) {
      var attachmentName = removeFileExtension(attachment.name);
      var taxonCaption = document.createElement("b");
      var ageCaption = document.createElement("p");
      var descriptionCaption = document.createElement("p")
      var catNumber = attachmentName.replace("_", " ").replace("-", ".");
      var catNumberCaption = document.createTextNode(` (${catNumber})`);
      var captionsDiv = document.createElement("div");

      loadJSON(json => {
        var captionsJSON = JSON.parse(json);
        var attachmentRecord = captionsJSON[attachmentName];
        taxonCaption.innerHTML = attachmentRecord["Taxon"];
        ageCaption.innerHTML = attachmentRecord["Age"];
        descriptionCaption.innerHTML = attachmentRecord["Description"]
      });

      captionsDiv.append(taxonCaption, catNumberCaption, ageCaption, descriptionCaption);
      return captionsDiv;
    }

    // Adds attachment photo to splide carousel after formatting splide 
    function addPhotoToSplide(attachment) {
      var img = document.createElement("img");
      var li = document.createElement("li");
      var splideList = document.getElementsByClassName("splide__list")[0];

      var captions = formatCaptions(attachment)

      // Format HTML for Splide carousel
      li.classList.add("splide__slide")
      li.classList.add(attachment.parentObjectId)
      img.src = attachment.url

      var newSlide = splideList.appendChild(li);
      var div = document.createElement("div");
      div.className = "splide__slide--imageContainer";

      newSlide.appendChild(div).appendChild(img);
      newSlide.appendChild(captions);
    }


    function newSplide() {
      splide = new Splide('.splide',{
        lazyLoad: true
      }).mount();
    } 


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
          console.log(response.results)
          var clickFeatureGeometry;
          if (response.results[0].graphic.layer.title === "Counties") {
            var hitQuery = {
              objectIds: response.results[0].graphic.attributes["OBJECTID_1"],
              returnGeometry: true,
              outFields: ["*"]
            }
            countiesLayer.queryFeatures(hitQuery).then(function(results){
              console.log(results.features[0])
              var clickFeature = results.features[0]
              featureName = clickFeature.attributes["name"]
              clickFeatureGeometry = results.features[0].geometry
              selectFeatures(clickFeature);
              displayIntersectionFeatures(clickFeature);
            })
          } else {
            var clickFeature = response.results[0].graphic;
            featureName = clickFeature.attributes["name"]
            clickFeatureGeometry = results.features[0].geometry
            selectFeatures(clickFeature);
            displayIntersectionFeatures(clickFeature);
          }
  
          const selectedFeatureGraphic = new Graphic({
            geometry: clickFeatureGeometry.geometry,
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
      var geometry = geometryEngine.simplify(polygon.geometry);
      query.geometry = geometry;
      query.spatialRelationship = "intersects";
      query.outFields = ["*"];

      localitiesLayer.queryFeatures(query).then(function(results) {
        var queriedLocalities = results.features;
        console.log(results)
        
        // Get counts of Invert/Vert localities based on Category field of 'attributes' property of selected locality records
        var objectIds = queriedLocalities.map(loc => loc["attributes"]["OBJECTID"])
        var invertCount = queriedLocalities.filter(loc => loc["attributes"]["category"] == "Invertebrate").length;
        var vertCount = queriedLocalities.filter(loc => loc["attributes"]["category"] == "Vertebrate").length;
        var taxa = (queriedLocalities.map(loc => loc["attributes"]["taxa"])).filter(taxa => !(taxa==''));

        var geometryOffset = -(geometry.extent.width/2)

        if (featureName === "Los Angeles"){
          view.goTo({  
            center: [-118.735491, 34.222515],
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
          createSplideFromAttachments(localitiesLayer, objectIds);
          if (noFossilsInfo.style.display === "block") {
            hideDiv(infoDiv);
            setTimeout(() => {
              noFossilsInfo.style.display = "none";
              displayDiv(taxaInfo);
              displayDiv(infoDiv);
              
              
            }, 500);
          } else {
            displayDiv(taxaInfo);
            displayDiv(infoDiv);
          }
          // Send info to div
          var fossilsFound = queriedLocalities.length;
          if (featureName) {
            document.getElementById("featureCount").innerHTML = fossilsFound.toString();
            if (fossilsFound === 1){ 
              document.getElementById("featureText").innerHTML = " fossil site in </br>" + featureName + "!";
            } else {
              document.getElementById("featureText").innerHTML = " fossil sites in </br>" + featureName + "!";
            }
          } else {
            document.getElementById("featureCount").innerHTML = fossilsFound.toString();
            if (fossilsFound === 1){
              document.getElementById("featureText").innerHTML = " fossil site in </br> in the area!";
            } else {
              document.getElementById("featureText").innerHTML = " fossil sites in </br> in the area!";
            }
            
          }

          invertCountDiv.innerHTML = invertCount + " invertebrates"
          vertCountDiv.innerHTML = vertCount + " vertebrates"
          
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
      
      var attachmentList; 
      var attachmentQuery = new AttachmentQuery({
        objectIds: ids
      });
      layer.queryAttachments(attachmentQuery).then(function(attachments){

        attachmentList = Object.values(attachments).map(attachment => attachment[0]);

        if (attachmentList.length > 0) {
          if (splide){
            resetSplide();
          }

          // Retrieve list of urls of attached images from selected localities
          attachmentList.forEach(attachment => {
            addPhotoToSplide(attachment);
          });
          // Create new Splide image slider and set container div to visible
          var slidePagination = document.getElementById("slidePagination");
          if (slidePagination) {
            slidePagination.remove();
          }
          newSplide();
          displayDiv(sliderDiv);


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
      localityLayerView.queryFeatures(highlightQuery).then(function(attachment){
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
              id: "c65f3f7dc5754366b4e515e73e2f7d8b" // Custom LAU Basemap
             },
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
          color: "rgb(40, 40, 40)",
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
          color: "rgb(40, 40, 40)",
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

      const areasLabelClass = new LabelClass({
        labelExpressionInfo: { expression: "Replace(Trim($feature.name), ' ', TextFormatting.NewLine)"  },
        symbol: {
          type: "text",  // autocasts as new TextSymbol()
          color: "rgb(40, 40, 40)",
          haloSize: 0.5,
          haloColor: "white",
          deconflictionStrategy: "static",
          font: {  // autocast as new Font()
            family: "Avenir Next LT Pro Regular",
            weight: "bold",
            size: 9.5
          }
        }
      });

      var countiesMaxScale = 1155581;
      var regionsMaxScale = 288895;
      var neighborhoodsMinScale = 144448;

      clientFeatureLayer = new FeatureLayer({
        title: "Areas",
        spatialReference: {
          wkid: 4326
        },
        fields: [
          {
            name: "objectId",
            alias: "ObjectId",
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
        objectIdField: "objectId",
        geometryType: "polygon",
        source: [],
        renderer: polygonFeatureRenderer,
        labelingInfo: [areasLabelClass]
      });



      localitiesLayer = new FeatureLayer({
        url:
        "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/LAU_Localities_View/FeatureServer",
        renderer: localitiesRenderer
      });

      query = localitiesLayer.createQuery();

      countiesLayer = new FeatureLayer({
        url:
        "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Counties_View/FeatureServer",
        maxScale: countiesMaxScale,
        labelingInfo: [countiesLabelClass],
        renderer: polygonFeatureRenderer,
        title: "Counties"
      });

      regionsLayer = new FeatureLayer({
        url:
        "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Regions_(v2)_View/FeatureServer",
        minScale: countiesMaxScale,
        maxScale: regionsMaxScale,
        labelingInfo: [regionsLabelClass],
        renderer: polygonFeatureRenderer,
        title: "Regions"
      });

      neighborhoodsLayer = new FeatureLayer({
        url:
        "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Neighborhoods_View/FeatureServer",
        minScale: neighborhoodsMinScale,
        labelingInfo: [regionsLabelClass],
        renderer: polygonFeatureRenderer,
        title: "Neighborhoods"
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
      view.ui.add("select-by-polygon", "top-right");
      view.ui.add("return-to-extent", "top-right");
      view.ui.add(zoomDiv, "bottom-right");
      view.ui.add("widgetContainer", "top-left");
   
      // Set localityLayerView to layerView when localities are selected (for highlight)
      view.whenLayerView(localitiesLayer).then(function (layerView) {
        localityLayerView = layerView;
      })
    }
});
