'''
My original data is in google docs.  Each recipe is under a sub heading.

I manually formatted dates into their own line (e.g. Apr 20 2024)

This script formats markdown into the placeholder-data.ts format so I can import it into my app.

Export the google doc to md file
Then parse markdown into Javascript object data using this file
Then paste it into placeholder-data.ts
'''

import re
from datetime import datetime
import sys
import time
import json

file = open("/Users/marknguyen/Downloads/Recipes App.md")
lines = file.readlines()
file.close()

result = []
current = {}

index = 0

dropping_preamble = True

while True:
    if index >= len(lines):
        print('Pushing last recipe')
        if current:
            result.append(current)
            current = {}
        
        # Done!
        json_string = json.dumps(result, indent=4)

        # Convert to Javascript object form (different from JSON) which is serialized
        javascript_string = re.sub('"([a-z_]+)": ', '\g<1>: ', json_string)
        # Also add a trailing comma to strings just cause thats how it was before.  TODO: Make this consistent with arrays and objects too
        javascript_string = re.sub('"\n', '",\n', javascript_string)
        print(javascript_string)

        import pdb
        pdb.set_trace()
        sys.exit(0)

    line = lines[index]

    if dropping_preamble and not line.startswith('###'):
        continue;
    else:
        dropping_preamble = False

    # Remove any images because images are not supported yet
    # TODO: Re-add image support
    line = re.sub(r'\[image[0-9]+\]: <data[^>]+>', '', line)

    if line.startswith('###'):
        # New Recipe!!!
        print('New recipe')
        if current:
            result.append(current)
            current = {}

        raw_name = line[4:-1].strip()
        # Remove heading links
        current['name'] = re.sub(' \{#[^}]+\}', '', raw_name)
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
            "date_epoch_seconds": int(parsed_datetime.timestamp()),
            "content_markdown": "",
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
                "date_epoch_seconds": int(parsed_datetime.timestamp()),
                "content_markdown": line if line != '\n' else '',
            })

    index += 1