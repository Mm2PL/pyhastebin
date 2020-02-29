# noinspection PyUnresolvedReferences
import datetime
import random
import string
import typing

import pytz
from django.http import Http404, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Paste, ExpiredPasteError


@csrf_exempt
def create_paste_view(request, delete_key: typing.Optional[str] = None):
    r = _ensure_method(request, ['POST', 'PUT'])
    if r:
        return r
    text = request.body.decode(errors='replace')

    if delete_key is None:
        delete_key = ''.join(random.choices(string.ascii_letters + string.digits, k=30))

    expire_time = request.GET.get('expire_time', None)
    utc_now = datetime.datetime.now(pytz.timezone('UTC'))
    if expire_time is None:
        expire_time = utc_now + datetime.timedelta(days=60)
    else:
        try:
            expire_time = datetime.datetime.fromisoformat(expire_time)
            expire_time = expire_time.astimezone(utc_now.tzinfo)
        except ValueError as e:
            resp = JsonResponse({
                'status': 400,
                'message': 'Bad request, bad ISO formatted date',
            })
            resp.status_code = 400
            resp.reason_phrase = 'Bad request'
            return resp
        if expire_time <= utc_now:
            resp = JsonResponse({
                'status': 400,
                'message': 'Bad request, date is in the past',
            })
            resp.status_code = 400
            resp.reason_phrase = 'Bad request'
            return resp

    id_ = ''.join(random.choices(string.ascii_letters + string.digits, k=15))

    paste = Paste(id=id_, text=text, delete_key=delete_key, expire_time=expire_time)
    paste.save()
    return JsonResponse({
        'status': 200,
        'message': 'Created paste',
        'key': id_,
        'delete_key': delete_key
    })


@csrf_exempt
def raw_paste_view(request, paste_id):
    r = _ensure_method(request)
    if r:
        return r

    try:
        return HttpResponse(Paste.get(paste_id).text)
    except Paste.DoesNotExist:
        resp = JsonResponse({
            'status': 404,
            'message': 'Not found.'
        })
        resp.status_code = 404
        resp.reason_phrase = 'Not found.'
        return resp
    except ExpiredPasteError:
        resp = JsonResponse({
            'status': 410,
            'message': 'Gone, paste has expired.'
        })
        resp.status_code = 410
        resp.reason_phrase = 'Gone'
        return resp


def _ensure_method(request, methods=None):
    if methods is None:
        methods = ['GET']
    if request.method not in methods:
        resp = JsonResponse({
            'status': 400,
            'message': f'Bad request, allowed methods: {", ".join(methods)}, but {request.method!r} was used',
            'allowed_methods': methods
        })
        resp.status_code = 400
        resp.reason_phrase = 'Bad request'
        return resp


@csrf_exempt
def delete_paste_view(request, paste_id, deletion_key):
    r = _ensure_method(request, ['POST', 'DELETE'])
    if r:
        return r

    try:
        paste = Paste.get(paste_id)
    except Paste.DoesNotExist as e:
        raise Http404('Paste does not exist') from e

    if paste.delete_key == deletion_key:
        paste.delete()
        return JsonResponse({
            'code': 200,
            'success': True,
            'paste_id': paste_id,
            'message': f'Successfully deleted paste id {paste_id}'
        })
    else:
        resp = JsonResponse({
            'code': 401,
            'success': False,
            'paste_id': paste_id,
            'message': f'Failed to delete paste id {paste_id}, bad deletion key'
        })
        resp.status_code = 401
        return resp


@csrf_exempt
def clean_pastes_view(request):
    r = _ensure_method(request, ['POST', 'DELETE'])
    if r:
        return r

    if not request.user.has_perm('clean_pastes'):
        resp = JsonResponse({
            'status': 401,
            'message': 'Unauthorized, not logged in or insufficient permissions'
        })
        resp.status_code = 401
        resp.reason_phrase = 'Unauthorized, not logged in or insufficient permissions'
        return resp

    now = datetime.datetime.now(pytz.timezone('UTC'))
    to_delete = Paste.objects.filter(expire_time__lte=now)
    num_deleted = to_delete.delete()[0]
    return JsonResponse({
        'status': 200,
        'message': f'Successfully deleted {num_deleted} pastes',
        'num_deleted': num_deleted
    })


def about_view(request):
    return HttpResponse('''
<html lang="en">

<head>
    <title>hastebin</title>
    <meta charset="utf-8"/>
    <link rel="stylesheet" type="text/css" href="solarized_dark.css"/>
    <link rel="stylesheet" type="text/css" href="application.css"/>

    <meta name="robots" content="noindex,nofollow"/>
</head>

<h1>Make this file static in prod, /about</h1>

<body style="color:#aaa;">
<h3>Pybin</h3>
Pybin is a small pastebin made to replace haste-server
</body>

</html>
''')
