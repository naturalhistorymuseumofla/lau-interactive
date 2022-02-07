from flask import Flask, render_template, request
from data.database import global_init
from data.database import Area
from data.update import update
from datetime import datetime
from whitenoise import WhiteNoise

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


@app.route("/query", methods=["GET", "POST"])
def query():
    if request.method == 'POST':
        feature = request.json
        #feature_name = feature['name']
        region = feature['region']
        latitude = feature['latitude']
        longitude = feature['longitude']
        #feature_query = Area.objects(name=feature_name, region=feature_region)
        feature_query = Area.objects(geometry__geo_intersects=[longitude, latitude], region=region)
        if feature_query:
            response = feature_query[0].export()
        else:
            response = ''
        return response


@app.route("/")
def home():
    return render_template("index.html")


if __name__ == "__main__":
    global_init()
    files = ['./static/css/styles.css', './static/js/app.js']
    app.run(debug=True,
            extra_files=files)

