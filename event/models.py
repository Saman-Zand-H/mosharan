from django.db import models
from django.utils.translation import gettext_lazy as _

from device.models import DeviceParameter
from widgets.mixins.models import TimestampedMixin


class EventPayloadStructure(TimestampedMixin):
    class Meta:
        verbose_name = _("Event Payload Structure")
        verbose_name_plural = _("Event Payload Structures")

    event_type = models.CharField(
        max_length=255, verbose_name=_("Event Type"), unique=True
    )


class EventPayloadStructureItem(TimestampedMixin):
    class Meta:
        verbose_name = _("Event Payload Structure Item")
        verbose_name_plural = _("Event Payload Structure Items")

    payload_structure = models.ForeignKey(
        EventPayloadStructure,
        on_delete=models.CASCADE,
        related_name="event_payload_structure_items",
        verbose_name=_("Payload Structure"),
    )
    device_parameter = models.ForeignKey(
        DeviceParameter,
        on_delete=models.CASCADE,
        related_name="event_payload_structure_items",
        verbose_name=_("Device Parameter"),
    )
