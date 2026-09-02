from typing import cast

from django.contrib.auth import authenticate, login, logout
from django.http import HttpRequest
from django.middleware.csrf import get_token
from ninja import Router
from ninja.pagination import LimitOffsetPagination, paginate
from ninja.responses import Status

from config.api_support import ApiProblem, get_object_or_problem
from config.security import (
    active_session_auth,
    active_superuser_auth,
    csrf_only_auth,
    login_rate_throttle,
)

from .models import Company, User
from .schemas import (
    CompanyCreateIn,
    CompanyOut,
    CompanyUpdateIn,
    CsrfOut,
    LoginIn,
    MeOut,
    PasswordUpdateIn,
    UserCreateIn,
    UserOut,
    UserUpdateIn,
)
from .services import (
    create_company,
    create_user,
    delete_company,
    delete_user,
    update_company,
    update_user,
    update_user_password,
)

auth_router = Router(tags=["Authentication"], by_alias=True)
management_router = Router(
    auth=active_superuser_auth,
    tags=["Platform management"],
    by_alias=True,
)


def me_payload(user: User) -> dict[str, object]:
    company = Company.objects.filter(user=user).only("id", "name").first()
    return {
        "id": user.pk,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_superuser": user.is_superuser,
        "company": company,
    }


@auth_router.get("/csrf", auth=None, response=CsrfOut)
def csrf_token(request: HttpRequest):
    return {"csrf_token": get_token(request)}


@auth_router.post(
    "/login",
    auth=csrf_only_auth,
    throttle=login_rate_throttle,
    response=MeOut,
)
def log_in(request: HttpRequest, payload: LoginIn):
    user = authenticate(
        request,
        username=payload.username,
        password=payload.password,
    )
    if user is None or not user.is_active:
        raise ApiProblem(
            status=401,
            code="invalid_credentials",
            message="Username or password is incorrect.",
        )
    typed_user = cast(User, user)
    login(request, typed_user)
    return me_payload(typed_user)


@auth_router.post("/logout", auth=active_session_auth, response={204: None})
def log_out(request: HttpRequest):
    logout(request)
    return Status(204, None)


@auth_router.get("/me", auth=active_session_auth, response=MeOut)
def current_user(request: HttpRequest):
    return me_payload(cast(User, getattr(request, "auth")))


@management_router.get("/users", response=list[UserOut])
@paginate(LimitOffsetPagination)
def list_users(request: HttpRequest):
    return User.objects.order_by("username", "pk")


@management_router.get("/users/{pk}", response=UserOut)
def get_user(request: HttpRequest, pk: int):
    return get_object_or_problem(User.objects.all(), pk=pk)


@management_router.post("/users", response={201: UserOut})
def post_user(request: HttpRequest, payload: UserCreateIn):
    return Status(201, create_user(payload))


@management_router.patch("/users/{pk}", response=UserOut)
def patch_user(request: HttpRequest, pk: int, payload: UserUpdateIn):
    return update_user(pk=pk, payload=payload)


@management_router.post("/users/{pk}/password", response={204: None})
def post_user_password(request: HttpRequest, pk: int, payload: PasswordUpdateIn):
    update_user_password(pk=pk, password=payload.password)
    return Status(204, None)


@management_router.delete("/users/{pk}", response={204: None})
def remove_user(request: HttpRequest, pk: int):
    delete_user(pk=pk)
    return Status(204, None)


@management_router.get("/companies", response=list[CompanyOut])
@paginate(LimitOffsetPagination)
def list_companies(request: HttpRequest):
    return Company.objects.select_related("user").order_by("name", "pk")


@management_router.get("/companies/{pk}", response=CompanyOut)
def get_company(request: HttpRequest, pk: int):
    return get_object_or_problem(Company.objects.all(), pk=pk)


@management_router.post("/companies", response={201: CompanyOut})
def post_company(request: HttpRequest, payload: CompanyCreateIn):
    return Status(201, create_company(payload))


@management_router.patch("/companies/{pk}", response=CompanyOut)
def patch_company(request: HttpRequest, pk: int, payload: CompanyUpdateIn):
    return update_company(pk=pk, payload=payload)


@management_router.delete("/companies/{pk}", response={204: None})
def remove_company(request: HttpRequest, pk: int):
    delete_company(pk=pk)
    return Status(204, None)
