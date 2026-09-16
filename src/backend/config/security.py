from hashlib import sha256

from django.http import HttpRequest
from ninja.errors import HttpError
from ninja.security import HttpBearer, SessionAuth, SessionAuthSuperUser
from ninja.throttling import SimpleRateThrottle
from ninja.utils import check_csrf

from device.models import Gateway


class ActiveSessionAuth(SessionAuth):
    def authenticate(self, request: HttpRequest, key: str | None):
        user = super().authenticate(request, key)
        if user is not None and user.is_active:
            return user
        return None


class ActiveSuperuserSessionAuth(SessionAuthSuperUser):
    def authenticate(self, request: HttpRequest, key: str | None):
        user = super().authenticate(request, key)
        if user is not None and user.is_active:
            return user
        return None


class GatewayTokenAuth(HttpBearer):
    """Authenticate hardware with a per-gateway bearer token.

    The gateway UID is sent in ``X-Gateway-UID`` so a token remains opaque and
    can be rotated without exposing identity in the credential itself. Only an
    active gateway with a matching stored hash is accepted.
    """

    def authenticate(self, request: HttpRequest, token: str):
        gateway_uid = request.headers.get("X-Gateway-UID", "").strip()
        if not gateway_uid or len(gateway_uid) > 64 or not token or len(token) > 256:
            return None
        gateway = Gateway.objects.filter(uid=gateway_uid, is_active=True).first()
        if gateway is None or not gateway.check_ingest_token(token):
            return None
        return gateway


class CsrfOnlyAuth:
    def __call__(self, request: HttpRequest) -> bool:
        if check_csrf(request):
            raise HttpError(403, "CSRF check failed.")
        return True


class LoginRateThrottle(SimpleRateThrottle):
    scope = "login"

    def __init__(self) -> None:
        super().__init__(rate="10/5m")

    def get_cache_key(self, request: HttpRequest) -> str:
        identity = request.META.get("REMOTE_ADDR") or "unknown"
        digest = sha256(identity.encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": digest}


active_session_auth = ActiveSessionAuth()
active_superuser_auth = ActiveSuperuserSessionAuth()
gateway_token_auth = GatewayTokenAuth()
csrf_only_auth = CsrfOnlyAuth()
login_rate_throttle = LoginRateThrottle()
