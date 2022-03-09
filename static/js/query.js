
    async function getQuery(feature) {
      const queryObject = {
        'region': feature.attributes.region_type,
        'name': feature.attributes.name,
      }
      let response = await fetch('/query', {
        method: 'POST',
        headers: {'Content-Type': 'application/json;charset=utf-8'},
        body: JSON.stringify(queryObject)
      });
      let data = await response.text()
      if (data) {
        return JSON.parse(data);
      } else {
        return data;
      }
    }