import mongoengine


# Class for queries collection that stores all queries of a polygon region
# intersection with localities layer
class Attachment(mongoengine.Document):
    specimen_id = mongoengine.StringField(required=True, unique=True)
    modified = mongoengine.DateTimeField(required=True)
    locality = mongoengine.StringField()
    taxon = mongoengine.StringField()
    age = mongoengine.StringField()
    description = mongoengine.StringField()
    point = mongoengine.PointField(required=True)
    geometry = mongoengine.DictField()
    county = mongoengine.StringField()
    region = mongoengine.StringField()
    neighborhood = mongoengine.StringField()
    url = mongoengine.URLField()
    meta = {
        'db_alias': 'lau-prototype',
        'collection': 'attachments'
    }