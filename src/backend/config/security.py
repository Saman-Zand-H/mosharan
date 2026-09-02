from hashlib import sha256

from django.http import HttpRequest
from ninja.errors import HttpError
from ninja.security import SessionAuth, SessionAuthSuperUser
from ninja.throttling import SimpleRateThrottle
from ninja.utils import check_csrf


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
csrf_only_auth = CsrfOnlyAuth()
login_rate_throttle = LoginRateThrottle()
