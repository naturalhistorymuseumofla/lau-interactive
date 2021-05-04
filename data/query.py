import mongoengine
from data.attachment import Attachment
import json
from bson.json_util import dumps

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
    meta = {
        'db_alias': 'lau-prototype',
        'collection': 'queries'
    }
    def export(self):
        response_dict = {
            'number_of_sites': self.number_of_sites,
            'number_of_specimens': self.number_of_specimens,
            'taxa': self.taxa,
            'photos': [x.to_mongo().to_dict() for x in self.photos]
        }
        return dumps(response_dict)

    def parse_json(self):
        return json.loads(json_util.dumps(self))