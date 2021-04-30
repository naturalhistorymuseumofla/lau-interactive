from data.mongo_connect import global_init
from arcgis.gis import GIS
from collections import Counter
from data.query import Query
from datetime import datetime
import json


# Return localtiies view item from ArcGIS Online
def get_localities(id):
    gis = GIS()
    localities = gis.content.get(id)
    return localities


# Return a dictionary from list of taxa that summarizes taxa from
# stringified json form
def process_taxa(taxa_list):
    taxa_dict = {}
    for taxa in taxa_list:
        if taxa:
            taxa = json.loads(taxa)
            taxa_dict = dict(Counter(taxa_dict) + Counter(taxa))
    return taxa_dict

# Creates a new document for each region feature in specified region type
def iterate_over_regions(region_type, sdf):
    region_list = sdf[region_type].to_list()
    unique_names = list(set(region_list))
    for region_name in unique_names:
        if region_name is not None:
            returned_rows = sdf.loc[sdf[region_type] == region_name]
            region_taxa = process_taxa(returned_rows.taxa.to_list())
            # Create new query document in Query collection
            query = Query()
            # By using the same id as existing record, query.save() will
            # overwrite existing record, as opposed to creating duplicates
            if Query.objects(name=region_name):
                query.id = Query.objects(name=region_name)[0].id
            query.name = region_name
            query.region = region_type
            query.modified = datetime.now()
            query.number_of_sites = len(returned_rows)
            query.taxa = region_taxa
            query.number_of_specimens = sum(region_taxa.values())
            query.save()
            print(f'Sucessfully saved {region_name} to db!')


def main(localities):
    localities_layer = localities.layers[0]
    localities_fs = localities_layer.query()
    localities_sdf = localities_fs.sdf
    for region in ['county', 'region', 'neighborhood']:
        iterate_over_regions(region, localities_sdf)


def localities_updated(localities):
    localities_last_modified = datetime.fromtimestamp(localities.modified/ 1e3)
    try:
        query_last_modified = Query.objects[0].modified

        if localities_last_modified > query_last_modified:
            return False
        else:
            return True
    except IndexError:
        print('No documents exist to check')


if __name__ == '__main__':
    global_init()
    localities = get_localities('2ee7d9319663454996af081d337f9a4b')
    # Tests if database is up to date by testing against last modified
    # timestamp of localities hosted feature layer
    is_localities_updated = localities_updated(localities)
    print('Database is up to date!')
    if not is_localities_updated:
        main(localities)



