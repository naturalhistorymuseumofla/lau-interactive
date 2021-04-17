from flask import Flask, render_template, request
from arcgis.gis import GIS
from arcgis.geometry.filters import intersects
import shapely
import requests
import urllib.parse
from datetime import datetime
from mongoengine import Document, EmbeddedDocument
from mongoengine import connect
from mongoengine.fields import (
    DateTimeField,
    URLField,
    StringField,
    ObjectIdField,
    IntField,
    DictField,
    ListField,
    FloatField,
    EmbeddedDocumentListField
)

app = Flask(__name__)


db = connect(db="lau-test")


class FossilPhotos(EmbeddedDocument):
    uid = ObjectIdField(required=True, unique=True, primary_key=True),
    url = URLField(required=True),
    age = FloatField(),
    description = StringField()


class LocalityQuery(Document):
    uid = ObjectIdField(required=True, unique=True, primary_key=True),
    updated = DateTimeField(required=True)
    name = StringField(required=True),
    sites = IntField(required=True),
    fossils = IntField(required=True),
    underwater_age = FloatField(),
    taxa = DictField(),
    photos = EmbeddedDocumentListField(FossilPhotos)


gis = GIS('https://nhmlac.maps.arcgis.com/', 'dmarkbreiter_NHMLAC', 'j5BDj%k3@BaG')
localities = gis.content.get('2b5d6edf8da849859c4f17a89ca63f6e')
localitiesLayer = localities.layers[0]

counties = gis.content.get('b9b1d3b98101472da80c1bbbd1231e9b').layers[0]
regions = gis.content.get('c55c024180224f8990c94c3960c9fea3').layers[0]
neighborhoods = gis.content.get('a6a65c4af91448bc8e1d674c6fb7e51d').layers[0]


@app.route("/")
def home():
    return render_template("index.html")



@app.route("/json", methods=["GET", "POST"])
def json():
    if request.method == 'POST':
        feature = request.json
        geometry = get_feature_geometry(feature["regionType"], feature["oid"])
        filter = intersects(geometry, sr=localities['spatialReference'])
        results = localitiesLayer.query(geometry_filter=filter)
        intersected_features = results.features
        return process_info(intersected_features)
        

def process_info(features):
    fossils_found = len(features)
    object_ids = [x.attributes['OBJECTID'] for x in features]
    taxa = [x.attributes['taxa'] for x in features]
    response = {
        'fossilsFound': fossils_found,
        'taxa': taxa,
        'oids': object_ids
    }
    return response


# Gets geometry of selected feature using a query on the feature layer
def get_feature_geometry(region_type, oid):
    regions_dict = {
        "Counties": counties,
        "Regions": regions,
        "Neighborhoods": neighborhoods
    }
    area = regions_dict[region_type]
    selected_fset = area.query(object_ids=oid)
    geometry = selected_fset.features[0].geometry
    return geometry

        

#.json["globalId"]} was sucesfully recevied'


@app.route("/salvador")
def salvador():
    return "Hello, Salvador"


if __name__ == "__main__":
    files = ['./static/css/styles.css', './static/js/app.js']
    app.run(debug=True, extra_files=files)
