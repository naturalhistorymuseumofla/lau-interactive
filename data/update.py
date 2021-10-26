# Updates mongoDB collections with new data from hosted feature layers used in the
# LAU map interactive.
from data.database import global_init
from arcgis.gis import GIS
from collections import Counter
from data.database import Query
from data.database import Attachment
from datetime import datetime
import numpy as np
import json
import pandas as pd
import os
from dotenv import load_dotenv


# Return fearture layer item from ArcGIS Online
def get_portal_object(id):
    load_dotenv()
    GIS_USR = os.getenv('GIS_USR')
    GIS_PSWD = os.getenv('GIS_PSWD')
    gis = GIS('https://lacnhm.maps.arcgis.com/', GIS_USR, GIS_PSWD)
    agol_object = gis.content.get(id)
    return agol_object


def update_attachments(photos):
    # Check if mongoDB collection is updated
    is_updated = check_if_updated(photos, Attachment)
    # Update collection if not
    if not is_updated:
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
            attachment.url = row.DOWNLOAD_URL.split("?")[0]
            attachment.save()
            print(f'Attachment {row.specimenID} saved to attachments!')
            attachments_saved += 1
        print(f'{attachments_saved} attachment(s) succesfully saved')


# Tests if database is up to date by testing against last modified
# timestamp of localities hosted feature layer
def check_if_updated(agol_object, Collection):
    object_last_modified = datetime.fromtimestamp(agol_object.modified/ 1e3)
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


# Updates localities by filtering spatial df by region type and iterating over
# all unique region names in returned dataframe
def update_localities(localities):
    # is_updated = check_if_updated(localities, Query)
    is_updated = False
    if not is_updated:
        localities_layer = localities.layers[0]
        localities_sdf = localities_layer.query().sdf
        for region in ['county', 'region', 'neighborhood']:
            iterate_over_regions(region, localities_sdf)


# Creates a new document for each region feature in specified region type
def iterate_over_regions(region_type, sdf):
    region_list = sdf[region_type].to_list()
    unique_names = list(set(region_list))
    for region_name in unique_names:
        if region_name is not None:
            returned_rows = filter_df(sdf, region_type, region_name)
            region_taxa = process_taxa(returned_rows.taxa.to_list())
            returned_photos = Attachment.objects(__raw__={region_type: region_name})
            # Create new query document in Query collection
            query = Query()
            # By using the same id as existing record, query.save() will
            # overwrite existing record, as opposed to creating duplicates
            if Query.objects(name=region_name, region=region_type):
                query.id = Query.objects(name=region_name, region=region_type)[0].id
            query.name = region_name
            query.region = region_type
            query.modified = datetime.now()
            query.number_of_sites = len(returned_rows)
            query.taxa = region_taxa
            query.number_of_specimens = sum(region_taxa.values())
            # Get list of specimen IDs from photos sdf based on their region name value
            query.photos = [x.id for x in returned_photos]
            query.start_date = max(returned_rows['start_date'].to_list())
            query.end_date = min(returned_rows['end_date'].to_list())
            query.oids = returned_rows['ObjectId'].to_list()
            query.save()
            print(f'Sucessfully saved {region_name} to db!')


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
