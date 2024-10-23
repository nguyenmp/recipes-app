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

image_references = {} # Map from image_name to object to fill

dropping_preamble = True

def create_note_for_date(date_string=None):
    if (date_string is None):
        # We create a new note using the date when the doc was created cause no timestamp was provided
        date_string = 'Jul 3 2020'

    # https://stackoverflow.com/questions/1101508/how-to-parse-dates-with-0400-timezone-string-in-python
    # https://stackoverflow.com/questions/11743019/convert-python-datetime-to-epoch-with-strftime
    zone = time.strftime('%Z %z')
    parsed_datetime = datetime.strptime(date_string + " T " + zone, '%b %d %Y T %Z %z')
    return {
        "date_epoch_seconds": int(parsed_datetime.timestamp()),
        "content_markdown": '',
    }


def get_last_note_or_create(current_recipe):
    if len(current['notes']) == 0:
        print('Creating new base note')
        # We create a new note if none exists w/o date cause no date line is available
        current['notes'].append(create_note_for_date())

    return current['notes'][-1]

def loop(index):
    global dropping_preamble, current, result
    if index >= len(lines):
        print('Pushing last recipe')
        if current:
            result.append(current)
            current = {}
        
        # Done!
        json_string = json.dumps(result, indent=4)

        # Convert to Javascript object form (different from JSON) which is serialized
        javascript_string = re.sub('"([a-z0-9_]+)": ', '\g<1>: ', json_string)
        # Also add a trailing comma to strings just cause thats how it was before.  TODO: Make this consistent with arrays and objects too
        javascript_string = re.sub('"\n', '",\n', javascript_string)
        print(javascript_string)

        import pdb
        pdb.set_trace()
        sys.exit(0)

    line = lines[index]

    if dropping_preamble and not line.startswith('###'):
        return
    else:
        dropping_preamble = False

    # Markdown images are kind of weird. There are references sprinkled throughout the markdown
    # but the actual data is defined at the far bottom, so we aggregate the references and once we see the data, we backfill that information
    while ('![][' in line):
        image_pattern = r'!\[\]\[(image[0-9]+)\]'
        match = re.search(image_pattern, line)
        image_name = match.group(1)
        print(f'Found reference to {image_name}')
        note = get_last_note_or_create(current)
        image_object = {}
        note['attachments'] =  note['attachments'] if 'attachments' in note else []
        note['attachments'].append(image_object)
        image_references[image_name] = image_object
        line = re.sub(image_pattern, '', line, count=1)


    # Remove image content from line, update previous references we've seen
    while (']: <data' in line):
        # [image1]: <data:image/png;base64,iVBORw0KGg
        match = re.search(r'\[(image[0-9]+)\]: <data:([^;]+);([a-zA-Z0-9]+),([^>]+)>', line)
        image_name = match.group(1)
        mime_type = match.group(2)
        encoding = match.group(3)
        data = match.group(4)
        print(f'Found data for {image_name}')

        assert encoding == 'base64', f'Unsupported image encoding: {encoding}'
        assert mime_type == 'image/png', f'Unsupported image mime-type: {mime_type}'

        line = re.sub(r'\[image[0-9]+\]: <data[^>]+>', '', line)
        image_object = image_references[image_name]
        image_object["name"] = f'{image_name}.png'

        # Normally we would pass along the actual data, but it turns out this base64
        # encoded images is absolutely garbage and so pixilated we can't see anything
        # image_object["data_base64"] = data

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
        current['notes'].append(create_note_for_date(line.strip()))
    else:
        if len(current['notes']) == 0 and line.strip() == '':
            return
        
        # Remove excess markdown escaping for markdown lines
        line = re.sub(r'\\&', '&', line)

        # A note to append, append to the latest note or create a new one as needed
        print('Appending to last note')
        existing_note = get_last_note_or_create(current)["content_markdown"]
        current['notes'][-1]["content_markdown"] = existing_note + line


def main():
    index = 0
    while True:
        loop(index)
        index += 1

if __name__ == '__main__':
    main()