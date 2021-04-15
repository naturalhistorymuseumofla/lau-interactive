
const apiKey = 'AAPK1322a5a204a145f992aead082b199a80gh6YxgkpwAsAPEuvQ6WEq7MqqTP4MyCWShNiLG99f2Xz41GNx31zExD4SYeajGQv';

setUpMap();

function setUpMap() {
  const countiesMaxScale = 10;
  const neighborhoodsMinScale = 12;

  var map = L.map('mapid', {
    center: [34.06266,-118.248638],
    zoom: 9,
  });

  // Add Esri Basemap to map
  L.esri.basemapLayer('Oceans').addTo(map);

  // Create style renderer for feature layers
  const polygonStyle = {
    fill: false,
    color: '#808080',
    opacity: 0.5,
    weight: 1.75
  }

  // Create panes for feature layers
  map.createPane('areas');
  map.createPane('localities');
  map.getPane('localities').style.pointerEvents = 'none';

  // Retrieve vector tile layer of localities
  const localitiesVectorTile = L.esri.Vector.vectorTileLayer ('https://vectortileservices7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/LAU_Localities_View_Vector_Tile_Layer/VectorTileServer',{
    pane: 'localities'
  });

  // Retrieve all esri polygon layers
  const neighborhoods = L.esri.featureLayer({
    url:
      "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Neighborhoods_View/FeatureServer/0",
    //minScale: neighborhoodsMinScale,
    title: "Neighborhoods",
    fields: ["*"],
    minZoom: neighborhoodsMinScale,
    pane: 'areas',
    style: polygonStyle
  });

  const regions = L.esri.featureLayer({
    url:
      "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Regions_(v2)_View/FeatureServer/0",
    //minScale: countiesMaxScale,
    //maxScale: regionsMaxScale,
    //labelingInfo: [regionsLabelClass],
    //renderer: polygonFeatureRenderer,
    title: "Regions",
    fields: ["*"],
    minZoom: countiesMaxScale,
    maxZoom: neighborhoodsMinScale - 1,
    pane: 'areas',
    style: polygonStyle
  });

  var counties = L.esri.featureLayer({
    url:
      "https://services7.arcgis.com/zT20oMv4ojQGbhWr/arcgis/rest/services/SoCal_Counties_View/FeatureServer/0",
    //minScale: countiesMaxScale,
    //maxScale: regionsMaxScale,
    //labelingInfo: [regionsLabelClass],
    //renderer: polygonFeatureRenderer,
    title: "Counties",
    //fields: ["*"],
    maxZoom: countiesMaxScale,
    pane: 'areas',
    //style: polygonStyle,
  });

  // Create layer group for areas and add to map
  const areas = L.layerGroup([neighborhoods, regions, counties]);
  areas.addTo(map);
  //counties.addTo(map);
  
/*
  counties.bindPopup(function (layer) {
    return L.Util.template('<p>{name}</p>', layer.feature.properties);
  }, {
    closeOnClick: false,
    autoClose: false,
    closeButton: false
  });
  */

  counties.bindTooltip('name').openTooltip();

  localitiesVectorTile.addTo(map);

  function getCentroid (arr) {
    var twoTimesSignedArea = 0;
    var cxTimes6SignedArea = 0;
    var cyTimes6SignedArea = 0;

    var length = arr.length

    var x = function (i) { return arr[i % length][0] };
    var y = function (i) { return arr[i % length][1] };

    for ( var i = 0; i < arr.length; i++) {
        var twoSA = x(i)*y(i+1) - x(i+1)*y(i);
        twoTimesSignedArea += twoSA;
        cxTimes6SignedArea += (x(i) + x(i+1)) * twoSA;
        cyTimes6SignedArea += (y(i) + y(i+1)) * twoSA;
    }
    var sixSignedArea = 3 * twoTimesSignedArea;
    const latLng = [
      cxTimes6SignedArea / sixSignedArea,
      cyTimes6SignedArea / sixSignedArea
    ]
    return L.latLng(latLng[1], latLng[0]);
}

}


