import json

from django.core.management import call_command
from django.test import Client, TestCase

from account.models import User
from device.models import Gateway
from event.models import RawEvent


class HardwareIngestionApiTests(TestCase):
    gateway_uid = "DEMO-GW-001"
    gateway_token = "test-gateway-token-for-api"

    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo_data", verbosity=0)
        gateway = Gateway.objects.get(uid=cls.gateway_uid)
        gateway.set_ingest_token(cls.gateway_token)
        gateway.save(update_fields=("ingest_token_hash", "date_updated"))
        admin = User(
            username="hardware-test-admin",
            email="hardware-test-admin@example.com",
            is_staff=True,
            is_superuser=True,
            is_active=True,
        )
        admin.set_password("test-admin-password-123")
        admin.save()
        cls.admin = admin

    def test_platform_admin_can_rotate_gateway_token(self):
        self.client.force_login(self.admin)
        gateway = Gateway.objects.get(uid=self.gateway_uid)

        response = self.client.post(
            f"/api/v1/management/gateways/{gateway.pk}/ingest-token",
        )

        self.assertEqual(response.status_code, 200)
        token = response.json()["token"]
        gateway.refresh_from_db()
        self.assertTrue(gateway.ingest_token_configured)
        self.assertTrue(gateway.check_ingest_token(token))
        self.assertNotEqual(gateway.ingest_token_hash, token)
        self.assertFalse(gateway.check_ingest_token(self.gateway_token))

    def post_ingest(self, **overrides):
        payload = {
            "deviceLocalId": "sensor-001",
            "eventTypeCode": "telemetry",
            "schemaVersion": 1,
            "messageId": "hardware-test-message",
            "payload": "1724937600002500641 ",
            **overrides,
        }
        return self.client.post(
            "/api/v1/ingest",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.gateway_token}",
            HTTP_X_GATEWAY_UID=self.gateway_uid,
        )

    def test_valid_payload_uses_matching_schema_and_projects_readings(self):
        response = self.post_ingest()

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["status"], "processed")
        self.assertTrue(body["created"])
        self.assertEqual(len(body["readingIds"]), 4)

    def test_retry_returns_existing_readings_without_creating_another_event(self):
        first = self.post_ingest()
        second = self.post_ingest()

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertFalse(second.json()["created"])
        self.assertEqual(
            first.json()["readingIds"],
            second.json()["readingIds"],
        )

    def test_wrong_token_is_rejected(self):
        response = self.client.post(
            "/api/v1/ingest",
            data=json.dumps(
                {
                    "deviceLocalId": "sensor-001",
                    "eventTypeCode": "telemetry",
                    "schemaVersion": 1,
                    "messageId": "unauthorized-message",
                    "payload": "1724937600002500641 ",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer wrong-token",
            HTTP_X_GATEWAY_UID=self.gateway_uid,
        )

        self.assertEqual(response.status_code, 401)

    def test_hardware_request_does_not_require_browser_csrf_token(self):
        client = Client(enforce_csrf_checks=True)
        response = client.post(
            "/api/v1/ingest",
            data=json.dumps(
                {
                    "deviceLocalId": "sensor-001",
                    "eventTypeCode": "telemetry",
                    "schemaVersion": 1,
                    "messageId": "hardware-no-csrf-message",
                    "payload": "1724937600002500641 ",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.gateway_token}",
            HTTP_X_GATEWAY_UID=self.gateway_uid,
        )

        self.assertEqual(response.status_code, 201)

    def test_reusing_message_id_with_changed_payload_is_a_conflict(self):
        first = self.post_ingest()
        second = self.post_ingest(payload="1724937600002600641 ")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json()["code"], "idempotency_conflict")

    def test_unknown_schema_is_retained_as_a_failed_raw_event(self):
        response = self.post_ingest(
            schemaVersion=999,
            messageId="hardware-unknown-schema-message",
            payload="not-decoded",
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], "unknown_payload_schema")
        event = RawEvent.objects.get(message_id="hardware-unknown-schema-message")
        self.assertEqual(event.status, RawEvent.Status.FAILED)

    def test_schema_invalid_payload_is_retained_as_a_failed_raw_event(self):
        response = self.post_ingest(
            messageId="hardware-malformed-payload-message",
            payload="too-short",
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], "payload_parsing_error")
        event = RawEvent.objects.get(message_id="hardware-malformed-payload-message")
        self.assertEqual(event.status, RawEvent.Status.FAILED)
