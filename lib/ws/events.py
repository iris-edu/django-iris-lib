from django.utils.log import getLogger
from lib.ws import ws_settings, ws_request
import re
from datetime import datetime
from decimal import Decimal
from django.core.serializers.json import json
from django.utils.timezone import utc

LOGGER = getLogger(__name__)

def parse_int(value):
    if value is not None:
        return int(value)

def parse_date(value):
    if value is not None:
        parts = [int(p) for p in re.findall(r'\d+', value)]
        return datetime(*parts)

def parse_decimal(value):
    if value is not None:
        return Decimal(value)

class Event(object):
    def __init__(self, obj_data):
        self.event_id = parse_int(obj_data.get('EventID'))
        self.time = parse_date(obj_data.get('Time'))
        self.latitude = parse_decimal(obj_data.get('Latitude'))
        self.longitude = parse_decimal(obj_data.get('Longitude'))
        self.depth = parse_decimal(obj_data.get('Depth/km'))
        self.author = obj_data.get('Author')
        self.catalog = obj_data.get('Catalog')
        self.contributor = obj_data.get('Contributor')
        self.contributor_id = obj_data.get('ContributorID')
        self.mag_type = obj_data.get('MagType')
        self.magnitude = parse_decimal(obj_data.get('Magnitude'))
        self.mag_author = obj_data.get('MagAuthor')
        self.location = obj_data.get('EventLocationName','').title()
    
    def json(self):
        return json.dumps(dict(
            ((k,str(v)) for k,v in self.__dict__.iteritems())
        ))
    
    def latitude_str(self):
        if self.latitude >= 0:
            return "%s&deg; N" % self.latitude
        else:
            return "%s&deg; S" % -self.latitude
    
    def longitude_str(self):
        if self.longitude >= 0:
            return "%s&deg; E" % self.longitude
        else:
            return "%s&deg; W" % -self.longitude
    
    def time_utc(self):
        """
        Return the event time as a timezone-aware datetime
        """
        if self.time:
            return self.time.replace(tzinfo=utc)
    
    def __str__(self):
        return "%s%s %s" % (self.mag_type, self.magnitude, self.location)

class EventRequest(ws_request.BaseRequest):

    param_types = dict(
        starttime = ws_request.WSDateParam(),
        endtime = ws_request.WSDateParam(),
        minlat = ws_request.WSParam(),
        maxlat = ws_request.WSParam(),
        minlon = ws_request.WSParam(),
        maxlon = ws_request.WSParam(),
        limit = ws_request.WSParam(default=50),
        nodata = ws_request.WSParam(),
        format = ws_request.WSParam(default='text'),
        eventid = ws_request.WSParam(),
    )
    url = ws_settings.FDSN_EVENT_WS_URL
    
    def get_default_headers(self):
        headers = super(EventRequest,self).get_default_headers()
        headers.update({
            'accept': 'text/plain',
        })
        return headers
    
    def entity(self, obj_dict):
        try:
            return Event(obj_dict)
        except Exception as e:
            LOGGER.error("Failed to create event: %s; obj_dict=%s", e, obj_dict, exc_info=1)