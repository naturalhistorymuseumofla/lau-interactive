
from flask import Flask, render_template, request
from data.database import global_init
from data.database import Query
#from data.update import update
from datetime import datetime
from whitenoise import WhiteNoise
import sys


class HTTPMethodOverrideMiddleware(object):
    allowed_methods = frozenset([
        'GET',
        'HEAD',
        'POST',
        'DELETE',
        'PUT',
        'PATCH',
        'OPTIONS'
    ])
    bodyless_methods = frozenset(['GET', 'HEAD', 'OPTIONS', 'DELETE'])

    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        method = environ.get('HTTP_X_HTTP_METHOD_OVERRIDE', '').upper()
        if method in self.allowed_methods:
            environ['REQUEST_METHOD'] = method
        if method in self.bodyless_methods:
            environ['CONTENT_LENGTH'] = '0'
        return self.app(environ, start_response)


app = Flask(__name__)
app.wsgi_app = HTTPMethodOverrideMiddleware(app.wsgi_app)
my_static_folders = (
    './static/css/',
    './static/images/',
    './static/js/',
    './static/layers/'
)
#for static in my_static_folders:
#    app.wsgi_app.add_files(static)


@app.route("/query", methods=["GET", "POST"])
def query():
    if request.method == 'POST':
        feature = request.json
        feature_name = feature['name']
        feature_region = feature['region']
        feature_query = Query.objects(name=feature_name, region=feature_region)
        print(feature_query[0].export(), file=sys.stdout)
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
    app.run(debug=True, port=5050)

