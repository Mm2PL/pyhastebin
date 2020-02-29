from django.urls import path

from . import views

urlpatterns = [
    path('raw/<slug:paste_id>', views.raw_paste_view),
    path('delete/<slug:paste_id>/<slug:deletion_key>', views.delete_paste_view),
    path('documents', views.create_paste_view),
    path('create', views.create_paste_view),
    path('create/<slug:delete_key>', views.create_paste_view),
    path('clean', views.clean_pastes_view),
    path('about', views.about_view)
]
