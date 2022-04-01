var isMobile=screen.height<719||screen.width<1023;isMobile&&document.documentElement.setAttribute("data-mobile","true"),require(["esri/Map","esri/views/MapView","esri/layers/FeatureLayer","esri/layers/GeoJSONLayer","esri/layers/GraphicsLayer","esri/Graphic","esri/Basemap","esri/layers/VectorTileLayer","esri/widgets/Zoom/ZoomViewModel","esri/layers/support/LabelClass","esri/views/2d/layers/BaseLayerViewGL2D","esri/core/promiseUtils","esri/core/watchUtils","esri/geometry/support/webMercatorUtils"],function(e,t,n,i,a,s,o,r,l,c,m,d,u,h){var f=w();const g=m.createSubclass({aPosition:0,aOffset:1,constructor:function(){this.transform=mat3.create(),this.translationToCenter=vec2.create(),this.screenTranslation=vec2.create(),this.display=mat3.fromValues(NaN,0,0,0,NaN,0,-1,1,1),this.screenScaling=vec3.fromValues(NaN,NaN,1),this.needsUpdate=!1;const e=()=>{this.needsUpdate=!0,this.requestRender()};this.watcher=u.on(this,"layer.graphics","change",e,e,e)},attach:function(){const e=this.context,t=e.createShader(e.VERTEX_SHADER);e.shaderSource(t,"\n        precision highp float;\n        uniform mat3 u_transform;\n        uniform mat3 u_display;\n        attribute vec2 a_position;\n        attribute vec2 a_offset;\n        varying vec2 v_offset;\n        const float SIZE = 55.0;\n        void main(void) {\n            gl_Position.xy = (u_display * (u_transform * vec3(a_position, 1.0) + vec3(a_offset * SIZE, 0.0))).xy;\n            gl_Position.zw = vec2(0.0, 1.0);\n            v_offset = a_offset;\n        }"),e.compileShader(t);const n=e.createShader(e.FRAGMENT_SHADER);e.shaderSource(n,"\n        precision highp float;\n        uniform float u_current_time;\n        varying vec2 v_offset;\n        const float PI = 3.14159;\n        const float N_RINGS = 2.0;\n        const vec3 COLOR = vec3(0.95, 0.92, 0.33);\n        const float FREQ = 0.35;\n        void main(void) {\n            float l = length(v_offset);\n            float intensity = clamp(cos(l * PI), 0.0, 1.0) * clamp(cos(2.0 * PI * (l * 2.0 * N_RINGS - FREQ * u_current_time)), 0.0, 1.0);\n            gl_FragColor = vec4(COLOR * intensity, intensity);\n        }"),e.compileShader(n),this.program=e.createProgram(),e.attachShader(this.program,t),e.attachShader(this.program,n),e.bindAttribLocation(this.program,this.aPosition,"a_position"),e.bindAttribLocation(this.program,this.aOffset,"a_offset"),e.linkProgram(this.program),e.deleteShader(t),e.deleteShader(n),this.uTransform=e.getUniformLocation(this.program,"u_transform"),this.uDisplay=e.getUniformLocation(this.program,"u_display"),this.uCurrentTime=e.getUniformLocation(this.program,"u_current_time"),this.vertexBuffer=e.createBuffer(),this.indexBuffer=e.createBuffer(),this.indexBufferSize=0,this.centerAtLastUpdate=vec2.fromValues(this.view.state.center[0],this.view.state.center[1])},detach:function(){this.watcher.remove();const e=this.context;e.deleteBuffer(this.vertexBuffer),e.deleteBuffer(this.indexBuffer),e.deleteProgram(this.program)},render:function(e){const t=e.context,n=e.state;this.updatePositions(e),0!==this.indexBufferSize&&(mat3.identity(this.transform),this.screenTranslation[0]=n.pixelRatio*n.size[0]/2,this.screenTranslation[1]=n.pixelRatio*n.size[1]/2,mat3.translate(this.transform,this.transform,this.screenTranslation),mat3.rotate(this.transform,this.transform,Math.PI*n.rotation/180),this.screenScaling[0]=n.pixelRatio/n.resolution,this.screenScaling[1]=-n.pixelRatio/n.resolution,mat3.scale(this.transform,this.transform,this.screenScaling),mat3.translate(this.transform,this.transform,this.translationToCenter),this.display[0]=2/(n.pixelRatio*n.size[0]),this.display[4]=-2/(n.pixelRatio*n.size[1]),t.useProgram(this.program),t.uniformMatrix3fv(this.uTransform,!1,this.transform),t.uniformMatrix3fv(this.uDisplay,!1,this.display),t.uniform1f(this.uCurrentTime,performance.now()/1e3),t.bindBuffer(t.ARRAY_BUFFER,this.vertexBuffer),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,this.indexBuffer),t.enableVertexAttribArray(this.aPosition),t.enableVertexAttribArray(this.aOffset),t.vertexAttribPointer(this.aPosition,2,t.FLOAT,!1,16,0),t.vertexAttribPointer(this.aOffset,2,t.FLOAT,!1,16,8),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.drawElements(t.TRIANGLES,this.indexBufferSize,t.UNSIGNED_SHORT,0),this.requestRender())},hitTest:function(e,t){const n=this.view;if(0===this.layer.graphics.length)return d.resolve(null);const i=this.layer.graphics.map(i=>{const a=n.toScreen(i.geometry);return Math.sqrt((a.x-e)*(a.x-e)+(a.y-t)*(a.y-t))});let a=0;if(i.forEach((e,t)=>{e<i.getItemAt(a)&&(a=t)}),i.getItemAt(a)>35)return d.resolve(null);const s=this.layer.graphics.getItemAt(a);return s.sourceLayer=this.layer,d.resolve(s)},updatePositions:function(e){const t=e.context,n=e.stationary,i=e.state;if(!n)return vec2.sub(this.translationToCenter,this.centerAtLastUpdate,i.center),void this.requestRender();if(!this.needsUpdate&&0===this.translationToCenter[0]&&0===this.translationToCenter[1])return;this.centerAtLastUpdate.set(i.center),this.translationToCenter[0]=0,this.translationToCenter[1]=0,this.needsUpdate=!1;const a=this.layer.graphics;t.bindBuffer(t.ARRAY_BUFFER,this.vertexBuffer);const s=new Float32Array(16*a.length);let o=0;a.forEach(e=>{const t=e.geometry,n=t.x-this.centerAtLastUpdate[0],i=t.y-this.centerAtLastUpdate[1];s[16*o+0]=n,s[16*o+1]=i,s[16*o+2]=-.5,s[16*o+3]=-.5,s[16*o+4]=n,s[16*o+5]=i,s[16*o+6]=.5,s[16*o+7]=-.5,s[16*o+8]=n,s[16*o+9]=i,s[16*o+10]=-.5,s[16*o+11]=.5,s[16*o+12]=n,s[16*o+13]=i,s[16*o+14]=.5,s[16*o+15]=.5,++o}),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,this.indexBuffer);let r=new Uint16Array(6*a.length);for(let e=0;e<a.length;++e)r[6*e+0]=4*e+0,r[6*e+1]=4*e+1,r[6*e+2]=4*e+2,r[6*e+3]=4*e+1,r[6*e+4]=4*e+3,r[6*e+5]=4*e+2;t.bufferData(t.ELEMENT_ARRAY_BUFFER,r,t.STATIC_DRAW),this.indexBufferSize=r.length}}),p=a.createSubclass({createLayerView:function(e){if("2d"===e.type)return new g({view:e,layer:this})}});var y=function(){var s=new o({baseLayers:[new r({portalItem:{id:"43ed5ecba7dd4a75b1395c2f3fa3951b"},blendMode:"multiply"})]}),m=new e({basemap:s});const d=function(){const e=window.screen.width,t=window.screen.height;window.devicePixelRatio;return t*e<8e5?7:8}(),u=function(){const e=window.screen.width,t=window.screen.height*e;return t>7e5?7e5+.25*(1e6-t/2):1e6-t/2+7e5}();var h=new t({container:"viewDiv",map:m,center:[-118.215,34.225],scale:u,constraints:{snapToZoom:!1,rotationEnabled:!1,minZoom:d,maxZoom:14,geometry:{type:"extent",xmin:-121.5,ymin:32.7,xmax:-114.7,ymax:36}},popup:{autoOpenEnabled:!1},highlightOptions:{color:[42,208,212,.75],fillOpacity:.4},ui:{components:[]}});const f=new l({view:h}),g={type:"simple",symbol:{type:"simple-fill",style:"none",outline:{color:[15,15,15,.75],width:"2px"}}},y=new c({labelExpressionInfo:{expression:"$feature.NAME"},symbol:{type:"text",color:"rgb(199, 199, 199))",haloSize:.5,haloColor:"rgb(66,66,66)",font:{family:"Avenir Next LT Pro Regular",weight:"bold",size:13}}}),b=new c({labelExpressionInfo:{expression:"$feature.NAME"},symbol:{type:"text",color:"rgb(199, 199, 199)",haloSize:.5,haloColor:"rgb(66,66,66)",deconflictionStrategy:"static",font:{family:"Avenir Next LT Pro Regular",weight:"normal",size:9.5}}}),v=new c({labelExpressionInfo:{expression:"Replace(Trim($feature.name), ' ', TextFormatting.NewLine)"},symbol:{type:"text",color:"rgb(199, 199, 199)",haloSize:.5,haloColor:"rgb(66,66,66)",deconflictionStrategy:"static",font:{family:"Avenir Next LT Pro Regular",weight:"bold",size:9}}});const L=new n({title:"Areas",spatialReference:{wkid:4326},fields:[{name:"region_type",alias:"Region Type",type:"string"},{name:"objectId",alias:"ObjectId",type:"oid"},{name:"name",alias:"Name",type:"string"},{name:"legacyId",alias:"Legacy object ID",type:"string"}],objectIdField:"objectId",geometryType:"polygon",outFields:["*"],source:[],renderer:g,labelingInfo:[v]}),_=new i({url:"/static/layers/lauLocalities.geojson",renderer:{type:"simple",symbol:{type:"simple-marker",size:6,color:[67,120,116,.5],outline:{width:0,color:[67,120,116,.1]}}}}),w=new i({url:"/static/layers/lauCountiesSimplified.geojson",maxScale:6e5,labelingInfo:[y],renderer:g,title:"county",outFields:["name","OBJECTID_1","OBJECTID","region_type"]}),E=new i({url:"/static/layers/lauRegionsSimplified.geojson",minScale:6e5,maxScale:188895,labelingInfo:[b],renderer:g,title:"region",outFields:["name","OBJECTID","region_type","parent_region"]}),S=new n({url:"https://services3.arcgis.com/pIjZlCuGxnW1cJpM/arcgis/rest/services/lauNeighborhoodsSimplified/FeatureServer",minScale:188895,labelingInfo:[b],renderer:g,title:"neighborhood",outFields:["name","region_type","parent_region"]}),x=new n({url:"https://services3.arcgis.com/pIjZlCuGxnW1cJpM/arcgis/rest/services/lauAreasView/FeatureServer",renderer:g,labelingInfo:[v],title:"area",outFields:["*"]}),T=isMobile?new a:new a({effect:"drop-shadow(0px, 2px, 2px rgba(63, 153, 149, 0.75))"}),N=new a,C=new p,B=[N,S,E,w,L,x,T,_,C];var A;m.addMany(B),isMobile&&(A=new CupertinoPane(".cupertino-pane",{parentElement:".ui-top-left",breaks:{middle:{enabled:!1,height:300},bottom:{enabled:!0,height:100,bounce:!0}},cssClass:"card--active",simulateTouch:!0,initialBreak:"bottom",buttonDestroy:!1,onDrag:()=>console.log("Drag event")}));var M={map:m,view:h,basemap:s,scale:u,zoomViewModel:f,areaGraphics:T,countiesLayer:w,regionsLayer:E,neighborhoodsLayer:S,intersectingGraphicsLayer:N,selectedPhotoGraphicsLayer:C,clientFeatureLayer:L,areasView:"",areasLayer:x,infoPane:A};h.whenLayerView(x).then(e=>{M.areasView=e,M.areasView.visible=!1}),h.whenLayerView(_).then(e=>{M.localitiesView=e});for(let e of document.getElementsByClassName("widget"))e.style.opacity="1";var I=document.getElementsByClassName("ui-container");for(let e of I)h.ui.add(e);return M}();function b(){T(),y.view.goTo({center:[-118.215,34.225],scale:y.scale},{animate:!0,duration:400,ease:"ease-in"}),isMobile&&y.infoPane.destroy();const e=document.getElementsByClassName("instructions")[0],t=document.getElementsByClassName("instructions__container")[0];M(t,!0),M(e,!0),e.classList.remove("instructions--inactive"),t.classList.remove("instructions--inactive"),document.addEventListener("click",R,{once:!0})}function v(e){!function(e){const t=e.geometry,n=e.attributes.name,i=-t.extent.width/2,a={animate:!0,duration:800,ease:"ease-in"},s={true:{"Los Angeles":{center:[-118.3,34.25],scale:L(e)},"Santa Barbara":{center:[-120.1,34.8]},default:{center:t}},false:{"Los Angeles":{center:[-118.735491,34.222515],scale:L(e)},Ventura:{center:[-119.254898,34.515522],scale:L(e)},default:{center:t.extent.expand(2).offset(i,0)}}};n in s[isMobile]?y.view.goTo(s[isMobile][n],a).catch(function(e){"AbortError"!=e.name&&console.error(e)},a):y.view.goTo(s[isMobile].default,a).catch(function(e){"AbortError"!=e.name&&console.error(e)},a)}(e),function(e){const t=new s({geometry:e,symbol:{type:"simple-fill",color:[73,128,123,.15],outline:{color:[73,128,123,1],width:4}}});y.areaGraphics.graphics.removeAll(),y.areaGraphics.graphics.add(t)}(e.geometry),async function(e){const t={region:e.attributes.region_type,name:e.attributes.name};let n=await fetch("/query",{method:"POST",headers:{"Content-Type":"application/json;charset=utf-8"},body:JSON.stringify(t)}),i=await n.text();return i?JSON.parse(i):i}(e).then(t=>{t?function(e){const t=document.getElementsByClassName("taxa--info")[0],n=document.getElementsByClassName("taxa--null")[0],i=document.getElementById("photos"),a=document.getElementsByClassName("photos--null")[0],s=document.getElementsByClassName("photo-indicator")[0];let o=document.getElementsByClassName("photos__button"),r=document.getElementsByClassName("time__button");isMobile?(C(document.getElementsByClassName("null-card__content")[0]),document.getElementsByClassName("info-card__content")[0].style.display="block"):C("#noInfoCard");y.highlight?y.highlight.remove():y.highlight,y.highlight=y.localitiesView.highlight(e.oids);for(let t of document.getElementsByClassName("featureName"))t.innerText=e.name;document.querySelector(".excavation-number[lang=en]").innerHTML=`${e.number_of_sites.toLocaleString()}`,document.querySelector(".excavation-number[lang=es]").innerHTML=`${e.number_of_sites.toLocaleString("es")}`;const l=document.getElementsByClassName("taxa__list");for(let e of l)e.innerHTML="";if(e.number_of_specimens>0){M(n,!1),M(t,!0);const i=e.taxa,a=Object.values(i).reduce((e,t)=>e+t);document.querySelector(".fossils-found[lang=en]").innerHTML=a.toLocaleString(),document.querySelector(".fossils-found[lang=es]").innerHTML=a.toLocaleString("es"),function(e){let t={"Clams, oysters":{fileName:"clam",category:"invertebrate",es:"Almejas, ostras, vieiras",en:"Clams, oysters, scallops"},Snails:{fileName:"snail",category:"invertebrate",es:"Caracoles",en:"Snails"},"Sea urchins":{fileName:"urchin",category:"invertebrate",es:"Erizos de mar",en:"Sea urchins"},Worms:{fileName:"worm",category:"invertebrate",es:"Gusanos",en:"Worms"},"Crabs, shrimps":{fileName:"crab",category:"invertebrate",es:"Cangrejos, camarones",en:"Crabs, shrimp"},Nautiloids:{fileName:"ammonoid",category:"invertebrate",es:"Ammonoideos, nautiloideos, pulpos",en:"Ammonoids, nautiloids, octopuses"},Corals:{fileName:"coral",category:"invertebrate",es:"Corales",en:"Corals"},Barnacles:{fileName:"barnacle",category:"invertebrate",es:"Percebes",en:"Barnacles"},Scaphopods:{fileName:"scaphopod",category:"invertebrate",es:"Conchas colmillo",en:"Tusk shells"},"Sharks, rays":{fileName:"shark",category:"vertebrate",es:"Tiburones, rayas",en:"Sharks, rays"},Fish:{fileName:"fish",category:"vertebrate",es:"Peces",en:"Fish"},Birds:{fileName:"bird",category:"vertebrate",es:"Aves",en:"Birds"},"Whales, dolphins":{fileName:"whale",category:"vertebrate",es:"Ballenas, delfines",en:"Whales, dolphins"},Microfossils:{fileName:"magnifying-glass",category:"invertebrate",es:"Microfósiles",en:"Microfossils"},"Walruses, seals":{fileName:"walrus",category:"vertebrate",es:"Focas, otarios, morsas",en:"Seals, sea lions, walruses"}},n=document.createDocumentFragment(),i=document.createDocumentFragment();const a=document.getElementsByClassName("vert__list")[0],s=document.getElementsByClassName("invert__list")[0],o=Object.entries(e).sort((e,t)=>t[1]-e[1]);for(const e of o){let a,s;[a,s]=e;let o=document.createElement("div"),r=document.createElement("img");if(t[a]){const e=t[a].fileName,l=t[a].category,c=t[a].es,m=t[a].en;r.src=`/static/images/${e}.svg`;const d=document.createElement("p"),u=document.createElement("p");d.lang="en",u.lang="es",o.classList.add("taxa__cell"),r.classList.add("taxa__icon"),d.innerHTML=`${s.toLocaleString()}<br>${m}`,u.innerHTML=`${s.toLocaleString("es")}<br>${c}`,o.append(r,d,u),"invertebrate"===l?n.append(o):"vertebrate"===l&&i.append(o)}}s.append(n),a.append(i)}(i)}else M(t,!1),M(n,!0);if(e.photos.length>0){for(let e of o)e.classList.remove("button--removed");!function(e){!function(){const e=document.getElementsByClassName("splide__list")[0],t=document.getElementsByClassName("splide__pagination")[0];e.innerHTML="",t&&t.remove()}();const t=document.createDocumentFragment(),n=document.getElementsByClassName("splide__list")[0];e.forEach(e=>{const n=document.createElement("img"),i=document.createElement("li"),a=function(e){const t=document.createElement("p"),n=document.createElement("p"),i=document.createElement("p"),a=document.createElement("div");t.classList.add("caption__taxon"),n.classList.add("caption__description"),t.innerHTML=e.taxon;const[s,o]=function(e){const t=document.createElement("p"),n=document.createElement("p");t.setAttribute("lang","en"),n.setAttribute("lang","es");const i=e.start_age,a=e.end_age,s=a>=1?a.toLocaleString():(1e6*a).toLocaleString(),o=a>=1?a.toLocaleString("es"):(1e6*a).toLocaleString("es"),r=i>=1?i.toLocaleString():(1e6*i).toLocaleString(),l=i>=1?i.toLocaleString("es"):(1e6*i).toLocaleString("es");i>=1&&a>=1?(t.innerHTML=`${s}–${r} million years old`,n.innerHTML=`Entre ${s} y ${r} millones de años`):i<1&&a<1?(t.innerHTML=`${s}–${r} thousand years old`,n.innerHTML=`Entre ${o} y ${l} miles de años`):i>=1&&a<1?(t.innerHTML=`${s} thousand years – ${r} million years old`,n.innerHTML=`Entre ${o} miles y ${l} millones de años`):a||(t.innerHTML=i>1?`${r} million years old`:`${r} thousand years old`,n.innerHTML=i>1?`${l} millones de años`:`${r} millones de años`);return[t,n]}(e),[r,l]=function(e){const t=document.createElement("p"),n=document.createElement("p");return t.classList.add("caption__description"),n.classList.add("caption__description"),t.setAttribute("lang","en"),n.setAttribute("lang","es"),t.innerHTML=e.description,n.innerHTML="Fósil de "+{Ammonoid:"ammonoideo",Barnacle:"percebes",Bird:"ave",Clam:"almejas",Coral:"coral",Crab:"cangrejo",Desmostylian:"desmostylia",Diatom:"diatomea",Dolphin:"delfín",Fish:"pez",Microfossil:"microfósiles",Nautiloid:"nautiloideo",Oyster:"ostra",Ray:"raya",Scallop:"vieira",Scaphopod:"conchas colmillo",Seal:"foca","Sea lion":"otario","Sea urchin":"erizo de mar",Shark:"tiburones",Shrimp:"camarón",Snail:"caracol",Turtle:"tortuga",Walrus:"morsa",Whale:"ballena",Worm:"gusano"}[e.common_name],[t,n]}(e);return i.innerHTML=`${e.display_id}`,a.classList.add("splide__captions"),a.append(r,l,t,s,o,i),a}(e);n.src="https://fossilmap.sfo3.cdn.digitaloceanspaces.com/images/"+e.key+"_500px.png",i.classList.add("splide__slide");const s=t.appendChild(i),o=document.createElement("div");o.className="splide__slide--imageContainer",s.appendChild(o).appendChild(n),s.appendChild(a)}),n.append(t),f=w(),E(e[0].point.coordinates),f.on("visible",t=>{const n=Array.from(t.slide.parentElement.children),i=n.indexOf(t.slide);E(e[i].point.coordinates)}),M(sliderDiv,!0)}(e.photos),M(i,!0),M(a,!1),M(s,!0)}else{for(let e of o)e.classList.add("button--removed");M(i,!1),M(s,!1)}B("#infoCard"),isMobile&&y.infoPane.present({animate:!0});null!==e.endDate&&null!=e.startDate?(M(document.getElementById("time"),!0),_(r,!0),0===e.endDate&&(e.endDate=.0117),function(e,t){const n=document.getElementById("indicator"),i=document.getElementsByClassName("timescale__container")[0],a=(e=e>100?100:e)-t;n.style.right=`${t/100*100}%`;const s=i.clientWidth/100;n.style.width=`${s*a}px`}(e.startDate,e.endDate),function(e,t){let n,i;[n,i]=document.getElementsByClassName("time__range"),e>1&&t>1?(t=t.toFixed(0),e=e.toFixed(0),n.innerHTML=`${t}-${e} million years old`,i.innerHTML=`${t} y ${e} millones de años de antigüedad.`):e>1&&t<1?(t=(1e3*t).toFixed(0),e=e.toFixed(0),n.innerHTML=`${t} thousand-${e} million years old`,i.innerHTML=`${t} miles y ${e} millones de años de antigüedad.`):e<1&&t<1&&(t=(1e3*t).toFixed(0),e=(1e3*e).toFixed(0),n.innerHTML=`${t}-${e} thousands of years old`,i.innerHTML=`${t} y ${e} miles de años de antigüedad.`)}(e.startDate,e.endDate)):(M(document.getElementById("time"),!1),_(r,!1));(function(e){const t=document.getElementsByClassName("underwater__container")[0],n=document.getElementById("timeSeperator"),i=document.getElementById("time"),a=document.querySelector(".underwater__age[lang=en]"),s=document.querySelector(".underwater__age[lang=es]");M(t,!0),M(n,!0),i.style.minHeight="",e>=1?(a.innerHTML=`${e} million years ago`,s.innerHTML=`${e} millones de años de antigüedad`):e&&0!==e?(a.innerHTML=`${(1e5*e).toLocaleString()} thousand years ago`,s.innerHTML=`${(1e5*e).toLocaleString("es")} miles de años de antigüedad`):(M(t,!1),M(n,!1),i.style.minHeight="auto")})(e.immersion),$(".card__content").animate({scrollTop:10},50)}(t):function(e){if(isMobile)C(document.getElementsByClassName("info-card__content")[0]),B(document.getElementsByClassName("null-card__content")[0]);else{const e=document.getElementById("infoCard");"none"!=e.style.display?(C(e),setTimeout(()=>{B("#noInfoCard")},550)):B("#noInfoCard")}for(let t of document.getElementsByClassName("featureName"))t.innerText=e}(e.attributes.name)}),S(e.attributes)}function L(e){const t=e.geometry;let n=window.innerHeight*window.innerWidth;var i;if((i="Los Angeles"===e.attributes.name||"Ventura"===e.attributes.name?t.extent.height/4.15*t.extent.width:t.extent.height*t.extent.width)>9e7){return i/n*150}return i/n*1e3}function _(e,t){if(t)for(let t of e)t.classList.remove("button--removed");else for(let t of e)t.classList.add("button--removed")}function w(){return new Splide(".splide",{}).mount()}function E(e){var t=h.geographicToWebMercator({type:"point",longitude:e[0],latitude:e[1]});const n=new s({geometry:t,symbol:{type:"simple-marker",style:"circle",color:"orange",size:"12px",outline:{color:[255,255,0],width:2}}});y.selectedPhotoGraphicsLayer.removeAll(),y.selectedPhotoGraphicsLayer.add(n)}function S(e){const t=e.name;y.areasView.visible=!0,y.areasView.filter={where:"parent_region = '"+t+"'"}}var x=setInterval(b,6e4);function T(){S(""),A(),function(){const e=document.getElementsByClassName("content-card");for(let t of e)C(t);isMobile&&y.infoPane.hide({animate:!0})}(),M(document.getElementsByClassName("photo-indicator")[0],!1),y.view.focus()}document.addEventListener("click",function(e){clearInterval(x),x=setInterval(b,6e4),e.target.classList.contains("close-button")?T():"zoomIn"===e.target.id?y.zoomViewModel.zoomIn():"zoomOut"===e.target.id&&y.zoomViewModel.zoomOut()}),document.addEventListener("touchstart",function(e){clearInterval(x),x=setInterval(b,6e4),e.target.classList.contains("close-button")&&T()},{passive:!0}),document.addEventListener("mousewheel",function(){clearInterval(x),x=setInterval(b,6e4)}),y.view.on("click",function(e){!function(e){A();const t=[y.countiesLayer,y.regionsLayer,y.neighborhoodsLayer,y.areasLayer];y.view.hitTest(e,{include:t}).then(e=>{e.results[0]?v(e.results[0].graphic):T()})}(e)});const N=document.getElementById("languageSwitch");function C(e){const t="object"==typeof e?e:document.querySelector(e);t.classList.remove("card--active"),setTimeout(()=>{I(t,!1)},550)}function B(e){const t="object"==typeof e?e:document.querySelector(e);I(t,!0),setTimeout(()=>{t.classList.add("card--active")},5)}function A(){y.view.graphics.removeAll(),y.areaGraphics.graphics.removeAll(),y.selectedPhotoGraphicsLayer.removeAll(),y.highlight?y.highlight.remove():y.highlight}function M(e,t){e.style.display=t?"flex":"none"}function I(e,t){e.style.display=t?"inline-block":"none"}function R(){const e=document.getElementsByClassName("instructions")[0],t=document.getElementsByClassName("instructions__container")[0];e.classList.add("instructions--inactive"),t.classList.add("instructions--inactive"),setTimeout(()=>{t.style.display="None"},750)}N.addEventListener("change",()=>{N.checked?document.body.setAttribute("lang","es"):document.body.setAttribute("lang","en")}),document.addEventListener("click",R)});