# Updates mongoDB collections with new data from hosted feature layers used in the
# LAU map interactive.
from data.mongo_connect import global_init
import pandas as pd
from arcgis.gis import GIS
from collections import Counter
from data.database import Attachment
from datetime import datetime


def get_portal_object(id):
    gis = GIS()
    object = gis.content.get(id)
    return object

def main(photos):
    photos_layer = photos.layers[0]
    photos_sdf = photos_layer.query().sdf
    attachments_sdf = pd.DataFrame.from_dict(photos_layer.attachments.search())
    cols = ['PARENTOBJECTID', 'NAME', 'DOWNLOAD_URL']
    merged_sdf = photos_sdf.merge(attachments_sdf[cols], left_on='ObjectId', right_on='PARENTOBJECTID')
    attachments_saved = 0
    for i in range(len(merged_sdf)):
        row = merged_sdf.iloc[i]
        attachment = Attachment()
        attachment.specimen_id = row.specimenID
        attachment.modified = datetime.now()
        attachment.locality = row.locality
        attachment.taxon = row.taxon
        attachment.age = row.age
        attachment.description = row.description
        attachment.point = [row.longitude, row.latitude]
        attachment.geometry = row.SHAPE
        attachment.county = row.county
        attachment.region = row.region
        attachment.neighborhood = row.neighborhood
        attachment.url = row.DOWNLOAD_URL
        attachment.save()
        print(f'Attachment {row.specimenID} saved to attachments!')
        attachments_saved += 1
    print(f'{attachments_saved} attachment(s) succesfully saved')


if __name__ == '__main__':
    global_init()
    photos = get_portal_object('54cf1a9a79524a0d9af4952b0f05ef3f')
    # Tests if database is up to date by testing against last modified
    # timestamp of localities hosted feature layer
    #is_localities_updated = localities_updated(localities)
    #print('Database is up to date!')
    #if not is_localities_updated:
    main(photos)



