var isMobile=screen.height<719||screen.width<1023;isMobile&&document.documentElement.setAttribute("data-mobile","true"),require(["esri/Map","esri/views/MapView","esri/layers/FeatureLayer","esri/layers/GeoJSONLayer","esri/layers/GraphicsLayer","esri/Graphic","esri/Basemap","esri/layers/VectorTileLayer","esri/layers/TileLayer","esri/widgets/Zoom/ZoomViewModel","esri/layers/support/LabelClass","esri/views/2d/layers/BaseLayerViewGL2D","esri/core/promiseUtils","esri/core/watchUtils","esri/geometry/support/webMercatorUtils"],function(e,t,n,i,a,s,o,r,l,c,m,d,u,h,f){var g=_();const p=d.createSubclass({aPosition:0,aOffset:1,constructor:function(){this.transform=mat3.create(),this.translationToCenter=vec2.create(),this.screenTranslation=vec2.create(),this.display=mat3.fromValues(NaN,0,0,0,NaN,0,-1,1,1),this.screenScaling=vec3.fromValues(NaN,NaN,1),this.needsUpdate=!1;const e=()=>{this.needsUpdate=!0,this.requestRender()};this.watcher=h.on(this,"layer.graphics","change",e,e,e)},attach:function(){const e=this.context,t=e.createShader(e.VERTEX_SHADER);e.shaderSource(t,"\n        precision highp float;\n        uniform mat3 u_transform;\n        uniform mat3 u_display;\n        attribute vec2 a_position;\n        attribute vec2 a_offset;\n        varying vec2 v_offset;\n        const float SIZE = 55.0;\n        void main(void) {\n            gl_Position.xy = (u_display * (u_transform * vec3(a_position, 1.0) + vec3(a_offset * SIZE, 0.0))).xy;\n            gl_Position.zw = vec2(0.0, 1.0);\n            v_offset = a_offset;\n        }"),e.compileShader(t);const n=e.createShader(e.FRAGMENT_SHADER);e.shaderSource(n,"\n        precision highp float;\n        uniform float u_current_time;\n        varying vec2 v_offset;\n        const float PI = 3.14159;\n        const float N_RINGS = 2.0;\n        const vec3 COLOR = vec3(0.95, 0.92, 0.33);\n        const float FREQ = 0.35;\n        void main(void) {\n            float l = length(v_offset);\n            float intensity = clamp(cos(l * PI), 0.0, 1.0) * clamp(cos(2.0 * PI * (l * 2.0 * N_RINGS - FREQ * u_current_time)), 0.0, 1.0);\n            gl_FragColor = vec4(COLOR * intensity, intensity);\n        }"),e.compileShader(n),this.program=e.createProgram(),e.attachShader(this.program,t),e.attachShader(this.program,n),e.bindAttribLocation(this.program,this.aPosition,"a_position"),e.bindAttribLocation(this.program,this.aOffset,"a_offset"),e.linkProgram(this.program),e.deleteShader(t),e.deleteShader(n),this.uTransform=e.getUniformLocation(this.program,"u_transform"),this.uDisplay=e.getUniformLocation(this.program,"u_display"),this.uCurrentTime=e.getUniformLocation(this.program,"u_current_time"),this.vertexBuffer=e.createBuffer(),this.indexBuffer=e.createBuffer(),this.indexBufferSize=0,this.centerAtLastUpdate=vec2.fromValues(this.view.state.center[0],this.view.state.center[1])},detach:function(){this.watcher.remove();const e=this.context;e.deleteBuffer(this.vertexBuffer),e.deleteBuffer(this.indexBuffer),e.deleteProgram(this.program)},render:function(e){const t=e.context,n=e.state;this.updatePositions(e),0!==this.indexBufferSize&&(mat3.identity(this.transform),this.screenTranslation[0]=n.pixelRatio*n.size[0]/2,this.screenTranslation[1]=n.pixelRatio*n.size[1]/2,mat3.translate(this.transform,this.transform,this.screenTranslation),mat3.rotate(this.transform,this.transform,Math.PI*n.rotation/180),this.screenScaling[0]=n.pixelRatio/n.resolution,this.screenScaling[1]=-n.pixelRatio/n.resolution,mat3.scale(this.transform,this.transform,this.screenScaling),mat3.translate(this.transform,this.transform,this.translationToCenter),this.display[0]=2/(n.pixelRatio*n.size[0]),this.display[4]=-2/(n.pixelRatio*n.size[1]),t.useProgram(this.program),t.uniformMatrix3fv(this.uTransform,!1,this.transform),t.uniformMatrix3fv(this.uDisplay,!1,this.display),t.uniform1f(this.uCurrentTime,performance.now()/1e3),t.bindBuffer(t.ARRAY_BUFFER,this.vertexBuffer),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,this.indexBuffer),t.enableVertexAttribArray(this.aPosition),t.enableVertexAttribArray(this.aOffset),t.vertexAttribPointer(this.aPosition,2,t.FLOAT,!1,16,0),t.vertexAttribPointer(this.aOffset,2,t.FLOAT,!1,16,8),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.drawElements(t.TRIANGLES,this.indexBufferSize,t.UNSIGNED_SHORT,0),this.requestRender())},hitTest:function(e,t){const n=this.view;if(0===this.layer.graphics.length)return u.resolve(null);const i=this.layer.graphics.map(i=>{const a=n.toScreen(i.geometry);return Math.sqrt((a.x-e)*(a.x-e)+(a.y-t)*(a.y-t))});let a=0;if(i.forEach((e,t)=>{e<i.getItemAt(a)&&(a=t)}),i.getItemAt(a)>35)return u.resolve(null);const s=this.layer.graphics.getItemAt(a);return s.sourceLayer=this.layer,u.resolve(s)},updatePositions:function(e){const t=e.context,n=e.stationary,i=e.state;if(!n)return vec2.sub(this.translationToCenter,this.centerAtLastUpdate,i.center),void this.requestRender();if(!this.needsUpdate&&0===this.translationToCenter[0]&&0===this.translationToCenter[1])return;this.centerAtLastUpdate.set(i.center),this.translationToCenter[0]=0,this.translationToCenter[1]=0,this.needsUpdate=!1;const a=this.layer.graphics;t.bindBuffer(t.ARRAY_BUFFER,this.vertexBuffer);const s=new Float32Array(16*a.length);let o=0;a.forEach(e=>{const t=e.geometry,n=t.x-this.centerAtLastUpdate[0],i=t.y-this.centerAtLastUpdate[1];s[16*o+0]=n,s[16*o+1]=i,s[16*o+2]=-.5,s[16*o+3]=-.5,s[16*o+4]=n,s[16*o+5]=i,s[16*o+6]=.5,s[16*o+7]=-.5,s[16*o+8]=n,s[16*o+9]=i,s[16*o+10]=-.5,s[16*o+11]=.5,s[16*o+12]=n,s[16*o+13]=i,s[16*o+14]=.5,s[16*o+15]=.5,++o}),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,this.indexBuffer);let r=new Uint16Array(6*a.length);for(let e=0;e<a.length;++e)r[6*e+0]=4*e+0,r[6*e+1]=4*e+1,r[6*e+2]=4*e+2,r[6*e+3]=4*e+1,r[6*e+4]=4*e+3,r[6*e+5]=4*e+2;t.bufferData(t.ELEMENT_ARRAY_BUFFER,r,t.STATIC_DRAW),this.indexBufferSize=r.length}}),y=a.createSubclass({createLayerView:function(e){if("2d"===e.type)return new p({view:e,layer:this})}});var b=function(){var s=new o({baseLayers:[new l({url:"https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer",opacity:.85}),new r({portalItem:{id:"43ed5ecba7dd4a75b1395c2f3fa3951b"},blendMode:"multiply"})]}),d=new e({basemap:s});const u=function(){const e=window.screen.width,t=window.screen.height;return window.devicePixelRatio,t*e<8e5?7:8}(),h=function(){const e=window.screen.width,t=window.screen.height*e;return t>7e5?7e5+.25*(1e6-t/2):1e6-t/2+7e5}();var f=new t({container:"viewDiv",map:d,center:[-118.215,34.225],scale:h,constraints:{snapToZoom:!1,rotationEnabled:!1,minZoom:u,maxZoom:13,geometry:{type:"extent",xmin:-121.5,ymin:32.7,xmax:-114.7,ymax:36}},popup:{autoOpenEnabled:!1},highlightOptions:{color:[42,208,212,.75],fillOpacity:.4},ui:{components:[]}});const g=new c({view:f}),p={type:"simple",symbol:{type:"simple-fill",style:"none",outline:{color:[15,15,15,.75],width:"2px"}}},b=new m({labelExpressionInfo:{expression:"$feature.NAME"},symbol:{type:"text",color:"rgb(199, 199, 199))",haloSize:.5,haloColor:"rgb(66,66,66)",font:{family:"Avenir Next LT Pro Regular",weight:"bold",size:13}}}),v=new m({labelExpressionInfo:{expression:"$feature.NAME"},symbol:{type:"text",color:"rgb(199, 199, 199)",haloSize:.5,haloColor:"rgb(66,66,66)",deconflictionStrategy:"static",font:{family:"Avenir Next LT Pro Regular",weight:"normal",size:9.5}}}),w=new m({labelExpressionInfo:{expression:"Replace(Trim($feature.name), ' ', TextFormatting.NewLine)"},symbol:{type:"text",color:"rgb(199, 199, 199)",haloSize:.5,haloColor:"rgb(66,66,66)",deconflictionStrategy:"static",font:{family:"Avenir Next LT Pro Regular",weight:"bold",size:9}}});var _=288895;const L=new n({title:"Areas",spatialReference:{wkid:4326},fields:[{name:"region_type",alias:"Region Type",type:"string"},{name:"objectId",alias:"ObjectId",type:"oid"},{name:"name",alias:"Name",type:"string"},{name:"legacyId",alias:"Legacy object ID",type:"string"}],objectIdField:"objectId",geometryType:"polygon",outFields:["*"],source:[],renderer:p,labelingInfo:[w]}),E=new i({url:"/static/layers/lauLocalities.geojson",renderer:{type:"simple",symbol:{type:"simple-marker",size:6,color:[67,120,116,.5],outline:{width:0,color:[67,120,116,.1]}}}}),x=new i({url:"/static/layers/lauCountiesSimplified.geojson",maxScale:69e4,labelingInfo:[b],renderer:p,title:"county",outFields:["name","OBJECTID_1","OBJECTID","region_type"]}),N=new i({url:"/static/layers/lauRegionsSimplified.geojson",minScale:69e4,maxScale:_,labelingInfo:[v],renderer:p,title:"region",outFields:["name","OBJECTID","region_type","parent_region"]}),T=new i({url:"/static/layers/lauNeighborhoodsSimplified.geojson",minScale:_,labelingInfo:[v],renderer:p,title:"neighborhood",outFields:["name","OBJECTID","region_type","parent_region"]}),C=new i({url:"/static/layers/lauAreasSimplified.geojson",renderer:p,labelingInfo:[w],title:"area",outFields:["*"]}),S=isMobile?new a:new a({effect:"drop-shadow(0px, 2px, 2px rgba(63, 153, 149, 0.75))"}),B=new a,A=new y,M=[B,T,N,x,L,C,S,E,A];var I;d.addMany(M),isMobile&&(I=new CupertinoPane(".cupertino-pane",{parentElement:".ui-top-left",breaks:{middle:{enabled:!1,height:300},bottom:{enabled:!0,height:100,bounce:!0}},cssClass:"card--active",simulateTouch:!0,initialBreak:"bottom",buttonDestroy:!1,onDrag:()=>{}}));var R={map:d,view:f,basemap:s,scale:h,zoomViewModel:g,areaGraphics:S,countiesLayer:x,regionsLayer:N,neighborhoodsLayer:T,intersectingGraphicsLayer:B,selectedPhotoGraphicsLayer:A,clientFeatureLayer:L,areasLayer:C,infoPane:I};f.whenLayerView(C).then(e=>{R.areasView=e,R.areasView.visible=!1}),f.whenLayerView(E).then(e=>{R.localitiesView=e});for(let e of document.getElementsByClassName("widget"))e.style.opacity="1";var F=document.getElementsByClassName("ui-container");for(let e of F)f.ui.add(e);return R}();function v(){N(),b.view.goTo({center:[-118.215,34.225],scale:b.scale},{animate:!0,duration:400,ease:"ease-in"}),isMobile&&b.infoPane.destroy();const e=document.getElementsByClassName("instructions")[0],t=document.getElementsByClassName("instructions__container")[0];A(t,!0),A(e,!0),e.classList.remove("instructions--inactive"),t.classList.remove("instructions--inactive"),document.addEventListener("click",I,{once:!0})}function w(e){const t=e.geometry;let n=window.innerHeight*window.innerWidth;var i;return(i="Los Angeles"===e.attributes.name||"Ventura"===e.attributes.name?t.extent.height/4.15*t.extent.width:t.extent.height*t.extent.width)>9e7?i/n*150:i/n*1e3}function _(){return new Splide(".splide",{}).mount()}function L(e){var t=f.geographicToWebMercator({type:"point",longitude:e[0],latitude:e[1]});const n=new s({geometry:t,symbol:{type:"simple-marker",style:"circle",color:"orange",size:"12px",outline:{color:[255,255,0],width:2}}});b.selectedPhotoGraphicsLayer.removeAll(),b.selectedPhotoGraphicsLayer.add(n)}function E(e){const t=e.name;b.areasView.visible=!0,b.areasView.filter={where:"parent_region = '"+t+"'"}}var x=setInterval(v,6e4);function N(){E(""),B(),function(){const e=document.getElementsByClassName("content-card");for(let t of e)C(t);isMobile&&b.infoPane.hide({animate:!0})}(),A(document.getElementsByClassName("photo-indicator")[0],!1),b.view.focus()}document.addEventListener("click",function(e){clearInterval(x),x=setInterval(v,6e4),e.target.classList.contains("close-button")?N():"zoomIn"===e.target.id?b.zoomViewModel.zoomIn():"zoomOut"===e.target.id&&b.zoomViewModel.zoomOut()}),document.addEventListener("touchstart",function(e){clearInterval(x),x=setInterval(v,6e4),e.target.classList.contains("close-button")&&N()},{passive:!0}),document.addEventListener("mousewheel",function(){clearInterval(x),x=setInterval(v,6e4)}),b.view.on("click",function(e){!function(e){B();const t=[b.countiesLayer,b.regionsLayer,b.neighborhoodsLayer,b.areasLayer];b.view.hitTest(e,{include:t}).then(e=>{e.results[0]?function(e){!function(e){const t=e.geometry,n=e.attributes.name,i=-t.extent.width/2,a={animate:!0,duration:800,ease:"ease-in"},s={true:{"Los Angeles":{center:[-118.3,34.25],scale:w(e)},"Santa Barbara":{center:[-120.1,34.8]},default:{center:t}},false:{"Los Angeles":{center:[-118.735491,34.222515],scale:w(e)},Ventura:{center:[-119.254898,34.515522],scale:w(e)},default:{center:t.extent.expand(2).offset(i,0)}}};n in s[isMobile]?b.view.goTo(s[isMobile][n],a).catch(function(e){e.name},a):b.view.goTo(s[isMobile].default,a).catch(function(e){e.name},a)}(e),function(e){const t=new s({geometry:e,symbol:{type:"simple-fill",color:[73,128,123,.15],outline:{color:[73,128,123,1],width:4}}});b.areaGraphics.graphics.removeAll(),b.areaGraphics.graphics.add(t)}(e.geometry),async function(e){const t={region:e.attributes.region_type,name:e.attributes.name};let n=await fetch("/query",{method:"POST",headers:{"Content-Type":"application/json;charset=utf-8"},body:JSON.stringify(t)}),i=await n.text();return i?JSON.parse(i):i}(e).then(t=>{t?function(e){const t=document.getElementsByClassName("taxa--info")[0],n=document.getElementsByClassName("taxa--null")[0],i=document.getElementById("photos"),a=document.getElementsByClassName("photos--null")[0],s=document.getElementsByClassName("photo-indicator")[0];let o=document.getElementsByClassName("photos__button");isMobile?(C(document.getElementsByClassName("null-card__content")[0]),document.getElementsByClassName("info-card__content")[0].style.display="block"):C("#noInfoCard"),b.highlight?b.highlight.remove():b.highlight,b.highlight=b.localitiesView.highlight(e.oids);for(let t of document.getElementsByClassName("featureName"))t.innerText=e.name;document.querySelector(".excavation-number[lang=en]").innerHTML=`${e.number_of_sites.toLocaleString()}`,document.querySelector(".excavation-number[lang=es]").innerHTML=`${e.number_of_sites.toLocaleString("es")}`;const r=document.getElementsByClassName("taxa__list");for(let e of r)e.innerHTML="";if(e.number_of_specimens>0){A(n,!1),A(t,!0);const i=e.taxa,a=Object.values(i).reduce((e,t)=>e+t);document.querySelector(".fossils-found[lang=en]").innerHTML=a.toLocaleString(),document.querySelector(".fossils-found[lang=es]").innerHTML=a.toLocaleString("es"),function(e){let t={"Clams, oysters":{fileName:"clam",category:"invertebrate",es:"Almejas, ostras, vieiras",en:"Clams, oysters, scallops"},Snails:{fileName:"snail",category:"invertebrate",es:"Caracoles",en:"Snails"},"Sea urchins":{fileName:"urchin",category:"invertebrate",es:"Erizos de mar",en:"Sea urchins"},Worms:{fileName:"worm",category:"invertebrate",es:"Gusanos",en:"Worms"},"Crabs, shrimps":{fileName:"crab",category:"invertebrate",es:"Cangrejos, camarones",en:"Crabs, shrimp"},Nautiloids:{fileName:"ammonoid",category:"invertebrate",es:"Ammoniodeos, nautiloideos, pulpos",en:"Ammonoids, nautiloids, octopuses"},Corals:{fileName:"coral",category:"invertebrate",es:"Corales",en:"Corals"},Barnacles:{fileName:"barnacle",category:"invertebrate",es:"Percebes",en:"Barnacles"},Scaphopods:{fileName:"scaphopod",category:"invertebrate",es:"Conchas colmillo",en:"Tusk shells"},"Sharks, rays":{fileName:"shark",category:"vertebrate",es:"Tiburones, rayas",en:"Sharks, rays"},Fish:{fileName:"fish",category:"vertebrate",es:"Peces",en:"Fish"},Birds:{fileName:"bird",category:"vertebrate",es:"Aves",en:"Birds"},"Whales, dolphins":{fileName:"whale",category:"vertebrate",es:"Ballenas, delfines",en:"Whales, dolphins"},Microfossils:{fileName:"magnifying-glass",category:"invertebrate",es:"Microfósiles",en:"Microfossils"},"Walruses, seals":{fileName:"walrus",category:"vertebrate",es:"Focas, otarios, morsas",en:"Seals, sea lions, walruses"}},n=document.createDocumentFragment(),i=document.createDocumentFragment();const a=document.getElementsByClassName("vert__list")[0],s=document.getElementsByClassName("invert__list")[0],o=Object.entries(e).sort((e,t)=>t[1]-e[1]);for(const e of o){let a,s;[a,s]=e;let o=document.createElement("div"),r=document.createElement("img");if(t[a]){const e=t[a].fileName,l=t[a].category,c=t[a].es,m=t[a].en;r.src=`/static/images/${e}.svg`;const d=document.createElement("p"),u=document.createElement("p");d.lang="en",u.lang="es",o.classList.add("taxa__cell"),r.classList.add("taxa__icon"),d.innerHTML=`${s.toLocaleString()}<br>${m}`,u.innerHTML=`${s.toLocaleString("es")}<br>${c}`,o.append(r,d,u),"invertebrate"===l?n.append(o):"vertebrate"===l&&i.append(o)}}s.append(n),a.append(i)}(i)}else A(t,!1),A(n,!0);if(e.photos.length>0){for(let e of o)e.classList.remove("button--removed");!function(e){!function(){const e=document.getElementsByClassName("splide__list")[0],t=document.getElementsByClassName("splide__pagination")[0];e.innerHTML="",t&&t.remove()}();const t=document.createDocumentFragment(),n=document.getElementsByClassName("splide__list")[0];e.forEach(e=>{const n=document.createElement("img"),i=document.createElement("li"),a=function(e){const t=document.createElement("p"),n=document.createElement("p"),i=document.createElement("p"),a=document.createElement("p"),s=document.createElement("div");return t.classList.add("caption__taxon"),i.classList.add("caption__description"),t.innerHTML=e.taxon,n.innerHTML=e.age.replace(" - ","-").toLowerCase(),i.innerHTML=e.description,a.innerHTML=`${e.display_id}`,s.classList.add("splide__captions"),s.append(i,t,n,a),s}(e);n.src=e.url,i.classList.add("splide__slide");const s=t.appendChild(i),o=document.createElement("div");o.className="splide__slide--imageContainer",s.appendChild(o).appendChild(n),s.appendChild(a)}),n.append(t),g=_(),L(e[0].point.coordinates),g.on("visible",t=>{const n=Array.from(t.slide.parentElement.children).indexOf(t.slide);L(e[n].point.coordinates)}),A(sliderDiv,!0)}(e.photos),A(i,!0),A(a,!1),A(s,!0)}else{for(let e of o)e.classList.add("button--removed");A(i,!1),A(s,!1)}S("#infoCard"),isMobile&&b.infoPane.present({animate:!0}),0===e.endDate&&(e.endDate=.0117),function(e,t){const n=document.getElementById("indicator"),i=document.getElementsByClassName("timescale__container")[0],a=(e=e>100?100:e)-t;n.style.right=t/100*100+"%";const s=i.clientWidth/100;n.style.width=s*a+"px"}(e.startDate,e.endDate),function(e,t){let n,i;[n,i]=document.getElementsByClassName("time__range"),e>1&&t>1?(t=t.toFixed(0),e=e.toFixed(0),n.innerHTML=`${t}-${e} million years old`,i.innerHTML=`${t} y ${e} millones de años de antigüedad.`):e>1&&t<1?(t=(1e3*t).toFixed(0),e=e.toFixed(0),n.innerHTML=`${t} thousand-${e} million years old`,i.innerHTML=`${t} miles y ${e} millones de años de antigüedad.`):e<1&&t<1&&(t=(1e3*t).toFixed(0),e=(1e3*e).toFixed(0),n.innerHTML=`${t}-${e} thousands of years old`,i.innerHTML=`${t} y ${e} miles de años de antigüedad.`)}(e.startDate,e.endDate),$(".card__content").animate({scrollTop:10},50)}(t):function(e){if(isMobile)C(document.getElementsByClassName("info-card__content")[0]),S(document.getElementsByClassName("null-card__content")[0]);else{const e=document.getElementById("infoCard");"none"!=e.style.display?(C(e),setTimeout(()=>{S("#noInfoCard")},550)):S("#noInfoCard")}for(let t of document.getElementsByClassName("featureName"))t.innerText=e}(e.attributes.name)}),E(e.attributes)}(e.results[0].graphic):N()})}(e)});const T=document.getElementById("languageSwitch");function C(e){const t="object"==typeof e?e:document.querySelector(e);t.classList.remove("card--active"),setTimeout(()=>{M(t,!1)},550)}function S(e){const t="object"==typeof e?e:document.querySelector(e);M(t,!0),setTimeout(()=>{t.classList.add("card--active")},5)}function B(){b.view.graphics.removeAll(),b.areaGraphics.graphics.removeAll(),b.selectedPhotoGraphicsLayer.removeAll(),b.highlight?b.highlight.remove():b.highlight}function A(e,t){e.style.display=t?"flex":"none"}function M(e,t){e.style.display=t?"inline-block":"none"}function I(){const e=document.getElementsByClassName("instructions")[0],t=document.getElementsByClassName("instructions__container")[0];e.classList.add("instructions--inactive"),t.classList.add("instructions--inactive"),setTimeout(()=>{t.style.display="None"},750)}T.addEventListener("change",()=>{T.checked?document.body.setAttribute("lang","es"):document.body.setAttribute("lang","en")}),document.addEventListener("click",I,{once:!0})});