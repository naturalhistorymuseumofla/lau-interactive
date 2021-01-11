function loadJSON(callback) {   
  var xobj = new XMLHttpRequest();
      xobj.overrideMimeType("application/json");
  xobj.open('GET', 'captions.json', true); 
  xobj.onreadystatechange = function () {
        if (xobj.readyState == 4 && xobj.status == "200") {
          callback(xobj.responseText);
        }
  };
  xobj.send(null);  
}

function removeFileExtension(fileName) {
  return fileName.substr(0, fileName.lastIndexOf("."))
}

/* ==========================================================
  Function to reset Splide widget
  ========================================================== */
var splide;
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


function formatHTMLForSplide(attachment) {
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




export{resetSplide, formatHTMLForSplide, newSplide, splide}