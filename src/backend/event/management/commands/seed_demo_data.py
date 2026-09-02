import os
from math import cos, pi, sin

from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction
from django.utils import timezone

from account.models import Company, User
from device.models import (
    Device,
    DeviceType,
    DeviceTypeParameter,
    Gateway,
    ParameterDefinition,
)
from event.models import (
    EventType,
    PayloadField,
    PayloadSchema,
    ProjectionRule,
    RawEvent,
    Visualization,
    VisualizationTab,
)
from event.services import IdempotencyConflictError, IngestionRequest, ingest_event

DEMO_USERNAME = "demo"
DEMO_PASSWORD = "demo-password"
DEMO_EMAIL = "demo@example.com"


def ensure(model, lookup: dict[str, object], defaults: dict[str, object]):
    """Create a stable demo row without overwriting a user's local edits."""
    instance, created = model.objects.get_or_create(**lookup, defaults=defaults)
    if created:
        instance.full_clean()
        instance.save()
    return instance


class Command(BaseCommand):
    help = "Create repeatable local demo data for the telemetry platform."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--password",
            default=os.getenv("DEMO_USER_PASSWORD", DEMO_PASSWORD),
            help="Password for the newly created demo user (default: demo-password).",
        )
        parser.add_argument(
            "--reset-password",
            action="store_true",
            help="Reset the existing demo user's password to --password.",
        )

    @transaction.atomic
    def handle(self, *args: object, **options: object) -> None:
        password = str(options["password"])
        user, user_created = User.objects.get_or_create(
            username=DEMO_USERNAME,
            defaults={
                "email": DEMO_EMAIL,
                "first_name": "Demo",
                "last_name": "Operator",
                "is_active": True,
            },
        )
        if user_created or options["reset_password"]:
            user.set_password(password)
            user.save(update_fields=["password"])

        company = ensure(
            Company,
            {"user": user},
            {"name": "کارخانهٔ نمونه"},
        )
        device_type = ensure(
            DeviceType,
            {"code": "environment-sensor"},
            {"title": "حسگر محیطی"},
        )
        parameters = {
            "temperature": ensure(
                ParameterDefinition,
                {"code": "temperature"},
                {
                    "title": "دما",
                    "value_type": ParameterDefinition.ValueType.INTEGER,
                    "unit": "°C",
                },
            ),
            "humidity": ensure(
                ParameterDefinition,
                {"code": "humidity"},
                {
                    "title": "رطوبت",
                    "value_type": ParameterDefinition.ValueType.INTEGER,
                    "unit": "%",
                },
            ),
            "battery_ok": ensure(
                ParameterDefinition,
                {"code": "battery_ok"},
                {
                    "title": "باتری سالم",
                    "value_type": ParameterDefinition.ValueType.BOOLEAN,
                    "unit": None,
                },
            ),
            "measured_at": ensure(
                ParameterDefinition,
                {"code": "measured_at"},
                {
                    "title": "زمان اندازه‌گیری",
                    "value_type": ParameterDefinition.ValueType.DATETIME,
                    "unit": None,
                },
            ),
            "voltage_1": ensure(
                ParameterDefinition,
                {"code": "voltage_1"},
                {
                    "title": "ولتاژ ۱",
                    "value_type": ParameterDefinition.ValueType.INTEGER,
                    "unit": "mV",
                },
            ),
            "voltage_2": ensure(
                ParameterDefinition,
                {"code": "voltage_2"},
                {
                    "title": "ولتاژ ۲",
                    "value_type": ParameterDefinition.ValueType.INTEGER,
                    "unit": "mV",
                },
            ),
            "alarm_active": ensure(
                ParameterDefinition,
                {"code": "alarm_active"},
                {
                    "title": "هشدار فعال",
                    "value_type": ParameterDefinition.ValueType.BOOLEAN,
                    "unit": None,
                },
            ),
        }
        for parameter in parameters.values():
            ensure(
                DeviceTypeParameter,
                {"device_type": device_type, "parameter": parameter},
                {},
            )

        gateway = ensure(
            Gateway,
            {"uid": "DEMO-GW-001"},
            {
                "company": company,
                "title": "درگاه کارخانهٔ نمونه",
                "is_active": True,
            },
        )
        devices = [
            ensure(
                Device,
                {"gateway": gateway, "local_id": "sensor-001"},
                {"device_type": device_type, "is_active": True},
            ),
            ensure(
                Device,
                {"gateway": gateway, "local_id": "sensor-002"},
                {"device_type": device_type, "is_active": True},
            ),
        ]

        event_type = ensure(
            EventType,
            {"code": "telemetry"},
            {"title": "تله‌متری محیطی"},
        )
        schema = ensure(
            PayloadSchema,
            {
                "event_type": event_type,
                "device_type": device_type,
                "version": 1,
            },
            {"expected_length": 20},
        )
        fields = {
            "timestamp": ensure(
                PayloadField,
                {"payload_schema": schema, "code": "timestamp"},
                {
                    "name": "زمان دستگاه",
                    "start_byte": 0,
                    "end_byte": 10,
                    "wire_codec": PayloadField.WireCodec.INTEGER,
                    "role": PayloadField.Role.TIMESTAMP,
                },
            ),
            "temperature": ensure(
                PayloadField,
                {"payload_schema": schema, "code": "temperature"},
                {
                    "name": "دما",
                    "start_byte": 10,
                    "end_byte": 14,
                    "wire_codec": PayloadField.WireCodec.INTEGER,
                    "role": PayloadField.Role.METRIC,
                },
            ),
            "humidity": ensure(
                PayloadField,
                {"payload_schema": schema, "code": "humidity"},
                {
                    "name": "رطوبت",
                    "start_byte": 14,
                    "end_byte": 18,
                    "wire_codec": PayloadField.WireCodec.INTEGER,
                    "role": PayloadField.Role.METRIC,
                },
            ),
            "battery_ok": ensure(
                PayloadField,
                {"payload_schema": schema, "code": "battery_ok"},
                {
                    "name": "باتری سالم",
                    "start_byte": 18,
                    "end_byte": 20,
                    "wire_codec": PayloadField.WireCodec.BOOLEAN,
                    "role": PayloadField.Role.METRIC,
                },
            ),
        }
        ensure(
            ProjectionRule,
            {"payload_schema": schema, "parameter": parameters["measured_at"]},
            {
                "source_kind": ProjectionRule.SourceKind.FIELD,
                "source_field": fields["timestamp"],
                "constant_value": None,
                "conversion_config": {"timestamp_unit": "seconds"},
            },
        )
        for code in ("temperature", "humidity", "battery_ok"):
            ensure(
                ProjectionRule,
                {"payload_schema": schema, "parameter": parameters[code]},
                {
                    "source_kind": ProjectionRule.SourceKind.FIELD,
                    "source_field": fields[code],
                    "constant_value": None,
                    "conversion_config": {},
                },
            )

        # A second schema carries two voltage channels and a second boolean so
        # the dashboard seed demonstrates tabs, charts, and mixed binary state.
        dashboard_schema = ensure(
            PayloadSchema,
            {
                "event_type": event_type,
                "device_type": device_type,
                "version": 2,
            },
            {"expected_length": 30},
        )
        dashboard_field_specs = (
            (
                "timestamp",
                "زمان دستگاه",
                0,
                10,
                PayloadField.WireCodec.INTEGER,
                PayloadField.Role.TIMESTAMP,
            ),
            (
                "temperature",
                "دما",
                10,
                14,
                PayloadField.WireCodec.INTEGER,
                PayloadField.Role.METRIC,
            ),
            (
                "humidity",
                "رطوبت",
                14,
                18,
                PayloadField.WireCodec.INTEGER,
                PayloadField.Role.METRIC,
            ),
            (
                "voltage_1",
                "ولتاژ ۱",
                18,
                22,
                PayloadField.WireCodec.INTEGER,
                PayloadField.Role.METRIC,
            ),
            (
                "voltage_2",
                "ولتاژ ۲",
                22,
                26,
                PayloadField.WireCodec.INTEGER,
                PayloadField.Role.METRIC,
            ),
            (
                "battery_ok",
                "باتری سالم",
                26,
                28,
                PayloadField.WireCodec.BOOLEAN,
                PayloadField.Role.METRIC,
            ),
            (
                "alarm_active",
                "هشدار فعال",
                28,
                30,
                PayloadField.WireCodec.BOOLEAN,
                PayloadField.Role.METRIC,
            ),
        )
        dashboard_fields = {
            code: ensure(
                PayloadField,
                {"payload_schema": dashboard_schema, "code": code},
                {
                    "name": name,
                    "start_byte": start,
                    "end_byte": end,
                    "wire_codec": codec,
                    "role": role,
                },
            )
            for code, name, start, end, codec, role in dashboard_field_specs
        }
        dashboard_targets = {
            "measured_at": ("timestamp", {"timestamp_unit": "seconds"}),
            "temperature": ("temperature", {}),
            "humidity": ("humidity", {}),
            "voltage_1": ("voltage_1", {}),
            "voltage_2": ("voltage_2", {}),
            "battery_ok": ("battery_ok", {}),
            "alarm_active": ("alarm_active", {}),
        }
        for parameter_code, (
            field_code,
            conversion_config,
        ) in dashboard_targets.items():
            ensure(
                ProjectionRule,
                {
                    "payload_schema": dashboard_schema,
                    "parameter": parameters[parameter_code],
                },
                {
                    "source_kind": ProjectionRule.SourceKind.FIELD,
                    "source_field": dashboard_fields[field_code],
                    "constant_value": None,
                    "conversion_config": conversion_config,
                },
            )

        environment_tab = ensure(
            VisualizationTab,
            {"device_type": device_type, "code": "environment"},
            {"title": "محیط", "sort_order": 10, "is_active": True},
        )
        voltage_tab = ensure(
            VisualizationTab,
            {"device_type": device_type, "code": "voltages"},
            {"title": "ولتاژها", "sort_order": 20, "is_active": True},
        )
        visualization_specs = (
            (environment_tab, "temperature", "دما", Visualization.ChartType.LINE, 10),
            (environment_tab, "humidity", "رطوبت", Visualization.ChartType.AREA, 20),
            (
                voltage_tab,
                "voltage_1",
                "ولتاژ کانال ۱",
                Visualization.ChartType.LINE,
                10,
            ),
            (
                voltage_tab,
                "voltage_2",
                "ولتاژ کانال ۲",
                Visualization.ChartType.BAR,
                20,
            ),
        )
        for tab, parameter_code, title, chart_type, sort_order in visualization_specs:
            ensure(
                Visualization,
                {"tab": tab, "y_axis": parameters[parameter_code]},
                {
                    "chart_type": chart_type,
                    "x_axis": None,
                    "y_axis": parameters[parameter_code],
                    "sort_order": sort_order,
                    "is_active": True,
                },
            )

        dashboard_bucket = int(timezone.now().timestamp()) // 3600
        dashboard_base = dashboard_bucket * 3600

        def dashboard_payload(
            timestamp: int,
            temperature: int,
            humidity: int,
            voltage_1: int,
            voltage_2: int,
            battery_ok: bool,
            alarm_active: bool,
        ) -> str:
            return (
                f"{timestamp:010d}{temperature:04d}{humidity:04d}"
                f"{voltage_1:04d}{voltage_2:04d}"
                f"{'1 ' if battery_ok else '0 '}{'1 ' if alarm_active else '0 '}"
            )

        samples: list[tuple[Device, str, int, str]] = [
            (devices[0], "demo-event-001", 1, "1724937600002500641 "),
            (devices[0], "demo-event-002", 1, "1724937660002600651 "),
            (devices[1], "demo-event-003", 1, "1724937720002400581 "),
        ]
        for hour_offset in range(7 * 24):
            observed_timestamp = dashboard_base - hour_offset * 3600
            day_phase = (observed_timestamp % 86400) / 86400 * 2 * pi
            slow_phase = (observed_timestamp // 3600) / (7 * 24) * 2 * pi
            for device_index, device in enumerate(devices):
                device_phase = device_index * pi / 5
                temperature = round(
                    25
                    + device_index
                    + 5 * sin(day_phase - pi / 2 + device_phase)
                    + 2 * sin(slow_phase)
                )
                humidity = round(
                    58
                    - device_index * 3
                    + 12 * cos(day_phase - pi / 3 + device_phase)
                    + 3 * cos(slow_phase)
                )
                voltage_1 = round(
                    1190
                    + device_index * 12
                    + 35 * sin(day_phase + device_phase)
                    + 10 * cos(slow_phase)
                )
                voltage_2 = round(
                    1175
                    + device_index * 10
                    + 30 * sin(day_phase + pi / 4 + device_phase)
                    + 8 * cos(slow_phase)
                )
                # Derive binary values from the absolute hour, not the current
                # invocation's relative offset. This keeps an existing
                # device/hour payload byte-for-byte stable when the rolling
                # window advances and the command is rerun later.
                absolute_hour = observed_timestamp // 3600
                battery_ok = absolute_hour % (29 + device_index * 3) != 0
                alarm_active = (absolute_hour + device_index * 7) % 37 in {0, 1, 2}
                samples.append(
                    (
                        device,
                        f"dashboard-history-{device.local_id}-{observed_timestamp}",
                        2,
                        dashboard_payload(
                            observed_timestamp,
                            temperature,
                            humidity,
                            voltage_1,
                            voltage_2,
                            battery_ok,
                            alarm_active,
                        ),
                    )
                )
        for device, message_id, schema_version, payload in samples:
            try:
                ingest_event(
                    IngestionRequest(
                        gateway_uid=gateway.uid,
                        device_local_id=device.local_id,
                        event_type_code=event_type.code,
                        schema_version=schema_version,
                        message_id=message_id,
                        payload=payload,
                    )
                )
            except IdempotencyConflictError:
                # Older local databases may contain a generated history row
                # whose binary values used the invocation-relative formula.
                # Raw events are immutable, so preserve that row and continue;
                # all newly-created rows use the absolute-hour formula above.
                if not message_id.startswith("dashboard-history-"):
                    raise

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo data ready: {VisualizationTab.objects.count()} tabs, "
                f"{Visualization.objects.count()} visualizations, and "
                f"{RawEvent.objects.filter(status=RawEvent.Status.PROCESSED).count()} processed events."
            )
        )
        if user_created or options["reset_password"]:
            self.stdout.write(f"Demo login: {DEMO_USERNAME} / {password}")
        else:
            self.stdout.write(
                f"Demo user already existed; password unchanged ({DEMO_USERNAME})."
            )
