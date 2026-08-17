from django.db import models
from django.utils.translation import gettext_lazy as _

from widgets.mixins.models import TimestampedMixin


class DeviceType(TimestampedMixin):
    class Meta:
        verbose_name = _("Device Type")
        verbose_name_plural = _("Device Types")

    title = models.CharField(max_length=255, verbose_name=_("Name"))


class DeviceParameter(TimestampedMixin):
    class Meta:
        verbose_name = _("Device Parameter")
        verbose_name_plural = _("Device Parameters")

    device_type = models.ForeignKey(
        DeviceType,
        on_delete=models.CASCADE,
        verbose_name=_("Device Type"),
        related_name="device_parameters",
    )
    title = models.CharField(max_length=255, verbose_name=_("Title"))


class GatewayDevice(TimestampedMixin):
    class Meta:
        verbose_name = _("Owner Device")
        verbose_name_plural = _("Owner Devices")

    uid = models.CharField(
        max_length=12,
        verbose_name=_("UID"),
        unique=True,
        primary_key=True,
    )
    title = models.CharField(max_length=255, verbose_name=_("Title"))


class Device(TimestampedMixin):
    class Meta:
        verbose_name = _("Device")
        verbose_name_plural = _("Devices")

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "local_id",
                    "owner",
                ],  # device local id and the owner device uid (pk) are unique together
                name="unique_device_local_id_and_owner",
            )
        ]

    local_id = models.CharField(max_length=1, verbose_name=_("Local ID"))
    device_type = models.ForeignKey(
        DeviceType,
        on_delete=models.CASCADE,
        verbose_name=_("Device Type"),
        related_name="devices",
    )
    gateway = models.ForeignKey(
        GatewayDevice,
        on_delete=models.CASCADE,
        verbose_name=_("Device Owner"),
        related_name="devices",
    )


class DeviceParameterValue(TimestampedMixin):
    class Meta:
        verbose_name = _("Device Parameter Value")
        verbose_name_plural = _("Device Parameter Values")

    device = models.ForeignKey(
        Device,
        on_delete=models.CASCADE,
        verbose_name=_("Device"),
        related_name="device_parameter_values",
    )
    device_parameter = models.ForeignKey(
        DeviceParameter,
        on_delete=models.CASCADE,
        related_name="device_parameter_values",
        verbose_name=_("Device Parameter"),
    )
