import mongoengine


class Query(mongoengine.Document):
    name = mongoengine.StringField(required=True)
    modified = mongoengine.DateTimeField(required=True)
    region = mongoengine.StringField(required=True)
    number_of_sites = mongoengine.IntField(required=True)
    number_of_specimens = mongoengine.IntField(required=True)
    taxa = mongoengine.DictField()
    meta = {
        'db_alias': 'lau-prototype',
        'collection': 'queries'
    }