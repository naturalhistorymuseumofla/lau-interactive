from mongoengine import connect
import os
from dotenv import load_dotenv


load_dotenv()
DB_URI = os.getenv('DB_URI')


def global_init():
    connect(alias='laumap', host=DB_URI)
    #mongoengine.register_connection(alias='lau-prototype', name='lau-prototype')