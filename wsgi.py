#!/usr/bin/env python

import sys
import site

site.addsitedir('/var/www/dm.nhmarchive.org/lau-map/venv/lib/python3.6/site-packages')

sys.path.insert(0, '/var/www/dm.nhmarchive.org/lau-map')

from app import app as application
