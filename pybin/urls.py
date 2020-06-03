from django.urls import path, re_path

from pyhatebin import settings
from . import views

urlpatterns = [
    path('raw/<slug:paste_id>', views.raw_paste_view),
    path('delete/<slug:paste_id>/<slug:deletion_key>', views.delete_paste_view),
    path('documents', views.create_paste_view),
    path('documents/', views.create_paste_view),
    path('documents/<slug:paste_id>', views.json_paste_view),
    path('create', views.create_paste_view),
    path('create/<slug:delete_key>', views.create_paste_view),
    path('clean', views.clean_pastes_view),
    path('about', views.about_view),
    path('', views.index_view),
    re_path(r'^(?!clean|about|create'
            r'|application(?:\.min)?\.(js|css)'
            r'|favicon\.ico'
            r'|logo\.png'
            r'|solarized_dark\.css'
            r'|highlight(?:\.min)?\.js)[a-zA-Z0-9.]+$',
            lambda r, match: views.index_view(r)),
]

if settings.DEBUG_ROUTES:  # host these files on your own :)
    from . import debug_views

    urlpatterns += [
        path('application.css', debug_views.css_view),
        path('solarized_dark.css', debug_views.css2_view),
        path('application.js', debug_views.script_view),
        path('highlight.min.js', debug_views.highlight_view),
        path('function-icons.png', debug_views.image_view),
        path('hover-dropdown-tip.png', debug_views.image2_view),
        path('logo.png', debug_views.image3_view),
        path('favicon.ico', debug_views.image4_view)
    ]
