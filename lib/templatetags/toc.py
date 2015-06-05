from django import template
from django.template.defaultfilters import stringfilter, slugify
from django.utils.safestring import mark_safe
import textile
import re
from django.utils.log import getLogger

LOGGER = getLogger(__name__)

register = template.Library()

def generate_notextile_heading(current_weight, slug, heading):
    """
    Generate the <notextile>
    heading block
    """
    LINK_CLASS = 'headerlink'
    TITLE = 'Permalink to this headline'
    PERMALINK_CHAR = '&para;'
    return '\n'.join(['<notextile>',
                      '<h%s id="%s">' % (current_weight, slug),
                      heading,
                      '<a href="#%s"' % slug,
                      ' class="%s"' % LINK_CLASS,
                      ' title="%s">' % TITLE,
                      PERMALINK_CHAR,
                      '</a></h%s>' % current_weight,
                      '</notextile>'])

def generate_list_item(slug, heading):
    """
    Generate the list item
    """
    return '\n<li><a href="#%s">%s</a></li>\n' % (slug, heading) 

def generate_details_block(title, toc):
    """
    Generate the HTML5 <details>
    block
    """
    DIV_CLASS = 'width-4 pull-right toc'
    return '\n'.join(['<div class="%s">' % DIV_CLASS,
                      '<details open>',
                      '<summary>%s</summary>' % title,
                      '<ul>',
                      toc,
                      '</ul>',
                      '</details>',
                      '</div>'])

class TocItem(object):
    """ A simple object representing a TOC item; has a link and a list of children """
    def __init__(self, link=None):
        self.link = link
        self.children = []

    def to_html(self):
        """ Output to an html list item, recursively outputting children in a sublist """
        toc_html = '<li>'
        if self.link:
            toc_html += self.link
        if len(self.children):
            toc_html += '<ul>\n'
            toc_html += ''.join((c.to_html() for c in self.children))
            toc_html += '</ul>\n'
        toc_html += '</li>\n'
        return toc_html

@register.filter(name='textiletoc')
@stringfilter
def textile_table_of_contents(html, show_toc=None):
    """
    Dynamically create a
    Table Of Contents
    from textile-based markup
    """
    HEADLINES_REGEX = 'h(?P<type>[\d])\. (?P<headerstr>[^\r\n\r]+)'
    headlines = re.findall(HEADLINES_REGEX, html)
    if len(headlines) > 0:
        min_weight, toc = min([int(x[0]) for x in headlines]), ''
        toc_top = TocItem()
        for h in headlines:
            current_weight = int(h[0])
            s = slugify(h[1])
            find_str = 'h%s. %s' % (h[0], h[1])
            replacement_str = generate_notextile_heading(current_weight, s, h[1])
            html = html.replace(find_str, replacement_str)
            if show_toc is not None:
                # Find the parent == the last TOC item whose weight is one above this one
                toc_parent = toc_top
                for _ in range(current_weight-min_weight):
                    if len(toc_parent.children) == 0:
                        # There's a missing level; add an empty child
                        toc_parent.children.append(TocItem())
                    toc_parent = toc_parent.children[-1]
                # Append this to the parent's children
                toc_parent.children.append(TocItem('<a href="#%s">%s</a>\n' % (s, h[1])))
        if show_toc is not None:
            toc_html = ''.join(c.to_html() for c in toc_top.children)
            toc = generate_details_block(show_toc, toc_html)
        result = '%s %s' % (toc, textile.textile(html))
    else:
        result = textile.textile(html)
    return mark_safe(result)
