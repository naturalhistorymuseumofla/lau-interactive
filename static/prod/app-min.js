var exportView,isMobile=screen.height<719||screen.width<1023;isMobile&&document.documentElement.setAttribute("data-mobile","true"),require(["esri/Map","esri/views/MapView","esri/layers/FeatureLayer","esri/layers/GraphicsLayer","esri/Graphic","esri/layers/VectorTileLayer","esri/widgets/Zoom/ZoomViewModel","esri/layers/support/LabelClass","esri/geometry/support/webMercatorUtils","esri/widgets/Search/SearchViewModel","esri/tasks/Locator"],function(e,t,n,a,s,o,i,r,l,c,m){var d=f(),u=function(){const s=new o({portalItem:{id:"43ed5ecba7dd4a75b1395c2f3fa3951b"}});var l=new e;function d(){const e=window.screen.width,t=window.screen.height,n=t*e;return n>7e5?7e5+.1*(1e6-n/2):1e6-n/2+7e5}var u=new t({container:"viewDiv",map:l,center:[-118.215,34.225],scale:d(),constraints:{snapToZoom:!1,rotationEnabled:!1,minZoom:function(){const e=window.screen.width,t=window.screen.height;window.devicePixelRatio;return t*e<8e5?7:8}(),maxZoom:14,geometry:{type:"extent",xmin:-121.5,ymin:32.7,xmax:-114.7,ymax:36}},popup:{autoOpenEnabled:!1},highlightOptions:{color:[42,208,212,.75],fillOpacity:.4},ui:{components:[]}});const p=new i({view:u}),y={type:"simple",symbol:{type:"simple-marker",size:0}},h=new r({labelExpressionInfo:{expression:"$feature.NAME"},labelPlacement:"above-center",symbol:{type:"text",color:"rgb(199, 199, 199))",haloSize:.5,haloColor:"rgb(66,66,66)",font:{family:"Avenir Next LT Pro Regular",weight:"bold",size:13}}}),f=new r({labelExpressionInfo:{expression:"$feature.NAME"},labelPlacement:"above-center",symbol:{type:"text",color:"rgb(199, 199, 199)",haloSize:.5,haloColor:"rgb(66,66,66)",deconflictionStrategy:"static",font:{family:"Avenir Next LT Pro Regular",weight:"normal",size:9.5}}}),b=new r({labelExpressionInfo:{expression:"Replace(Trim($feature.name), ' ', TextFormatting.NewLine)"},symbol:{type:"text",color:"rgb(199, 199, 199)",haloSize:.5,haloColor:"rgb(66,66,66)",deconflictionStrategy:"static",font:{family:"Avenir Next LT Pro Regular",weight:"bold",size:9}}});const L=new n({title:"Areas",spatialReference:{wkid:4326},fields:[{name:"region_type",alias:"Region Type",type:"string"},{name:"objectId",alias:"ObjectId",type:"oid"},{name:"name",alias:"Name",type:"string"},{name:"legacyId",alias:"Legacy object ID",type:"string"}],objectIdField:"objectId",geometryType:"polygon",outFields:["*"],source:[],renderer:{type:"simple",symbol:{type:"simple-fill",style:"none",outline:{color:[15,15,15,.75],width:"2px"}}},labelingInfo:[b]}),_=new n({url:"https://services3.arcgis.com/pIjZlCuGxnW1cJpM/arcgis/rest/services/lauLocalitiesView/FeatureServer",renderer:{type:"simple",symbol:{type:"simple-marker",size:6,color:[67,120,116,.5],outline:{width:0,color:[67,120,116,.1]}}},title:"localityLayer",objectIdField:"ObjectId",outFields:["ObjectId","site"]}),w=new n({url:"https://services3.arcgis.com/pIjZlCuGxnW1cJpM/arcgis/rest/services/lauCountiesCentroids/FeatureServer",renderer:y,labelingInfo:[h],maxScale:6e5,outFields:["name"]}),E=new n({url:"https://services3.arcgis.com/pIjZlCuGxnW1cJpM/arcgis/rest/services/lauRegionsCentroids/FeatureServer",renderer:y,labelingInfo:[f],minScale:6e5,maxScale:188895,outFields:["name"]}),C=new n({url:"https://services3.arcgis.com/pIjZlCuGxnW1cJpM/arcgis/rest/services/lauNeighborhoodsCentroids/FeatureServer",renderer:y,labelingInfo:[f],minScale:188895,outFields:["name"]}),N=new o({portalItem:{id:"6e3c7ac158dd401c81f0075c1a97543b"}}),S=new a({effect:"drop-shadow(0px, 2px, 2px rgba(63, 153, 149, 0.75))"}),M=new a({labelingInfo:[l.areasLabelClass]}),x=new a,T=[s,M,L,C,E,w,N,_,S,x];var F;l.addMany(T),isMobile&&(F=new CupertinoPane(".cupertino-pane",{parentElement:".ui-top-left",breaks:{middle:{enabled:!1,height:300},bottom:{enabled:!0,height:100,bounce:!0}},cssClass:"card--active",simulateTouch:!0,initialBreak:"bottom",buttonDestroy:!1,onDrag:()=>console.log("Drag event")}));u.whenLayerView(_).then(e=>{D.localitiesView=e});const B=new c({view:u,popupEnabled:!1,includeDefaultSources:!1,maxSuggestions:5,goToOverride:e=>"",sources:[{locator:new m({url:"https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"}),placeholder:"Search",outFields:["Match_addr","Addr_type"],singleLineFieldName:"SingleLine",name:"ArcGIS World Geocoding Service",filter:{geometry:u.constraints.geometry}}]}),A=document.getElementsByClassName("search")[0],$=document.getElementsByClassName("search__input")[0],I=document.getElementsByClassName("search__suggest-list")[0];function H(){document.body.setAttribute("search-active","true"),document.getElementsByClassName("search__container")[0].setAttribute("search-active","true"),document.getElementsByClassName("search__suggest")[0].setAttribute("search-active","true"),A.setAttribute("search-active","true"),$.setAttribute("search-active","true"),I.setAttribute("search-active","true")}$.addEventListener("input",e=>{B.suggest($.value).then(e=>{let t=e.results[0].results;I.innerHTML="",t.forEach(e=>{const t=document.createElement("li");t.classList.add("search__suggest-list-item"),t.setAttribute("role","option"),t.innerHTML=`<span><svg class="map-icon" transform="translate(-6.63 -0.33)" viewBox="0 0 36.74 49.34"><path class="cls-1" d="M43.37,17.78C43.37,8.14,35.15.33,25,.33S6.63,8.14,6.63,17.78a16.74,16.74,0,0,0,2.93,9.44h0L23.48,48.86a1.83,1.83,0,0,0,3,0L40.45,27.22h0A16.74,16.74,0,0,0,43.37,17.78ZM25,25.39a7.1,7.1,0,1,1,7.09-7.09A7.09,7.09,0,0,1,25,25.39Z" transform="translate(-6.63 -0.33)"</svg></span>${e.text}`,t.addEventListener("click",e=>{B.search(t.textContent),$.value=t.textContent}),I.appendChild(t)})})}),B.on("search-complete",e=>{I.innerHTML="",v()}),A.addEventListener("submit",e=>{e.preventDefault(),B.search($.value)}),B.on("search-complete",e=>{g("",e.results[0].results[0].feature.geometry,!0)}),isMobile&&($.addEventListener("input",H),$.addEventListener("focus",H));for(let e of document.getElementsByClassName("widget"))e.style.opacity="1";var j=document.getElementsByClassName("ui-container");for(let e of j)u.ui.add(e);var D={map:l,view:u,scale:d(),zoomViewModel:p,countiesMaxScale:6e5,regionsMaxScale:188895,areaGraphics:S,intersectingGraphicsLayer:M,selectedPhotoGraphicsLayer:x,clientFeatureLayer:L,infoPane:F,areasLayer:N,areasLabelClass:b,intersectingFeatures:0,selectedFeature:{name:"",region:""}};return D}();function g(e,t,n=!1){e?(u.selectedFeature.name=e.attributes.name,u.selectedFeature.region="county"==u.currentFeature.region?"region":"region"==u.currentFeature.region?"neighborhood":""):u.selectedFeature.name="",async function(e,t=!1){const n=u.view.scale;let a=n>6e5?"county":6e5>n&&n>188895?"region":"neighborhood";const s={latitude:e.latitude,longitude:e.longitude,region:a,currentFeature:"currentFeature"in u?u.currentFeature:"",selectedFeature:u.selectedFeature.name?u.selectedFeature:"",search:t};let o=await fetch("/spatial-query",{method:"POST",headers:{"Content-Type":"application/json;charset=utf-8"},body:JSON.stringify(s)}),i=await o.text();return i?JSON.parse(i):i}(t,n).then(e=>{e?(u.currentFeature={name:e.name,region:e.region},function(e){const t=e.geometry,n="MultiPolygon"===t.type?t.coordinates.flat(1):t.coordinates,a=new s({geometry:{type:"polygon",rings:n},attributes:{name:e.name,region_type:e.region},labelPlacement:"always-horizontal",symbol:{type:"simple-fill",color:[73,128,123,.15],outline:{color:[73,128,123,1],width:4}}});u.areaGraphics.graphics.removeAll(),u.areaGraphics.graphics.add(a),function(e,t){const n=-e.extent.width/2,a={animate:!0,duration:800,ease:"ease-in"},s={true:{"Los Angeles":{center:[-118.3,34.25],scale:p()},"Santa Barbara":{center:[-120.1,34.8]},default:e},false:{"Los Angeles":{center:[-118.735491,34.222515],scale:p()},Ventura:{center:[-119.254898,34.515522],scale:p()},default:{center:e.extent.expand(2).offset(n,0)}}};t in s[isMobile]?u.view.goTo(s[isMobile][t],a).catch(function(e){"AbortError"!=e.name&&console.error(e)},a):u.view.goTo(s[isMobile].default,a).catch(function(e){"AbortError"!=e.name&&console.error(e)},a)}(a.geometry,e.name)}(e),"county"!==e.region&&"region"!=e.region||async function(e){const t="county"==e.region?"region":"neighborhood",n={name:e.name,region:t};let a=await fetch("/intersecting-areas-query",{method:"POST",headers:{"Content-Type":"application/json;charset=utf-8"},body:JSON.stringify(n)}),s=await a.text();return s?JSON.parse(s):s}(e).then(e=>{!function(e){y();const t=[];e.forEach(e=>{let n="MultiPolygon"===e.geometry.type?e.geometry.coordinates.flat(1):e.geometry.coordinates,a=new s({geometry:{type:"polygon",rings:n},attributes:{name:e.name,region_type:e.region},labelPlacement:"always-horizontal",symbol:{type:"simple-fill",style:"none",outline:{color:[15,15,15,.75],width:"2px"}}});t.push(a)}),h({addFeatures:t})}(e.features)}),e.number_of_sites?function(e){const t=document.getElementsByClassName("taxa--info")[0],n=document.getElementsByClassName("taxa--null")[0],a=document.getElementById("photos"),s=document.getElementsByClassName("photos--null")[0],o=document.getElementsByClassName("photo-indicator")[0];let i=document.getElementsByClassName("photos__button"),r=document.getElementsByClassName("time__button");isMobile?(E(document.getElementsByClassName("null-card__content")[0]),document.getElementsByClassName("info-card__content")[0].style.display="block"):E("#noInfoCard");u.highlight?u.highlight.remove():u.highlight,u.highlight=u.localitiesView.highlight(e.oids);for(let t of document.getElementsByClassName("featureName"))t.innerText=e.name;document.querySelector(".excavation-number[lang=en]").innerHTML=`${e.number_of_sites.toLocaleString()}`,document.querySelector(".excavation-number[lang=es]").innerHTML=`${e.number_of_sites.toLocaleString("es")}`;const l=document.getElementsByClassName("taxa__list");for(let e of l)e.innerHTML="";if(e.number_of_specimens>0){S(n,!1),S(t,!0);const a=e.taxa,s=Object.values(a).reduce((e,t)=>e+t);document.querySelector(".fossils-found[lang=en]").innerHTML=s.toLocaleString(),document.querySelector(".fossils-found[lang=es]").innerHTML=s.toLocaleString("es"),function(e){let t={"Clams, oysters":{fileName:"clam",category:"invertebrate",es:"Almejas, ostras, vieiras",en:"Clams, oysters, scallops"},Snails:{fileName:"snail",category:"invertebrate",es:"Caracoles",en:"Snails"},"Sea urchins":{fileName:"urchin",category:"invertebrate",es:"Erizos de mar",en:"Sea urchins"},Worms:{fileName:"worm",category:"invertebrate",es:"Gusanos",en:"Worms"},"Crabs, shrimps":{fileName:"crab",category:"invertebrate",es:"Cangrejos, camarones",en:"Crabs, shrimp"},Nautiloids:{fileName:"ammonoid",category:"invertebrate",es:"Ammoniodeos, nautiloideos, pulpos",en:"Ammonoids, nautiloids, octopuses"},Corals:{fileName:"coral",category:"invertebrate",es:"Corales",en:"Corals"},Barnacles:{fileName:"barnacle",category:"invertebrate",es:"Percebes",en:"Barnacles"},Scaphopods:{fileName:"scaphopod",category:"invertebrate",es:"Conchas colmillo",en:"Tusk shells"},"Sharks, rays":{fileName:"shark",category:"vertebrate",es:"Tiburones, rayas",en:"Sharks, rays"},Fish:{fileName:"fish",category:"vertebrate",es:"Peces",en:"Fish"},Birds:{fileName:"bird",category:"vertebrate",es:"Aves",en:"Birds"},"Whales, dolphins":{fileName:"whale",category:"vertebrate",es:"Ballenas, delfines",en:"Whales, dolphins"},Microfossils:{fileName:"magnifying-glass",category:"invertebrate",es:"Microfósiles",en:"Microfossils"},"Walruses, seals":{fileName:"walrus",category:"vertebrate",es:"Focas, otarios, morsas",en:"Seals, sea lions, walruses"}},n=document.createDocumentFragment(),a=document.createDocumentFragment();const s=document.getElementsByClassName("vert__list")[0],o=document.getElementsByClassName("invert__list")[0],i=Object.entries(e).sort((e,t)=>t[1]-e[1]);for(const e of i){let s,o;[s,o]=e;let i=document.createElement("div"),r=document.createElement("img");if(t[s]){const e=t[s].fileName,l=t[s].category,c=t[s].es,m=t[s].en;r.src=`/static/images/${e}.svg`;const d=document.createElement("p"),u=document.createElement("p");d.lang="en",u.lang="es",i.classList.add("taxa__cell"),r.classList.add("taxa__icon"),d.innerHTML=`${o.toLocaleString()}<br>${m}`,u.innerHTML=`${o.toLocaleString("es")}<br>${c}`,i.append(r,d,u),"invertebrate"===l?n.append(i):"vertebrate"===l&&a.append(i)}}o.append(n),s.append(a)}(a)}else S(t,!1),S(n,!0);if(e.photos.length>0){for(let e of i)e.classList.remove("button--removed");!function(e){!function(){const e=document.getElementsByClassName("splide__list")[0],t=document.getElementsByClassName("splide__pagination")[0];e.innerHTML="",t&&t.remove()}();const t=document.createDocumentFragment(),n=document.getElementsByClassName("splide__list")[0];e.forEach(e=>{const n=document.createElement("img"),a=document.createElement("li"),s=function(e){const t=document.createElement("p"),n=document.createElement("p"),a=document.createElement("div");t.classList.add("caption__taxon"),t.innerHTML=e.taxon;const[s,o]=function(e){const t=document.createElement("p"),n=document.createElement("p");t.setAttribute("lang","en"),n.setAttribute("lang","es");const a=e.start_age,s=e.end_age,o=s>=1?s.toLocaleString():(1e6*s).toLocaleString(),i=s>=1?s.toLocaleString("es"):(1e6*s).toLocaleString("es"),r=a>=1?a.toLocaleString():(1e6*a).toLocaleString(),l=a>=1?a.toLocaleString("es"):(1e6*a).toLocaleString("es");a>=1&&s>=1?(t.innerHTML=`${o}–${r} million years old`,n.innerHTML=`Entre ${o} y ${r} millones de años`):a<1&&s<1?(t.innerHTML=`${o}–${r} thousand years old`,n.innerHTML=`Entre ${i} y ${l} miles de años`):a>=1&&s<1?(t.innerHTML=`${o} thousand years – ${r} million years old`,n.innerHTML=`Entre ${i} miles y ${l} millones de años`):s||(t.innerHTML=a>1?`${r} million years old`:`${r} thousand years old`,n.innerHTML=a>1?`${l} millones de años`:`${r} millones de años`);return[t,n]}(e),[i,r]=function(e){const t=document.createElement("p"),n=document.createElement("p");return t.classList.add("caption__description"),n.classList.add("caption__description"),t.setAttribute("lang","en"),n.setAttribute("lang","es"),t.innerHTML=e.description,n.innerHTML="Fósil de "+{Ammonoid:"ammonoideo",Barnacle:"percebes",Bird:"ave",Clam:"almejas",Coral:"coral",Crab:"cangrejo",Desmostylian:"desmostylia",Diatom:"diatomea",Dolphin:"delfín",Fish:"pez",Microfossil:"microfósiles",Nautiloid:"nautiloideo",Oyster:"ostra",Ray:"raya",Scallop:"vieira",Scaphopod:"conchas colmillo",Seal:"foca","Sea lion":"otario","Sea urchin":"erizo de mar",Shark:"tiburones",Shrimp:"camarón",Snail:"caracol",Turtle:"tortuga",Walrus:"morsa",Whale:"ballena",Worm:"gusano"}[e.common_name],[t,n]}(e);return n.innerHTML=`${e.display_id}`,a.classList.add("splide__captions"),a.append(i,r,t,s,o,n),a}(e);n.src="https://fossilmap.sfo3.cdn.digitaloceanspaces.com/images/"+e.key+"_500px.png",a.classList.add("splide__slide");const o=t.appendChild(a),i=document.createElement("div");i.className="splide__slide--imageContainer",o.appendChild(i).appendChild(n),o.appendChild(s)}),n.append(t),d=f(),b(e[0].point.coordinates),d.on("visible",t=>{const n=Array.from(t.slide.parentElement.children),a=n.indexOf(t.slide);b(e[a].point.coordinates)}),S(sliderDiv,!0)}(e.photos),S(a,!0),S(s,!1),S(o,!0)}else{for(let e of i)e.classList.add("button--removed");S(a,!1),S(o,!1)}C("#infoCard"),isMobile&&u.infoPane.present({animate:!0});null!==e.endDate&&null!=e.startDate?(S(document.getElementById("time"),!0),x(r,!0),0===e.endDate&&(e.endDate=.0117),function(e,t){const n=document.getElementById("indicator"),a=document.getElementsByClassName("timescale__container")[0],s=(e=e>100?100:e)-t;n.style.right=`${t/100*100}%`;const o=a.clientWidth/100;n.style.width=`${o*s}px`}(e.startDate,e.endDate),function(e,t){let n,a;[n,a]=document.getElementsByClassName("time__range"),e>1&&t>1?(t=t.toFixed(0),e=e.toFixed(0),n.innerHTML=`${t}-${e} million years old`,a.innerHTML=`${t} y ${e} millones de años de antigüedad.`):e>1&&t<1?(t=(1e3*t).toFixed(0),e=e.toFixed(0),n.innerHTML=`${t} thousand-${e} million years old`,a.innerHTML=`${t} miles y ${e} millones de años de antigüedad.`):e<1&&t<1&&(t=(1e3*t).toFixed(0),e=(1e3*e).toFixed(0),n.innerHTML=`${t}-${e} thousands of years old`,a.innerHTML=`${t} y ${e} miles de años de antigüedad.`)}(e.startDate,e.endDate)):(S(document.getElementById("time"),!1),x(r,!1));(function(e){const t=document.getElementsByClassName("underwater__container")[0],n=document.getElementById("timeSeperator"),a=document.getElementById("time"),s=document.querySelector(".underwater__age[lang=en]"),o=document.querySelector(".underwater__age[lang=es]");S(t,!0),S(n,!0),a.style.minHeight="",e>=1?(s.innerHTML=`${e} million years ago`,o.innerHTML=`${e} millones de años de antigüedad`):e&&0!==e?(s.innerHTML=`${(1e5*e).toLocaleString()} thousand years ago`,o.innerHTML=`${(1e5*e).toLocaleString("es")} miles de años de antigüedad`):(S(t,!1),S(n,!1),a.style.minHeight="auto")})(e.immersion),$(".card__content").animate({scrollTop:10},50)}(e):function(e){if(isMobile)E(document.getElementsByClassName("info-card__content")[0]),C(document.getElementsByClassName("null-card__content")[0]);else{const e=document.getElementById("infoCard");"none"!=e.style.display?(E(e),setTimeout(()=>{C("#noInfoCard")},550)):C("#noInfoCard")}for(let t of document.getElementsByClassName("featureName"))t.innerText=e}(e.name)):L()})}function p(){let e=window.innerHeight*window.innerWidth;return void 0/e*1e3}function y(){if(u.intersectingFeatures){h({deleteFeatures:u.intersectingFeatures})}}function h(e){u.clientFeatureLayer.applyEdits(e).then(function(e){if(e.deleteFeatureResults.length>0&&(u.intersectingFeatures=0),e.addFeatureResults.length>0){u.intersectingFeatures=e.addFeatureResults.length;var t=[];e.addFeatureResults.forEach(function(e){t.push(e.objectId)}),u.intersectingFeatures=t.map(e=>({objectId:e})),u.clientFeatureLayer.queryFeatures({objectIds:t})}}).catch(function(e){console.log(e)})}function f(){return new Splide(".splide",{}).mount()}function b(e){var t=l.geographicToWebMercator({type:"point",longitude:e[0],latitude:e[1]});const n=new s({geometry:t,symbol:{type:"simple-marker",style:"circle",color:"orange",size:"12px",outline:{color:[255,255,0],width:2}}});u.selectedPhotoGraphicsLayer.removeAll(),u.selectedPhotoGraphicsLayer.add(n)}function v(){const e=document.getElementsByClassName("search")[0],t=document.getElementsByClassName("search__input")[0],n=document.getElementsByClassName("search__suggest-list")[0];document.body.setAttribute("search-active","false"),document.getElementsByClassName("search__container")[0].setAttribute("search-active","false"),document.getElementsByClassName("search__suggest")[0].setAttribute("search-active","false"),e.setAttribute("search-active","false"),t.setAttribute("search-active","false"),n.setAttribute("search-active","false")}function L(){document.getElementsByClassName("search__suggest-list")[0].innerHTML="",document.getElementsByClassName("search__input")[0].value="",v(),N(),function(){const e=document.getElementsByClassName("content-card");for(let t of e)E(t);isMobile&&u.infoPane.hide({animate:!0})}(),S(document.getElementsByClassName("photo-indicator")[0],!1),u.view.focus()}exportView=u.view,document.addEventListener("click",w,{once:!0}),document.addEventListener("click",function(e){const t=e.target.classList;e.target.classList.contains("close-button")?L():"zoomIn"===e.target.id?u.zoomViewModel.zoomIn():"zoomOut"===e.target.id?u.zoomViewModel.zoomOut():t.contains("search__suggest-list")||t.contains("search__suggest-list-item")||t.contains("search__input")||(document.getElementsByClassName("search__suggest-list")[0].innerHTML="")}),document.addEventListener("touchstart",function(e){e.target.classList.contains("close-button")&&L()},{passive:!0}),u.view.on("click",function(e){e.preventDefault(),function(e){const t=u.view.toMap(e);u.intersectingFeatures?u.view.hitTest(e,{include:u.clientFeatureLayer}).then(e=>{e.results[0]?(N(),g(e.results[0].graphic,t)):(N(),g(null,t))}):(N(),g(null,t))}(e)});const _=document.getElementById("languageSwitch");function w(){const e=document.getElementsByClassName("instructions")[0],t=document.getElementsByClassName("instructions__container")[0];e.classList.add("instructions--inactive"),t.classList.add("instructions--inactive"),setTimeout(()=>{t.style.display="None"},750)}function E(e){const t="object"==typeof e?e:document.querySelector(e);t.classList.remove("card--active"),setTimeout(()=>{M(t,!1)},550)}function C(e){const t="object"==typeof e?e:document.querySelector(e);M(t,!0),setTimeout(()=>{t.classList.add("card--active")},5)}function N(){u.view.graphics.removeAll(),u.intersectingGraphicsLayer.removeAll(),u.areaGraphics.graphics.removeAll(),y(),u.selectedFeature={name:"",region:""},"intersectingAreas"in u&&(u.map.layers.remove(u.intersectingAreas),delete u.intersectingAreas),"highlightLayer"in u&&(u.map.layers.remove(u.highlightLayer),delete u.highlightLayer),u.selectedPhotoGraphicsLayer.graphics.removeAll(),u.highlight?u.highlight.remove():u.highlight}function S(e,t){e.style.display=t?"flex":"none"}function M(e,t){e.style.display=t?"inline-block":"none"}function x(e,t){if(t)for(let t of e)t.classList.remove("button--removed");else for(let t of e)t.classList.add("button--removed")}_.addEventListener("change",()=>{_.checked?document.body.setAttribute("lang","es"):document.body.setAttribute("lang","en")})});export{exportView};