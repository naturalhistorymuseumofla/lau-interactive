# LAU Map Interactive Flask app

Code for interactive map built for the NHMLA's 'LA Underwater' exhibit. The map interactive was built using python's [Flask](https://flask.palletsprojects.com/en/2.0.x/) "microframework", MongoDB to store/cache queries and Esri's [ArcGIS API for JavaScript 4.x ](https://developers.arcgis.com/javascript/latest/) to visualize data on a map. 

## Functionality 
The intended functionality of this web application is to allow users to see what fossils from NHMLA have been found in a neighborhood/region/county by selecting the appropriate boundary polygon from an interactive map of Southern California. The municpal/neighborhood polygons and locality points are stored as [feature service layers](https://enterprise.arcgis.com/en/server/latest/publish-services/windows/what-is-a-feature-service-.htm) on ArcGIS Online. 

[Photo of lau-map with polygons of boundaries]

A cron job runs the `update.py` to periodically query the ArcGIS Online hosted feature services and update a MongoDB instance. If the ArcGIS hosted feature layers have been recently updated, they are saved as a `geojson` stored on the server which can then be served/displayed to the client. 

## Installation + Setup

#### Installation

Install all dependencies, which includes Flask, with the `requirements.txt`

```
# Make sure that python 3.x is installed and you have activated a virtual environment
# of your choosing
pip install requirements.txt
```

#### Database

In `database.py` you will need to point the `connect()` function towards the proper MongoDB instance (you can find documentation on `mongoengine.connect()` [here](https://docs.mongoengine.org/guide/connecting.html)):

```
# In this example a URI is being used to connect to a remote instance. 
# The URI is stored in an .env file which is included in the project's gitignore
def global_init():
    load_dotenv()
    DB_URI = os.getenv('DB_URI')
    # Make sure to include the proper kwargs to connect to the database
    mongoengine.connect(alias='laumap', host=DB_URI)
```

When running the app for the first time, the `update.py` script should run to populate the mongoDB instance (if there is no data or if the data is out of date).

#### Connecting to ArcGIS Online

Make sure that the app is able to connect to the GIS account with access to ArcGIS Online acocunt with access to the hosted feature services. Connection to ArcGIS Online occurs in `update.py` :

```
def get_portal_object(id):
    load_dotenv()
    GIS_URL = os.getenv('GIS_URL')
    GIS_USR = os.getenv('GIS_USR')
    GIS_PSWD = os.getenv('GIS_PSWD')
    # Make sure that the credentials are correct
    gis = GIS(GIS_URL, GIS_USR, GIS_PSWD)
    ...

```
