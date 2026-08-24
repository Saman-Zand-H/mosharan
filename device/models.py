from django.db import models
from django.utils.translation import gettext_lazy as _

from widgets.mixins.models import TimestampedMixin


class DeviceType(TimestampedMixin):
    code = models.CharField(max_length=64, unique=True, verbose_name=_("Code"))
    title = models.CharField(max_length=255, verbose_name=_("Title"))

    class Meta:
        verbose_name = _("Device Type")
        verbose_name_plural = _("Device Types")

    def __str__(self) -> str:
        return self.title


class ParameterDefinition(TimestampedMixin):
    class ValueType(models.TextChoices):
        INTEGER = "integer", _("Integer")
        DATETIME = "datetime", _("Datetime")
        STRING = "string", _("String")
        BOOLEAN = "boolean", _("Boolean")

    code = models.CharField(max_length=64, unique=True, verbose_name=_("Code"))
    title = models.CharField(max_length=255, verbose_name=_("Title"))
    value_type = models.CharField(
        max_length=16,
        choices=ValueType,
        verbose_name=_("Value Type"),
    )
    unit = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        verbose_name=_("Unit"),
    )

    class Meta:
        verbose_name = _("Parameter Definition")
        verbose_name_plural = _("Parameter Definitions")

    def __str__(self) -> str:
        return self.title


class DeviceTypeParameter(TimestampedMixin):
    device_type = models.ForeignKey(
        DeviceType,
        on_delete=models.PROTECT,
        related_name="parameter_assignments",
        verbose_name=_("Device Type"),
    )
    parameter = models.ForeignKey(
        ParameterDefinition,
        on_delete=models.PROTECT,
        related_name="device_type_assignments",
        verbose_name=_("Parameter"),
    )

    class Meta:
        verbose_name = _("Device Type Parameter")
        verbose_name_plural = _("Device Type Parameters")
        constraints = [
            models.UniqueConstraint(
                fields=("device_type", "parameter"),
                name="uniq_device_type_parameter",
            )
        ]

    def __str__(self) -> str:
        return f"{self.device_type} / {self.parameter}"


class Gateway(TimestampedMixin):
    uid = models.CharField(max_length=64, unique=True, verbose_name=_("UID"))
    title = models.CharField(max_length=255, verbose_name=_("Title"))
    is_active = models.BooleanField(default=True, verbose_name=_("Is Active"))

    class Meta:
        verbose_name = _("Gateway")
        verbose_name_plural = _("Gateways")

    def __str__(self) -> str:
        return self.title


class Device(TimestampedMixin):
    gateway = models.ForeignKey(
        Gateway,
        on_delete=models.PROTECT,
        related_name="devices",
        verbose_name=_("Gateway"),
    )
    device_type = models.ForeignKey(
        DeviceType,
        on_delete=models.PROTECT,
        related_name="devices",
        verbose_name=_("Device Type"),
    )
    local_id = models.CharField(max_length=64, verbose_name=_("Local ID"))
    is_active = models.BooleanField(default=True, verbose_name=_("Is Active"))

    class Meta:
        verbose_name = _("Device")
        verbose_name_plural = _("Devices")
        constraints = [
            models.UniqueConstraint(
                fields=("gateway", "local_id"),
                name="uniq_gateway_local_device",
            )
        ]

    def __str__(self) -> str:
        return f"{self.gateway.uid}:{self.local_id}"
