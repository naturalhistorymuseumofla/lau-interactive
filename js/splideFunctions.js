/* ==========================================================
  Function to reset Splide widget
  ========================================================== */
var splide;
function resetSplide() {
  sliderDiv.innerHTML="";
  let splideTrack = document.createElement("div")
  let splideList = document.createElement("ul")
  let header = document.createElement("h1");
  header.innerHTML="Swipe to see local fossils"
  sliderDiv.appendChild(header)
  sliderDiv.appendChild(splideTrack);
  splideTrack.appendChild(splideList);
  splideTrack.classList.add("splide__track")
  splideList.classList.add("splide__list")  
};

function formatHTMLForSplide(attachment) {
  var img = document.createElement("img");
  var li = document.createElement("li");
  var splideList = document.getElementsByClassName("splide__list")[0];
  
  // Retreive and format catalog number and taxon from attachment filename
  var catNumber, taxon;
  var [catNumber, taxon] = attachment.name.slice(0,-4).split("-");
  var splitCatNumber = catNumber.split("_")
  if (splitCatNumber.length === 3) {
    catNumber = " (" + splitCatNumber[0] + " " + splitCatNumber[1] + "." + splitCatNumber[2] + ")"
  } else {
    var catNumber = " (" + splitCatNumber.join(" ") + ")"
  }
  var boldTaxon = document.createElement("b");
  boldTaxon.innerHTML = taxon.replace("_", " ");
  var slideText = document.createTextNode(catNumber);

  // Format HTML for Splide carousel
  li.classList.add("splide__slide")
  li.classList.add(attachment.parentObjectId)
  img.src = attachment.url

  var newSlide = splideList.appendChild(li)
  var div = document.createElement("div")
  div.className = "splide__slide--imageContainer"


  newSlide.appendChild(div).appendChild(img)
  newSlide.appendChild(boldTaxon)
  newSlide.appendChild(slideText)
}

function newSplide() {
  splide = new Splide('.splide',{
    lazyLoad: true
  }).mount()
} 




export{resetSplide, formatHTMLForSplide, newSplide, splide}