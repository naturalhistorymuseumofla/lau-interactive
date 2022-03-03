# Updates mongoDB collections with new data from hosted feature layers used in the
# LAU map interactive.
from data.database import global_init
from arcgis.gis import GIS
from collections import Counter
from data.database import Polygon
from data.database import MultiPolygon
from data.database import Area
from data.database import Attachment
from datetime import datetime
import pandas as pd
import os
from dotenv import load_dotenv
from boto3 import session
import urllib.request
import io
from PIL import Image
import json

# Return fearture layer item from ArcGIS Online
def get_portal_object(id):
    load_dotenv()
    GIS_USR = os.getenv('GIS_USR')
    GIS_PSWD = os.getenv('GIS_PSWD')
    gis = GIS('https://lacnhm.maps.arcgis.com/', GIS_USR, GIS_PSWD)
    agol_object = gis.content.get(id)
    return agol_object

class Spaces:
    def __init__(self, space='fossilmap', prefix='images/'):
        self.prefix = prefix
        self.space = space
        self.client = self._connect_to_spaces()
        self.object_list = self._get_objects()

    def _connect_to_spaces(self):
        load_dotenv()
        SPACES_ACCESS_ID = os.getenv('SPACES_ACCESS_ID')
        SPACES_SECRET_KEY = os.getenv('SPACES_SECRET_KEY')
        ENDPOINT_URL = 'https://sfo3.digitaloceanspaces.com'
        spaces_session = session.Session()
        client = spaces_session.client('s3',
                                       region_name='sfo3',
                                       endpoint_url=ENDPOINT_URL,
                                       aws_access_key_id=SPACES_ACCESS_ID,
                                       aws_secret_access_key=SPACES_SECRET_KEY
                                       )
        return client

    def _get_objects(self):
        paginator = self.client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=self.space, Prefix=self.prefix)
        contents = [page['Contents'] for page in pages][0]
        image_list = [content['Key'] for content in contents]
        return image_list

    def is_in_spaces(self, key):
        key = self.prefix + key
        if key in self.object_list:
            return True
        else:
            return False

    def upload_photo(self, img, key):
        # Save image to file in memory
        in_memory_file = io.BytesIO()
        img.save(in_memory_file, format='png')
        in_memory_file.seek(0)
        # Upload byte like file object to Spaces
        key = 'images/' + key
        self.client.upload_fileobj(in_memory_file, self.space, key)
        # Change its permissions to public
        self.client.put_object_acl(ACL='public-read', Bucket=self.space, Key=key)

    def upload_geojson(self, geojson, key):
        # Save image to file in memory
        response = self.client.put_object (
            Body=json.dumps(geojson),
            Bucket='fossilmap',
            Key=f'{self.prefix}{key}'
        )
        self.client.put_object_acl(ACL='public-read', Bucket=self.space, Key=f'{self.prefix}{key}')
        return response


def load_image(url):
    with urllib.request.urlopen(url) as obj:
        f = io.BytesIO(obj.read())
        img = Image.open(f)
        return img


def resize_image(img, resized_width=500):
    width, height = img.size
    ratio = (resized_width / float(width))
    resized_height = int((float(height) * float(ratio)))
    new_size = (resized_width, resized_height)
    resized_image = img.resize(new_size)
    return resized_image


def update_attachments(photos):
    # Check if mongoDB collection is updated
    is_updated = check_if_updated(photos, Attachment)
    # Update collection if not
    if not is_updated:
        # Connect to DO Spaces
        space = Spaces()
        # Retrieve the spatial dataframe from AGOL
        photos_layer = photos.layers[0]
        photos_sdf = photos_layer.query().sdf
        # Return all attachments from the photos feature layer using an attachments query
        attachments_sdf = pd.DataFrame.from_dict(photos_layer.attachments.search())
        cols = ['PARENTOBJECTID', 'NAME', 'DOWNLOAD_URL']
        # Create a merged spatial dataframe that has records of photos and their attachments
        merged_sdf = photos_sdf.merge(attachments_sdf[cols], left_on='ObjectId', right_on='PARENTOBJECTID')

        attachments_saved = 0
        # Input the records as documents into Photos collection
        for i in range(len(merged_sdf)):
            row = merged_sdf.iloc[i]
            filename = row.NAME.split('.')[0]
            if not space.is_in_spaces(filename + '_500px.png'):
                key = filename + '_500px.png'
                img = load_image(row.DOWNLOAD_URL)
                img = resize_image(img)
                space.upload_photo(img, filename + '_500px.png')
            if not space.is_in_spaces(filename + '_modal.png'):
                key = filename + '_modal.png'
                img = load_image(row.DOWNLOAD_URL)
                space.upload_photo(img, key)
            attachment = Attachment()
            if Attachment.objects(specimen_id=row.specimenID):
                attachment.id = Attachment.objects(specimen_id=row.specimenID)[0].id
            attachment.specimen_id = row.specimenID
            attachment.display_id = row.specimenID.replace('_', ' ').replace('-', '.')
            attachment.modified = datetime.now()
            attachment.locality = row.locality
            attachment.taxon = row.taxon
            attachment.age = row.age
            attachment.description = row.description
            attachment.point = [row.longitude, row.latitude]
            attachment.county = row.county
            attachment.region = row.region
            attachment.neighborhood = row.neighborhood
            attachment.key = filename
            attachment.save()
            print(f'Attachment {row.specimenID} saved to attachments!')
            attachments_saved += 1
        print(f'{attachments_saved} attachment(s) succesfully saved')



# Tests if database is up to date by testing against last modified
# timestamp of localities hosted feature layer
def check_if_updated(agol_object, Collection):
    date_last_updated = max(i.properties.editingInfo.lastEditDate for i in agol_object.layers + agol_object.tables)
    object_last_modified = datetime.fromtimestamp(date_last_updated/ 1e3)
    try:
        collection_last_modified = Collection.objects[0].modified
        if collection_last_modified > object_last_modified:
            print(f'The {Collection} is up to date. \n'\
                  f'{agol_object} was last updated:{object_last_modified} \n'\
                  f'{Collection} was last modified {collection_last_modified}')

            return True
        else:
            return False
    except IndexError:
        print (f'No documents exist in {Collection}')
        return False



# Updates localities by filtering spatial df by region type and iterating over
# all unique region names in returned dataframe
def update_localities(localities):
    is_updated = check_if_updated(localities, Area)
    #is_updated = False
    if not is_updated:
        localities_layer = localities.layers[0].query()
        localities_sdf = localities_layer.sdf
        #areas_layer = get_portal_object('c273ac12f11a413eae2331ad758e3c6b').layers[0].query()
        #counties_layer = get_portal_object('fa404082563d460681efe17c6a0ea163').layers[0].query()
        #areas_features = json.loads(areas_layer.to_geojson)['features'] + json.loads(counties_layer.to_geojson)['features']
        areas_json = json.load(open('../static/layers/lauAllAreasFinal.geojson'))
        areas_df = pd.DataFrame.from_dict(areas_json['features'])
        areas_df = pd.concat([areas_df, areas_df["properties"].apply(pd.Series)], axis=1)
        for region in ['county', 'region', 'neighborhood']:
            iterate_over_regions(region, localities_sdf, areas_json, areas_df)


def return_area_geometry(features, name, type):
    g = [f['geometry'] for f in features if f['properties']['name'] == name and f['properties']['region_type'] == type]
    if len(g) == 0:
        print(f'{name} did not return a geometry')
        return False
    else:
        return g


def intersection_areas(spaces, features, name, region_type):
    key = f'{name.replace(" ","")}_{region_type}.geojson'
    if not spaces.is_in_spaces(key):
        intersecting_features = [f.copy() for f in features if f['properties']['parent_region'] == name]
        if intersecting_features:
            for feature in intersecting_features:
                feature['properties'] = {
                    "name": feature['properties']['name'],
                    #"type": 1
                }
        '''
        parent_feature = [f.copy() for f in features if f['properties']['name'] == name][0]
        parent_feature['properties'] = {
                "name": name,
                "type": 0
        }
        '''

        new_geojson = {
            "type": "FeatureCollection",
            "features": intersecting_features
        }

        response = spaces.upload_geojson(new_geojson, key)
        status_code = response['ResponseMetadata']['HTTPStatusCode']
        if status_code == 200:
            print(f'{key} successufully uploaded')
        else:
            print(f'{key} was not able to be uploaded with error code: {status_code}')




# Creates a new document for each region feature in specified region type
def iterate_over_regions(region_type, sdf, geojson, areas_df):
    geojson_spaces = Spaces(prefix='intersecting-areas/')
    features = geojson['features']

    #region_list = sdf[region_type].to_list()
    #unique_names = [name for name in (set(region_list)) if name != '']
    for feature in features:
        region_name = feature['properties']['name']
        region_type = feature['properties']['region_type']
        intersection_areas(geojson_spaces, features, region_name, region_type)
        returned_area = feature['geometry']
        returned_rows = filter_df(sdf, region_type, region_name)
        region_taxa = process_taxa(returned_rows.taxa.to_list())
        returned_photos = Attachment.objects(__raw__={region_type: region_name})

        # Create new query document in Query collection
        if returned_area:
            if returned_area['type'] == 'Polygon':
                query = Polygon()
            elif returned_area['type'] == 'MultiPolygon':
                query = MultiPolygon()


            # By using the same id as existing record, query.save() will
            # overwrite existing record, as opposed to creating duplicates

            if Area.objects(name=region_name, region=region_type):
                query.id = Area.objects(name=region_name, region=region_type)[0].id

            query.name = region_name
            query.region = region_type
            query.parent_region = feature['properties']['parent_region']
            query.modified = datetime.now()
            query.number_of_sites = len(returned_rows)
            query.taxa = region_taxa
            query.number_of_specimens = sum(region_taxa.values())
            # Get list of specimen IDs from photos sdf based on their region name value
            query.photos = [x.id for x in returned_photos]
            if returned_rows['start_date'].to_list():
                query.start_date = max(returned_rows['start_date'].to_list())
            if returned_rows['end_date'].to_list():
                query.end_date = min(returned_rows['end_date'].to_list())
            query.oids = returned_rows['ObjectId'].to_list()
            query.geometry = returned_area
            query.save()
            print(f'Sucessfully saved {region_name} to db!')
        else:
            pass


# Return df based on loc query of dataframe
def filter_df(df, field, value):
    return df.loc[df[field] == value]


# Return a dictionary from list of taxa that summarizes taxa from
# stringified json form
def process_taxa(taxa_list):
    taxa_dict = {}
    for taxa in taxa_list:
        if taxa:
            taxa = json.loads(taxa)
            taxa_dict = dict(Counter(taxa_dict) + Counter(taxa))
    return taxa_dict


def update():
    global_init()
    localities = get_portal_object('0142ccc5d236408ea680ac93e42934e6')
    photos = get_portal_object('d074b2bfe5014887ab1796f633966ee6')
    update_attachments(photos)
    update_localities(localities)

update()
