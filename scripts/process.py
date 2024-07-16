'''
My original data is in google docs.  Each recipe is under a sub heading.

I manually formatted dates into their own line (e.g. Apr 20 2024)

This script formats that into the placeholder-data.ts format so I can import it into my app.

Export the google doc to HTML webpage
Then convert to markdown: https://codebeautify.org/html-to-markdown
Then parse markdown into JSON structured data using this file
Then format output with https://jsonlint.com/
'''

import re
from datetime import datetime
import sys
import time
import json

file = open("/Users/marknguyen/Desktop/content.txt")
lines = file.readlines()
file.close()

result = []
current = {}

index = 0

while True:
    if index >= len(lines):
        print('Pushing last recipe')
        if current:
            result.append(current)
            current = {}
        
        # Done!
        print(json.dumps(result))
        import pdb
        pdb.set_trace()
        sys.exit(0)

    line = lines[index]
    if line.startswith('###'):
        # New Recipe!!!
        print('New recipe')
        if current:
            result.append(current)
            current = {}
        current['name'] = line[4:-1].strip()
        current['notes'] = []
    elif re.match("[A-Za-z]{3} [\d]+ [\d]+", line):
        # New Note!!!
        # dateutil.parser.parse
        print('Parsing date for new note')
        zone = time.strftime('%Z %z')
        # https://stackoverflow.com/questions/1101508/how-to-parse-dates-with-0400-timezone-string-in-python
        # https://stackoverflow.com/questions/11743019/convert-python-datetime-to-epoch-with-strftime
        parsed_datetime = datetime.strptime(line.strip() + " T " + zone, '%b %d %Y T %Z %z')
        new_note = {
            "date_epoch_seconds": parsed_datetime.timestamp(),
            "locations": [],
            "content_markdown": "",
            "assets": [],
        }
        current['notes'].append(new_note)
    else:
        # A note to append, append to the latest note or create a new one as needed
        if len(current['notes']) != 0:
            print('Appending to last note')
            current['notes'][-1]["content_markdown"] = current['notes'][-1]["content_markdown"] + line
        elif line.strip() != "":
            print('Creating new base note')
            # We create a new note if none exists using the date when the doc was created cause no timestamp was provided
            zone = time.strftime('%Z %z')
            parsed_datetime = datetime.strptime("Jul 3 2020" + " T " + zone, '%b %d %Y T %Z %z')
            current['notes'].append({
                "date_epoch_seconds": parsed_datetime.timestamp(),
                "locations": [],
                "content_markdown": line if line != '\n' else '',
                "assets": [],
            })

    index += 1