
export { FossilSearch };
import { main } from "./app.js"

function FossilSearch (view) {
  require([
    "esri/widgets/Search/SearchViewModel",
    "esri/tasks/Locator",
    ], (SearchVM, Locator) => {
  this.search = new SearchVM({
      view: view,
      includeDefaultSources: true,
      maxSuggestions: 5,
      sources: [
        {
          locator: new Locator({
            url: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer",
          }),
          placeholder: "Search",
          outFields: ['Match_addr', 'Addr_type'],
          singleLineFieldName: "SingleLine", // Required for search to return results for impartial search terms
          name: "ArcGIS World Geocoding Service",
          filter: {
            geometry: view.constraints.geometry,
          },
        },
      ],
  });
  this.searchDiv = document.getElementsByClassName('search')[0];
  this.searchInput = document.getElementsByClassName('search__input')[0];
  this.suggestList = document.getElementsByClassName('search__suggest-list')[0];
  this.init = function () {
    this.searchInput.addEventListener('input', e => {
      this.search.suggest(this.searchInput.value).then(results => {
        let suggestions = results.results[0].results;
        this.suggestList.innerHTML = '';
        suggestions.forEach(suggestion => {
          const li = document.createElement('li');
          li.classList.add('search__suggest-list-item');
          li.setAttribute('role', 'option'); 
          const svg = '<span><svg class="map-icon" transform="translate(-6.63 -0.33)" viewBox="0 0 36.74 49.34"><path class="cls-1" d="M43.37,17.78C43.37,8.14,35.15.33,25,.33S6.63,8.14,6.63,17.78a16.74,16.74,0,0,0,2.93,9.44h0L23.48,48.86a1.83,1.83,0,0,0,3,0L40.45,27.22h0A16.74,16.74,0,0,0,43.37,17.78ZM25,25.39a7.1,7.1,0,1,1,7.09-7.09A7.09,7.09,0,0,1,25,25.39Z" transform="translate(-6.63 -0.33)"</svg></span>'
          li.innerHTML = `${svg}${suggestion.text}`;
          li.addEventListener('click', e => {
            this.search.search(li.textContent);
            this.searchInput.value = li.textContent;
          });
          this.suggestList.appendChild(li);
        });
      });
    });
    this.search.on('search-complete', e => {
      this.suggestList.innerHTML = '';
      this.removeSearchActive();
    });
    this.searchDiv.addEventListener('submit', e => {
      e.preventDefault();
      this.search.search(this.searchInput.value);
    });
    this.search.on('search-complete', e => {
      const feature = e.results[0].results[0].feature;
      main('', feature.geometry, true);
    });
  }

  this.addSearchActive = function () {
    document.body.setAttribute('search-active', 'true')
    document.getElementsByClassName('search__container')[0].setAttribute('search-active', 'true');
    document.getElementsByClassName('search__suggest')[0].setAttribute('search-active', 'true');
    this.searchDiv.setAttribute('search-active', 'true');
    this.searchInput.setAttribute('search-active', 'true');
    this.suggestList.setAttribute('search-active', 'true');
  }

 this.removeSearchActive = function(){
    document.body.setAttribute('search-active', 'false')
    document.getElementsByClassName('search__container')[0].setAttribute('search-active', 'false');
    document.getElementsByClassName('search__suggest')[0].setAttribute('search-active', 'false');
    this.searchDiv.setAttribute('search-active', 'false');
    this.searchInput.setAttribute('search-active', 'false');
    this.suggestList.setAttribute('search-active', 'false');
  }

  this.init();
  });
}


