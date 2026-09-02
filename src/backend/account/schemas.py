from datetime import datetime

from pydantic import Field

from config.api_support import ApiSchema


class CompanySummaryOut(ApiSchema):
    id: int
    name: str


class MeOut(ApiSchema):
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    is_superuser: bool
    company: CompanySummaryOut | None


class CsrfOut(ApiSchema):
    csrf_token: str


class LoginIn(ApiSchema):
    username: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=1, max_length=256)


class UserOut(ApiSchema):
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    is_active: bool
    is_superuser: bool
    date_joined: datetime


class UserCreateIn(ApiSchema):
    username: str = Field(min_length=1, max_length=150)
    email: str = Field(min_length=1, max_length=254)
    first_name: str = Field(min_length=1, max_length=150)
    last_name: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=1, max_length=256)
    is_active: bool = True


class UserUpdateIn(ApiSchema):
    username: str | None = Field(default=None, min_length=1, max_length=150)
    email: str | None = Field(default=None, min_length=1, max_length=254)
    first_name: str | None = Field(default=None, min_length=1, max_length=150)
    last_name: str | None = Field(default=None, min_length=1, max_length=150)
    is_active: bool | None = None


class PasswordUpdateIn(ApiSchema):
    password: str = Field(min_length=1, max_length=256)


class CompanyOut(ApiSchema):
    id: int
    name: str
    user_id: int
    date_created: datetime
    date_updated: datetime


class CompanyCreateIn(ApiSchema):
    name: str = Field(min_length=1, max_length=255)
    user_id: int = Field(gt=0)


class CompanyUpdateIn(ApiSchema):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    user_id: int | None = Field(default=None, gt=0)
