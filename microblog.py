from flask import Flask, render_template, request
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


app.config['MONGODB_SETTINGS'] = {
    'db': 'db_name'
}

connect(db="lau-test")


class FossilPhotos(EmbeddedDocument):
    uid = ObjectIdField(required=True, unique=True, primary_key=True),
    url = URLField(required=True),
    age = FloatField(),
    description: StringField()


class LocalityQuery(Document):
    uid = ObjectIdField(required=True, unique=True, primary_key=True),
    updated = DateTimeField(required=True)
    name = StringField(required=True),
    sites = IntField(required=True),
    fossils = IntField(required=True),
    underwater_age = FloatField(),
    taxa = DictField(),
    photos = EmbeddedDocumentListField(FossilPhotos)


@app.route("/")
def home():
    return render_template("index.html")
    print(db.objects())


@app.route("/query", methods=["GET", "POST"])
def query():
    global_id = request.args.get('id')
    query = LocalityQuery.objects(uid=global_id)

    return "Hello, Salvador"


@app.route("/json", methods=["GET", "POST"])
def json():
    if request.method == 'POST':
        return f'{request.json} was sucesfully recevied'


@app.route("/salvador")
def salvador():
    return "Hello, Salvador"


if __name__ == "__main__":
    files = ['./static/css/styles.css', './static/js/app.js']
    app.run(debug=True, extra_files=files)
