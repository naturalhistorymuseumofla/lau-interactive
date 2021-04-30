import mongoengine


def global_init():
    mongoengine.register_connection(alias='lau-prototype', name='lau-prototype')