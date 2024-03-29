import mongoengine
import json
from bson.json_util import dumps
from random import sample
from mongoengine import connect
import os
from dotenv import load_dotenv
from numpy import isnan


# Connects to remote Atlas database
def global_init():
    load_dotenv()
    #DB_URI = os.getenv('DB_URI')
    #connect(alias='laumap', host=DB_URI)
    MONGO_URL = os.getenv('MONGO_URL')
    connect(alias='fossilmap', host=MONGO_URL)
    #mongoengine.register_connection(alias='lau-prototype', name='lau-prototype')

global_init()


# Class for queries collection that stores all queries of a polygon region
# intersection with localities layer
class Photo(mongoengine.Document):
    specimen_id = mongoengine.StringField(required=True, unique=True)
    display_id = mongoengine.StringField(required=True)
    modified = mongoengine.DateTimeField(required=True)
    locality = mongoengine.StringField()
    taxon = mongoengine.StringField()
    #age = mongoengine.StringField()
    start_age = mongoengine.IntField()
    end_age = mongoengine.IntField()
    common_name = mongoengine.StringField()
    description = mongoengine.StringField()
    point = mongoengine.PointField(required=True)
    county = mongoengine.StringField()
    region = mongoengine.StringField()
    neighborhood = mongoengine.StringField()
    key = mongoengine.StringField()
    meta = {
        'db_alias': 'fossilmap',
        'collection': 'photos'
    }


class Polygon(mongoengine.EmbeddedDocument):
    geometry = mongoengine.PolygonField()


class MultiPolygon(mongoengine.EmbeddedDocument):
    geometry = mongoengine.MultiPolygonField()


# Class for queries collection that stores all queries of a polygon region
# intersection with localities layer
class Area(mongoengine.Document):
    name = mongoengine.StringField(required=True)
    modified = mongoengine.DateTimeField(required=True)
    region = mongoengine.StringField(required=True)
    number_of_sites = mongoengine.IntField(required=True)
    number_of_specimens = mongoengine.IntField(required=True)
    parent_region = mongoengine.StringField()
    taxa = mongoengine.DictField()
    photos = mongoengine.ListField(mongoengine.ReferenceField(Photo, dbref=True))
    start_date = mongoengine.FloatField()
    end_date = mongoengine.FloatField()
    oids = mongoengine.ListField()
    immersion = mongoengine.FloatField()
    # mongoengine.DynamicField(choices=[mongoengine.PolygonField(), mongoengine.MultiPolygonField()])
    meta = {
        'db_alias': 'fossilmap',
        'collection': 'areas',
        'allow_inheritance': True,
    }

    def handle_nan(self, value):
        #return None if np.isnan(value) else value
        if value is None:
            return None
        elif isnan(value):
            return None
        else:
            return value

    def parse_json(self):
        return json.loads(dumps(self))

    def export(self):
        photos = [x.to_mongo().to_dict() for x in self.photos]
        if len(photos) > 7:
            photos = sample(photos, 7)
        response_dict = {
            'name': self.name,
            'region': self.region,
            'number_of_sites': self.number_of_sites,
            'number_of_specimens': self.number_of_specimens,
            'taxa': self.taxa,
            'immersion': self.handle_nan(self.immersion),
            'photos': photos,
            'startDate': self.handle_nan(self.start_date),
            'endDate': self.handle_nan(self.end_date),
            'oids': self.oids,
            'geometry': self.geometry
        }
        return dumps(response_dict).encode('utf-8')

class Polygon(Area):
    geometry = mongoengine.PolygonField()
    parent_region = mongoengine.StringField()

class MultiPolygon(Area):
    geometry = mongoengine.MultiPolygonField()
    parent_region = mongoengine.StringField()

    def export(self):
        photos = [x.to_mongo().to_dict() for x in self.photos]
        if len(photos) > 7:
            photos = sample(photos, 7)
        response_dict = {
            'name': self.name,
            'number_of_sites': self.number_of_sites,
            'number_of_specimens': self.number_of_specimens,
            'taxa': self.taxa,
            'photos': photos,
            'startDate': self.handle_nan(self.start_date),
            'endDate': self.handle_nan(self.end_date),
            'oids': self.oids,
            'geometry': self.geometry
        }
        return dumps(response_dict).encode('utf-8')

