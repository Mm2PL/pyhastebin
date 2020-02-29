import datetime

from django.db import models


class ExpiredPasteError(Exception):
    def __repr__(self):
        return 'Paste expired'


class Paste(models.Model):
    class Meta:
        verbose_name = "Paste"
        verbose_name_plural = "Pastes"


    id = models.SlugField(primary_key=True)

    expire_time = models.DateTimeField('Expire time', null=True)
    text = models.TextField('Text')
    delete_key = models.SlugField()

    def check_expired(self):
        if self.expire_time is None:
            return False
        now = datetime.datetime.now(self.expire_time.tzinfo)
        if self.expire_time <= now:
            return True
        return False

    @classmethod
    def get(cls, paste_id):
        obj = cls.objects.get(id=paste_id)
        has_expired = obj.check_expired()
        if has_expired:
            obj.delete()
            obj.save()
            raise ExpiredPasteError()
        return obj
