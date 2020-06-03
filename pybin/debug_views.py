from django.http import Http404, HttpResponse

from pyhatebin import settings


def script_view(request):
    if not settings.DEBUG_ROUTES:
        raise Http404()
    return HttpResponse(''.join(open('static/application.js', 'r').readlines()),
                        content_type='application/javascript')


def css_view(request):
    print('nam')
    if not settings.DEBUG_ROUTES:
        raise Http404()
    return HttpResponse(''.join(open('static/application.css', 'r').readlines()), content_type='text/css')


def css2_view(request):
    if not settings.DEBUG_ROUTES:
        raise Http404()
    return HttpResponse(''.join(open('static/solarized_dark.css', 'r').readlines()), content_type='text/css')


def highlight_view(request):
    if not settings.DEBUG_ROUTES:
        raise Http404()
    return HttpResponse(''.join(open('static/highlight.min.js', 'r').readlines()),
                        content_type='application/javascript')


def image_view(request):
    if not settings.DEBUG_ROUTES:
        raise Http404()
    return HttpResponse(open('static/function-icons.png', 'rb').read(),
                        content_type='image/png')


def image2_view(request):
    if not settings.DEBUG_ROUTES:
        raise Http404()
    return HttpResponse(open('static/hover-dropdown-tip.png', 'rb').read(),
                        content_type='image/png')


def image3_view(request):
    if not settings.DEBUG_ROUTES:
        raise Http404()
    return HttpResponse(open('static/logo.png', 'rb').read(),
                        content_type='image/png')


def image4_view(request):
    if not settings.DEBUG_ROUTES:
        raise Http404()
    return HttpResponse(open('static/favicon.ico', 'rb').read(),
                        content_type='image/ico')
