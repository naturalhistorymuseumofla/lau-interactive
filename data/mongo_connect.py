from mongoengine import connect
import os
from dotenv import load_dotenv
import sys


def global_init():
    load_dotenv()
    #DB_URI = os.getenv('DB_URI')
    MONGO_URL = os.getenv('MONGO_URL')
    connect(alias='fossilmap', host=MONGO_URL)
    #connect(alias='laumap', host=DB_URI)
    #mongoengine.register_connection(alias='lau-prototype', name='lau-prototype')