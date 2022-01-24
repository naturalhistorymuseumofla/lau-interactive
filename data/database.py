import mongoengine
import json
from bson.json_util import dumps
from random import sample
from mongoengine import connect
import os
from dotenv import load_dotenv
import numpy as np


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
class Attachment(mongoengine.Document):
    specimen_id = mongoengine.StringField(required=True, unique=True)
    display_id = mongoengine.StringField(required=True)
    modified = mongoengine.DateTimeField(required=True)
    locality = mongoengine.StringField()
    taxon = mongoengine.StringField()
    age = mongoengine.StringField()
    description = mongoengine.StringField()
    point = mongoengine.PointField(required=True)
    county = mongoengine.StringField()
    region = mongoengine.StringField()
    neighborhood = mongoengine.StringField()
    url = mongoengine.URLField()
    meta = {
        'db_alias': 'fossilmap',
        'collection': 'attachments'
    }


# Class for queries collection that stores all queries of a polygon region
# intersection with localities layer
class Query(mongoengine.Document):
    name = mongoengine.StringField(required=True)
    modified = mongoengine.DateTimeField(required=True)
    region = mongoengine.StringField(required=True)
    number_of_sites = mongoengine.IntField(required=True)
    number_of_specimens = mongoengine.IntField(required=True)
    taxa = mongoengine.DictField()
    photos = mongoengine.ListField(mongoengine.ReferenceField(Attachment, dbref=True))
    start_date = mongoengine.FloatField()
    end_date = mongoengine.FloatField()
    oids = mongoengine.ListField()
    meta = {
        'db_alias': 'fossilmap',
        'collection': 'queries'
    }

    def handle_nan(self, value):
        return None if np.isnan(value) else value

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
        }
        return dumps(response_dict)

    def parse_json(self):
        return json.loads(dumps(self))


