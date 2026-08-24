import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from device.models import (
    Device,
    DeviceType,
    DeviceTypeParameter,
    Gateway,
    ParameterDefinition,
)
from widgets.mixins.models import TimestampedMixin


class EventType(TimestampedMixin):
    code = models.CharField(max_length=64, unique=True, verbose_name=_("Code"))
    title = models.CharField(max_length=255, verbose_name=_("Title"))

    class Meta:
        verbose_name = _("Event Type")
        verbose_name_plural = _("Event Types")

    def __str__(self) -> str:
        return self.title


class PayloadSchema(TimestampedMixin):
    event_type = models.ForeignKey(
        EventType,
        on_delete=models.PROTECT,
        related_name="payload_schemas",
        verbose_name=_("Event Type"),
    )
    device_type = models.ForeignKey(
        DeviceType,
        on_delete=models.PROTECT,
        related_name="payload_schemas",
        verbose_name=_("Device Type"),
    )
    version = models.PositiveIntegerField(verbose_name=_("Version"))
    encoding = models.CharField(
        max_length=16,
        default="utf-8",
        editable=False,
        verbose_name=_("Encoding"),
    )
    expected_length = models.PositiveIntegerField(
        blank=True,
        null=True,
        verbose_name=_("Expected Length"),
    )

    class Meta:
        verbose_name = _("Payload Schema")
        verbose_name_plural = _("Payload Schemas")
        constraints = [
            models.UniqueConstraint(
                fields=("event_type", "device_type", "version"),
                name="uniq_event_device_schema_version",
            ),
            models.CheckConstraint(
                condition=Q(expected_length__isnull=True) | Q(expected_length__gt=0),
                name="schema_expected_length_positive",
            ),
            models.CheckConstraint(
                condition=Q(version__gt=0),
                name="schema_version_positive",
            ),
            models.CheckConstraint(
                condition=Q(encoding="utf-8"),
                name="schema_encoding_utf8",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.event_type.code}/{self.device_type.code}/v{self.version}"


class PayloadField(TimestampedMixin):
    class WireCodec(models.TextChoices):
        INTEGER = "integer", _("Integer")
        UTF8 = "utf8", _("UTF-8 String")
        BOOLEAN = "boolean", _("Boolean")

    class Role(models.TextChoices):
        METRIC = "metric", _("Metric")
        TIMESTAMP = "timestamp", _("Timestamp")
        SEQUENCE = "sequence", _("Sequence")
        CHECKSUM = "checksum", _("Checksum")

    payload_schema = models.ForeignKey(
        PayloadSchema,
        on_delete=models.CASCADE,
        related_name="fields",
        verbose_name=_("Payload Schema"),
    )
    code = models.CharField(max_length=64, verbose_name=_("Code"))
    name = models.CharField(max_length=255, verbose_name=_("Name"))
    start_byte = models.PositiveIntegerField(verbose_name=_("Start Byte"))
    end_byte = models.PositiveIntegerField(verbose_name=_("End Byte"))
    wire_codec = models.CharField(
        max_length=16,
        choices=WireCodec,
        verbose_name=_("Wire Codec"),
    )
    role = models.CharField(
        max_length=16,
        choices=Role,
        default=Role.METRIC,
        verbose_name=_("Role"),
    )

    class Meta:
        verbose_name = _("Payload Field")
        verbose_name_plural = _("Payload Fields")
        constraints = [
            models.UniqueConstraint(
                fields=("payload_schema", "code"),
                name="uniq_schema_payload_field_code",
            ),
            models.UniqueConstraint(
                fields=("payload_schema",),
                condition=Q(role="timestamp"),
                name="uniq_schema_timestamp_field",
            ),
            models.CheckConstraint(
                condition=Q(end_byte__gt=models.F("start_byte")),
                name="payload_field_end_after_start",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.payload_schema}:{self.code}"

    def clean(self) -> None:
        super().clean()
        errors = {}
        payload_schema = (
            self.payload_schema if self.payload_schema_id is not None else None
        )
        if (
            payload_schema is not None
            and payload_schema.expected_length is not None
            and self.end_byte > payload_schema.expected_length
        ):
            errors["end_byte"] = _("End byte exceeds expected payload length.")
        if (
            self.role == self.Role.TIMESTAMP
            and self.wire_codec != self.WireCodec.INTEGER
        ):
            errors["wire_codec"] = _("Timestamp fields must use integer codec.")
        if errors:
            raise ValidationError(errors)


class ProjectionRule(TimestampedMixin):
    class SourceKind(models.TextChoices):
        FIELD = "field", _("Payload Field")
        CONSTANT = "constant", _("Constant")

    payload_schema = models.ForeignKey(
        PayloadSchema,
        on_delete=models.CASCADE,
        related_name="projection_rules",
        verbose_name=_("Payload Schema"),
    )
    parameter = models.ForeignKey(
        ParameterDefinition,
        on_delete=models.PROTECT,
        related_name="projection_rules",
        verbose_name=_("Parameter"),
    )
    source_kind = models.CharField(
        max_length=16,
        choices=SourceKind,
        verbose_name=_("Source Kind"),
    )
    source_field = models.ForeignKey(
        PayloadField,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="projection_rules",
        verbose_name=_("Source Field"),
    )
    constant_value = models.JSONField(
        blank=True,
        null=True,
        verbose_name=_("Constant Value"),
    )
    conversion_config = models.JSONField(
        blank=True,
        default=dict,
        verbose_name=_("Conversion Config"),
    )

    class Meta:
        verbose_name = _("Projection Rule")
        verbose_name_plural = _("Projection Rules")
        constraints = [
            models.UniqueConstraint(
                fields=("payload_schema", "parameter"),
                name="uniq_schema_parameter_projection",
            ),
            models.CheckConstraint(
                condition=(
                    Q(
                        source_kind="field",
                        source_field__isnull=False,
                        constant_value__isnull=True,
                    )
                    | Q(
                        source_kind="constant",
                        source_field__isnull=True,
                        constant_value__isnull=False,
                    )
                ),
                name="projection_has_one_source",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        errors = {}
        payload_schema = (
            self.payload_schema if self.payload_schema_id is not None else None
        )
        source_field = self.source_field if self.source_field_id is not None else None
        if (
            source_field is not None
            and payload_schema is not None
            and source_field.payload_schema_id != payload_schema.id
        ):
            errors["source_field"] = _("Source field must belong to payload schema.")
        if (
            payload_schema is not None
            and self.parameter_id is not None
            and not DeviceTypeParameter.objects.filter(
                device_type_id=payload_schema.device_type_id,
                parameter_id=self.parameter_id,
            ).exists()
        ):
            errors["parameter"] = _("Parameter is not supported by device type.")
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.payload_schema} -> {self.parameter.code}"


class RawEvent(models.Model):
    class Status(models.TextChoices):
        RECEIVED = "received", _("Received")
        PROCESSED = "processed", _("Processed")
        FAILED = "failed", _("Failed")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    gateway = models.ForeignKey(
        Gateway,
        on_delete=models.PROTECT,
        related_name="raw_events",
        verbose_name=_("Gateway"),
    )
    device = models.ForeignKey(
        Device,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="raw_events",
        verbose_name=_("Device"),
    )
    received_gateway_uid = models.CharField(
        max_length=64,
        verbose_name=_("Received Gateway UID"),
    )
    received_local_id = models.CharField(
        max_length=64,
        verbose_name=_("Received Local ID"),
    )
    received_schema_version = models.PositiveIntegerField(
        verbose_name=_("Received Schema Version"),
    )
    event_type = models.ForeignKey(
        EventType,
        on_delete=models.PROTECT,
        related_name="raw_events",
        verbose_name=_("Event Type"),
    )
    payload_schema = models.ForeignKey(
        PayloadSchema,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="raw_events",
        verbose_name=_("Payload Schema"),
    )
    raw_payload = models.TextField(blank=True, verbose_name=_("Raw Payload"))
    received_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Received At"))
    device_timestamp = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name=_("Device Timestamp"),
    )
    message_id = models.CharField(max_length=128, verbose_name=_("Message ID"))
    status = models.CharField(
        max_length=16,
        choices=Status,
        default=Status.RECEIVED,
        verbose_name=_("Status"),
    )
    parsing_error = models.TextField(blank=True, verbose_name=_("Parsing Error"))

    class Meta:
        verbose_name = _("Raw Event")
        verbose_name_plural = _("Raw Events")
        constraints = [
            models.UniqueConstraint(
                fields=("gateway", "message_id"),
                name="uniq_gateway_message_id",
            ),
            models.CheckConstraint(
                condition=Q(received_schema_version__gt=0),
                name="raw_schema_version_positive",
            ),
        ]
        indexes = [
            models.Index(
                fields=("gateway", "-received_at"), name="raw_gateway_time_idx"
            ),
            models.Index(fields=("status", "received_at"), name="raw_status_time_idx"),
        ]

    def clean(self) -> None:
        super().clean()
        errors = {}
        device = self.device if self.device_id is not None else None
        payload_schema = (
            self.payload_schema if self.payload_schema_id is not None else None
        )
        if device is not None and device.gateway_id != self.gateway_id:
            errors["device"] = _("Device must belong to gateway.")
        if (
            payload_schema is not None
            and payload_schema.event_type_id != self.event_type_id
        ):
            errors["payload_schema"] = _("Payload schema must match event type.")
        if (
            payload_schema is not None
            and device is not None
            and payload_schema.device_type_id != device.device_type_id
        ):
            errors["payload_schema"] = _("Payload schema must match device type.")
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.gateway.uid}:{self.message_id}"


class ParameterReading(models.Model):
    raw_event = models.ForeignKey(
        RawEvent,
        on_delete=models.PROTECT,
        related_name="parameter_readings",
        verbose_name=_("Raw Event"),
    )
    device = models.ForeignKey(
        Device,
        on_delete=models.PROTECT,
        related_name="parameter_readings",
        verbose_name=_("Device"),
    )
    parameter = models.ForeignKey(
        ParameterDefinition,
        on_delete=models.PROTECT,
        related_name="readings",
        verbose_name=_("Parameter"),
    )
    projection_rule = models.ForeignKey(
        ProjectionRule,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="parameter_readings",
        verbose_name=_("Projection Rule"),
    )
    observed_at = models.DateTimeField(verbose_name=_("Observed At"))
    integer_value = models.BigIntegerField(
        blank=True,
        null=True,
        verbose_name=_("Integer Value"),
    )
    datetime_value = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name=_("Datetime Value"),
    )
    string_value = models.TextField(
        blank=True,
        null=True,
        verbose_name=_("String Value"),
    )
    boolean_value = models.BooleanField(
        blank=True,
        null=True,
        verbose_name=_("Boolean Value"),
    )
    date_created = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_("Date Created"),
    )

    class Meta:
        verbose_name = _("Parameter Reading")
        verbose_name_plural = _("Parameter Readings")
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(integer_value__isnull=False)
                    & Q(datetime_value__isnull=True)
                    & Q(string_value__isnull=True)
                    & Q(boolean_value__isnull=True)
                    | Q(integer_value__isnull=True)
                    & Q(datetime_value__isnull=False)
                    & Q(string_value__isnull=True)
                    & Q(boolean_value__isnull=True)
                    | Q(integer_value__isnull=True)
                    & Q(datetime_value__isnull=True)
                    & Q(string_value__isnull=False)
                    & Q(boolean_value__isnull=True)
                    | Q(integer_value__isnull=True)
                    & Q(datetime_value__isnull=True)
                    & Q(string_value__isnull=True)
                    & Q(boolean_value__isnull=False)
                ),
                name="reading_has_one_typed_value",
            ),
            models.UniqueConstraint(
                fields=("raw_event", "device", "parameter"),
                name="uniq_event_device_parameter_reading",
            ),
        ]
        indexes = [
            models.Index(
                fields=("device", "parameter", "-observed_at"),
                name="reading_device_param_time_idx",
            )
        ]

    def clean(self) -> None:
        super().clean()
        errors = {}
        raw_event = self.raw_event if self.raw_event_id is not None else None
        device = self.device if self.device_id is not None else None
        parameter = self.parameter if self.parameter_id is not None else None
        value_fields: dict[str, str] = {
            ParameterDefinition.ValueType.INTEGER.value: "integer_value",
            ParameterDefinition.ValueType.DATETIME.value: "datetime_value",
            ParameterDefinition.ValueType.STRING.value: "string_value",
            ParameterDefinition.ValueType.BOOLEAN.value: "boolean_value",
        }
        expected_field = (
            value_fields.get(parameter.value_type) if parameter is not None else None
        )
        if expected_field is not None and getattr(self, expected_field) is None:
            errors[expected_field] = _("Value must match parameter type.")
        if (
            raw_event is not None
            and device is not None
            and raw_event.device_id != device.id
        ):
            errors["device"] = _("Device must match raw event device.")
        if (
            device is not None
            and parameter is not None
            and not DeviceTypeParameter.objects.filter(
                device_type_id=device.device_type_id,
                parameter_id=parameter.id,
            ).exists()
        ):
            errors["parameter"] = _("Parameter is not supported by device type.")
        projection_rule = (
            self.projection_rule if self.projection_rule_id is not None else None
        )
        if (
            projection_rule is not None
            and parameter is not None
            and projection_rule.parameter_id != parameter.id
        ):
            errors["projection_rule"] = _("Projection rule must target parameter.")
        if (
            projection_rule is not None
            and raw_event is not None
            and projection_rule.payload_schema_id != raw_event.payload_schema_id
        ):
            errors["projection_rule"] = _(
                "Projection rule must belong to raw event payload schema."
            )
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.device}:{self.parameter.code}@{self.observed_at.isoformat()}"
