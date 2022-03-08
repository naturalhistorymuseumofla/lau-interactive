from flask import Flask, render_template, request
from data.database import global_init
from data.database import Area
from data.update import update
from datetime import datetime
from whitenoise import WhiteNoise
from random import sample
from bson.json_util import dumps

app = Flask(__name__)
app.wsgi_app = WhiteNoise(app.wsgi_app)
my_static_folders = (
    './static/css/',
    './static/images/',
    './static/js/',
    './static/layers/'
)
for static in my_static_folders:
    app.wsgi_app.add_files(static)


def export_area(area):
    photos = [x.to_mongo().to_dict() for x in area.photos]
    if len(photos) > 7:
        photos = sample(photos, 7)
    response_dict = {
        'name': area.name,
        'region': area.region,
        'number_of_sites': area.number_of_sites,
        'number_of_specimens': area.number_of_specimens,
        'taxa': area.taxa,
        'photos': photos,
        'startDate': area.handle_nan(area.start_date),
        'endDate': area.handle_nan(area.end_date),
        'oids': area.oids,
        'geometry': area.geometry
    }
    return dumps(response_dict)

@app.route("/spatial-query", methods=["GET", "POST"])
def query():
    if request.method == 'POST':
        feature = request.json
        #feature_name = feature['name']
        region = feature['region']
        latitude = feature['latitude']
        longitude = feature['longitude']
        #feature_query = Area.objects(name=feature_name, region=feature_region)
        if feature['selectedFeature']:
            feature_query = Area.objects(name=feature['selectedFeature']['name'], region=feature['selectedFeature']['region'])
        else:
            feature_query = Area.objects(geometry__geo_intersects=[longitude, latitude], region=region)
        if feature_query:
            response = export_area(feature_query[0])
        else:
            response = ''
        return response




@app.route("/")
def home():
    return render_template("index.html")

@app.route("/exhibit")
def exhibit():
    return render_template("exhibit-index.html")


if __name__ == "__main__":
    global_init()
    files = ['./static/css/styles.css', './static/js/app.js', './static/js/exhibit-app.js']
    app.run(debug=True,
            #host='192.168.1.89',
            extra_files=files)

