

import { exportView } from "./app.js";

require([
  "esri/widgets/Search/SearchViewModel",
  "esri/tasks/Locator",
], (SearchVM, Locator) => {
  
  const search = new SearchVM({
    view: exportView,
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
          //geometry: exportView.constraints.geometry,
        },

      },
    ],
  });
  

  const searchDiv = document.getElementsByClassName('search')[0];
  const searchInput = document.getElementsByClassName('search__input')[0];
  const suggestList = document.getElementsByClassName('search__suggest-list')[0];

  searchInput.addEventListener('input', e => {
    search.suggest(searchInput.value).then(results => {
      let suggestions = results.results[0].results;
      suggestList.innerHTML = '';
      console.log(suggestions);
      suggestions.forEach(suggestion => {
        const li = document.createElement('li');
        li.classList.add('search__suggest-list-item');
        li.innerHTML = suggestion.text;
        suggestList.appendChild(li);
      })
    })
  });

  searchDiv.addEventListener('submit', e => {
    e.preventDefault();
    search.search(searchInput.value).then(results => {
      console.log(results);
    }).catch(error => {
      console.log(error);
    });
  });

});
