from flask import Flask, render_template, request
import data.mongo_connect as mongo_connect
from data.query import Query
from data.update import update
from datetime import datetime

app = Flask(__name__)


@app.route("/query", methods=["GET", "POST"])
def query():
    if request.method == 'POST':
        feature = request.json
        feature_name = feature['name']
        feature_region = feature['region']
        feature_query = Query.objects(name=feature_name, region=feature_region)
        if feature_query:
            response = feature_query[0].export()
        else:
            response = ''
        return response


@app.route("/")
def home():
    return render_template("index.html")


if __name__ == "__main__":
    mongo_connect.global_init()
    update()
    files = ['./static/css/styles.css', './static/js/app.js']
    app.run(debug=True, extra_files=files)



