from django.db import models
from django.utils.translation import gettext_lazy as _


class DateUpdatedMixin(models.Model):
    date_updated = models.DateTimeField(auto_now=True, verbose_name=_("Date Updated"))

    class Meta:
        abstract = True


class DateCreatedMixin(models.Model):
    date_created = models.DateTimeField(
        auto_now_add=True, verbose_name=_("Date Created")
    )

    class Meta:
        abstract = True


class TimestampedMixin(DateUpdatedMixin, DateCreatedMixin):
    class Meta:
        abstract = True
