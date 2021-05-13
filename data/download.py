# Updates mongoDB collections with new data from hosted feature layers used in the
# LAU map interactive.
from arcgis.gis import GIS
import pandas as pd
import os
from datetime import datetime
from json import dumps
import geojson
from pprint import pprint


# Checks to see if json exists and is up to date
def download_json(feature, fp):
    if os.path.exists(fp):
        file_modified = datetime.fromtimestamp(os.path.getmtime(fp))
        feature_modified = datetime.fromtimestamp(feature.modified / 1e3)
        is_uptodate = file_modified < feature_modified
        if not is_uptodate:
            save_geojson(feature, fp)
    else:
        save_geojson(feature, fp)


# Retrieves geojson string from feature collection object
def save_geojson(feature, fp):
    feature_geojson = feature.layers[0].query().to_geojson
    print(feature_geojson)
    with open(fp, 'w+') as f:
        f_geojson = geojson.loads(feature_geojson)
        geojson.dump(f_geojson, f)


# Gets feature object from arcgis online
def get_feature(id):
    feature = gis.content.get(id)
    return feature


if __name__ == "__main__":
    update()
    gis = GIS()
    areas_id = '40b3507b1ed4443b87807e7d2be4afd2'
    areas = get_feature(areas_id)
    download_json(areas, r'layers/areas.geojson')





