'''
My original data is in google docs.  Each recipe is under a sub heading.

This script takes the HTML dump of the document and outputs markdown

Export the google doc to HTML webpage
This script hten converts that HTML to markdown
Then parse markdown into JSON structured data using process.py
Then format output with https://jsonlint.com/
'''

from bs4 import BeautifulSoup

with open('/Users/marknguyen/Downloads/Recipes App(1)/RecipesApp.html') as fp:
    soup = BeautifulSoup(fp, features="html.parser")

# Delete "head" which is useless to us
soup.html.head.extract()

# Delete everything until we encounter our first recipe
while True:
    child = soup.html.body.contents[0]

    if child.name == 'h3':
        # h3 is how I store my recipes, so this is the first recipe
        break;

    # Remove from tree
    print("Removing " + str(child.name) + str(child.string))
    child.extract()

# This is the recipes content that's mostly structured
content_html = soup.html.body.children

for node in content_html:
    if isinstance(node, str):
        if node == '\n':
            # Ignore floating newlines, they're just formatting
            continue
        
        # Drop into debugger because unknown string encountered as node
        print("Unknown string")
        import pdb
        pdb.set_trace()
    else:
        if node.name == 'h3':
            # New recipe!

            # Sanity check
            node_class = node['class']
            assert node_class == ['c8'], f'Unknown class for h3: {node_class}'
            assert len(node.contents) == 1, f'Unexpected multiple children for h3: {len(node.contents)}'
            assert node.contents[0].name == 'span', f'Unexpected non-span h3 child: {node.contents[0].name}'
            span = node.contents[0]
            span_class = span['class']
            assert span_class == ['c7'], f'Unexpected header span class: {span_class}'
            assert len(span.contents) == 1
            print("Header: " + span.string)
        elif node.name == 'p':
            # Line in recipe
            node_class = node['class']
            # c0 is empty line, c4 is common line
            assert node_class == ['c4'] or node_class == ['c0'], f'Unknown class for p: {node_class}'
            assert len(node.contents) == 1, f'Unexpected multiple children for p: {len(node.contents)}'
            assert node.contents[0].name == 'span', f'Unexpected non-span p child: {node.contents[0].name}'
            span = node.contents[0]
            span_class = span['class']
            assert span_class == ['c5'], f'Unexpected header span class: {span_class}'
            assert len(span.contents) == (1 if node_class == ['c4'] else 0), f'Unexpected multiple span children for p: {len(span.contents)}'
            if node_class == ['c4']:
                print("Line: " + span.string)
            else:
                print("Empty line")

        else:
            print('Unknown node')
            import pdb
            pdb.set_trace()
