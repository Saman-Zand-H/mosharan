from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction

from config.api_support import (
    ApiProblem,
    changed_values,
    delete_protected,
    get_object_or_problem,
    raise_validation_problem,
    save_validated,
)

from .models import Company, User
from .schemas import (
    CompanyCreateIn,
    CompanyUpdateIn,
    UserCreateIn,
    UserUpdateIn,
)


def _ordinary_user(*, pk: int, lock: bool = False) -> User:
    queryset = User.objects.all()
    if lock:
        queryset = queryset.select_for_update()
    user = get_object_or_problem(queryset, pk=pk)
    if user.is_superuser:
        raise ApiProblem(
            status=409,
            code="platform_admin_immutable",
            message="Platform administrators cannot be changed through this API.",
        )
    return user


def _company_user(*, pk: int) -> User:
    user = get_object_or_problem(User.objects.all(), pk=pk)
    if user.is_superuser:
        raise ApiProblem(
            status=422,
            code="validation_error",
            message="A platform administrator cannot represent a company.",
            fields={"userId": ["Select a regular user."]},
        )
    return user


@transaction.atomic
def create_user(payload: UserCreateIn) -> User:
    user = User(
        username=payload.username,
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        is_active=payload.is_active,
        is_staff=False,
        is_superuser=False,
    )
    try:
        validate_password(payload.password, user=user)
    except ValidationError as error:
        raise_validation_problem(error)
    user.set_password(payload.password)
    return save_validated(user)


@transaction.atomic
def update_user(*, pk: int, payload: UserUpdateIn) -> User:
    user = _ordinary_user(pk=pk, lock=True)
    values = changed_values(payload)
    for field, value in values.items():
        setattr(user, field, value)
    return save_validated(user, update_fields=(*values,))


@transaction.atomic
def update_user_password(*, pk: int, password: str) -> None:
    user = _ordinary_user(pk=pk, lock=True)
    try:
        validate_password(password, user=user)
    except ValidationError as error:
        raise_validation_problem(error)
    user.set_password(password)
    user.save(update_fields=("password",))


@transaction.atomic
def delete_user(*, pk: int) -> None:
    user = _ordinary_user(pk=pk, lock=True)
    delete_protected(user)


@transaction.atomic
def create_company(payload: CompanyCreateIn) -> Company:
    company = Company(name=payload.name, user=_company_user(pk=payload.user_id))
    return save_validated(company)


@transaction.atomic
def update_company(*, pk: int, payload: CompanyUpdateIn) -> Company:
    company = get_object_or_problem(
        Company.objects.select_for_update(),
        pk=pk,
    )
    values = changed_values(payload)
    if "user_id" in values:
        user_id = values.pop("user_id")
        if not isinstance(user_id, int):
            raise ApiProblem(
                status=422,
                code="validation_error",
                message="Submitted data is invalid.",
                fields={"userId": ["This field may not be null."]},
            )
        company.user = _company_user(pk=user_id)
        values["user"] = company.user
    for field, value in values.items():
        setattr(company, field, value)
    return save_validated(company, update_fields=(*values,))


@transaction.atomic
def delete_company(*, pk: int) -> None:
    company = get_object_or_problem(
        Company.objects.select_for_update(),
        pk=pk,
    )
    delete_protected(company)
