from mongoengine import connect
import os
from dotenv import load_dotenv
import sys


load_dotenv()
DB_URI = os.getenv('DB_URI')


def global_init():
    print('This is standard output', file=sys.stdout)
    connect(alias='laumap', host=DB_URI)
    #mongoengine.register_connection(alias='lau-prototype', name='lau-prototype')