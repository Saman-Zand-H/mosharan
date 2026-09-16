from datetime import datetime
from typing import Literal

from pydantic import Field

from config.api_support import ApiSchema

ParameterValueType = Literal["integer", "datetime", "string", "boolean"]


class DeviceTypeOut(ApiSchema):
    id: int
    code: str
    title: str
    date_created: datetime
    date_updated: datetime


class DeviceTypeCreateIn(ApiSchema):
    code: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)


class DeviceTypeUpdateIn(ApiSchema):
    code: str | None = Field(default=None, min_length=1, max_length=64)
    title: str | None = Field(default=None, min_length=1, max_length=255)


class ParameterOut(ApiSchema):
    id: int
    code: str
    title: str
    value_type: ParameterValueType
    unit: str | None
    date_created: datetime
    date_updated: datetime


class ParameterCreateIn(ApiSchema):
    code: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)
    value_type: ParameterValueType
    unit: str | None = Field(default=None, max_length=64)


class ParameterUpdateIn(ApiSchema):
    code: str | None = Field(default=None, min_length=1, max_length=64)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    value_type: ParameterValueType | None = None
    unit: str | None = Field(default=None, max_length=64)


class DeviceTypeParameterOut(ApiSchema):
    id: int
    device_type_id: int
    parameter_id: int
    date_created: datetime
    date_updated: datetime


class DeviceTypeParameterCreateIn(ApiSchema):
    device_type_id: int = Field(gt=0)
    parameter_id: int = Field(gt=0)


class DeviceTypeParameterUpdateIn(ApiSchema):
    device_type_id: int | None = Field(default=None, gt=0)
    parameter_id: int | None = Field(default=None, gt=0)


class GatewayOut(ApiSchema):
    id: int
    company_id: int | None
    uid: str
    title: str
    is_active: bool
    ingest_token_configured: bool
    date_created: datetime
    date_updated: datetime


class GatewayTokenOut(ApiSchema):
    gateway_id: int
    gateway_uid: str
    token: str


class GatewayCreateIn(ApiSchema):
    company_id: int | None = Field(default=None, gt=0)
    uid: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)
    is_active: bool = True


class GatewayUpdateIn(ApiSchema):
    company_id: int | None = Field(default=None, gt=0)
    uid: str | None = Field(default=None, min_length=1, max_length=64)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None


class DeviceOut(ApiSchema):
    id: int
    gateway_id: int
    device_type_id: int
    local_id: str
    is_active: bool
    date_created: datetime
    date_updated: datetime


class DeviceCreateIn(ApiSchema):
    gateway_id: int = Field(gt=0)
    device_type_id: int = Field(gt=0)
    local_id: str = Field(min_length=1, max_length=64)
    is_active: bool = True


class DeviceUpdateIn(ApiSchema):
    gateway_id: int | None = Field(default=None, gt=0)
    device_type_id: int | None = Field(default=None, gt=0)
    local_id: str | None = Field(default=None, min_length=1, max_length=64)
    is_active: bool | None = None
