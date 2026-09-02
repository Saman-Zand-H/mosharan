from django.db import transaction

from account.models import Company
from config.api_support import (
    ApiProblem,
    changed_values,
    delete_protected,
    get_object_or_problem,
    save_validated,
)
from event.models import ParameterReading, ProjectionRule, RawEvent

from .models import (
    Device,
    DeviceType,
    DeviceTypeParameter,
    Gateway,
    ParameterDefinition,
)
from .schemas import (
    DeviceCreateIn,
    DeviceTypeCreateIn,
    DeviceTypeParameterCreateIn,
    DeviceTypeParameterUpdateIn,
    DeviceTypeUpdateIn,
    DeviceUpdateIn,
    GatewayCreateIn,
    GatewayUpdateIn,
    ParameterCreateIn,
    ParameterUpdateIn,
)


def _required_foreign_key(
    values: dict[str, object],
    field: str,
) -> int | None:
    if field not in values:
        return None
    value = values.pop(field)
    if not isinstance(value, int):
        raise ApiProblem(
            status=422,
            code="validation_error",
            message="Submitted data is invalid.",
            fields={field.removesuffix("_id") + "Id": ["This field may not be null."]},
        )
    return value


def _projection_uses_assignment(assignment: DeviceTypeParameter) -> bool:
    return ProjectionRule.objects.filter(
        payload_schema__device_type_id=assignment.device_type_id,
        parameter_id=assignment.parameter_id,
    ).exists()


@transaction.atomic
def create_gateway(payload: GatewayCreateIn) -> Gateway:
    company = None
    if payload.company_id is not None:
        company = get_object_or_problem(Company.objects.all(), pk=payload.company_id)
    return save_validated(
        Gateway(
            company=company,
            uid=payload.uid,
            title=payload.title,
            is_active=payload.is_active,
        )
    )


@transaction.atomic
def update_gateway(*, pk: int, payload: GatewayUpdateIn) -> Gateway:
    gateway = get_object_or_problem(Gateway.objects.select_for_update(), pk=pk)
    values = changed_values(payload)
    if (
        "uid" in values
        and values["uid"] != gateway.uid
        and RawEvent.objects.filter(gateway=gateway).exists()
    ):
        raise ApiProblem(
            status=409,
            code="gateway_identity_in_use",
            message="A gateway UID cannot change after receiving an event.",
        )
    if "company_id" in values:
        company_id = values.pop("company_id")
        current_company_id = gateway.company.pk if gateway.company is not None else None
        if current_company_id is not None and company_id != current_company_id:
            raise ApiProblem(
                status=409,
                code="gateway_transfer_blocked",
                message="An assigned gateway cannot be transferred through this API.",
            )
        company = None
        if isinstance(company_id, int):
            company = get_object_or_problem(Company.objects.all(), pk=company_id)
        values["company"] = company
    for field, value in values.items():
        setattr(gateway, field, value)
    return save_validated(gateway, update_fields=(*values,))


@transaction.atomic
def delete_gateway(*, pk: int) -> None:
    gateway = get_object_or_problem(Gateway.objects.select_for_update(), pk=pk)
    delete_protected(gateway)


@transaction.atomic
def create_device(payload: DeviceCreateIn) -> Device:
    gateway = get_object_or_problem(Gateway.objects.all(), pk=payload.gateway_id)
    device_type = get_object_or_problem(
        DeviceType.objects.all(),
        pk=payload.device_type_id,
    )
    return save_validated(
        Device(
            gateway=gateway,
            device_type=device_type,
            local_id=payload.local_id,
            is_active=payload.is_active,
        )
    )


@transaction.atomic
def update_device(*, pk: int, payload: DeviceUpdateIn) -> Device:
    device = get_object_or_problem(
        Device.objects.select_for_update().select_related("gateway", "device_type"),
        pk=pk,
    )
    values = changed_values(payload)
    identity_changed = (
        ("gateway_id" in values and values["gateway_id"] != device.gateway.pk)
        or (
            "device_type_id" in values
            and values["device_type_id"] != device.device_type.pk
        )
        or ("local_id" in values and values["local_id"] != device.local_id)
    )
    if identity_changed and (
        RawEvent.objects.filter(device=device).exists()
        or ParameterReading.objects.filter(device=device).exists()
    ):
        raise ApiProblem(
            status=409,
            code="device_identity_in_use",
            message="Device identity cannot change after telemetry is recorded.",
        )
    gateway_id = _required_foreign_key(values, "gateway_id")
    if gateway_id is not None:
        values["gateway"] = get_object_or_problem(
            Gateway.objects.all(),
            pk=gateway_id,
        )
    device_type_id = _required_foreign_key(values, "device_type_id")
    if device_type_id is not None:
        values["device_type"] = get_object_or_problem(
            DeviceType.objects.all(),
            pk=device_type_id,
        )
    for field, value in values.items():
        setattr(device, field, value)
    return save_validated(device, update_fields=(*values,))


@transaction.atomic
def delete_device(*, pk: int) -> None:
    device = get_object_or_problem(Device.objects.select_for_update(), pk=pk)
    delete_protected(device)


@transaction.atomic
def create_device_type(payload: DeviceTypeCreateIn) -> DeviceType:
    return save_validated(DeviceType(code=payload.code, title=payload.title))


@transaction.atomic
def update_device_type(*, pk: int, payload: DeviceTypeUpdateIn) -> DeviceType:
    device_type = get_object_or_problem(
        DeviceType.objects.select_for_update(),
        pk=pk,
    )
    values = changed_values(payload)
    for field, value in values.items():
        setattr(device_type, field, value)
    return save_validated(device_type, update_fields=(*values,))


@transaction.atomic
def delete_device_type(*, pk: int) -> None:
    device_type = get_object_or_problem(
        DeviceType.objects.select_for_update(),
        pk=pk,
    )
    delete_protected(device_type)


@transaction.atomic
def create_parameter(payload: ParameterCreateIn) -> ParameterDefinition:
    return save_validated(
        ParameterDefinition(
            code=payload.code,
            title=payload.title,
            value_type=payload.value_type,
            unit=payload.unit,
        )
    )


@transaction.atomic
def update_parameter(*, pk: int, payload: ParameterUpdateIn) -> ParameterDefinition:
    parameter = get_object_or_problem(
        ParameterDefinition.objects.select_for_update(),
        pk=pk,
    )
    values = changed_values(payload)
    new_value_type = values.get("value_type")
    if (
        new_value_type is not None
        and new_value_type != parameter.value_type
        and (
            ParameterReading.objects.filter(parameter=parameter).exists()
            or ProjectionRule.objects.filter(parameter=parameter).exists()
        )
    ):
        raise ApiProblem(
            status=409,
            code="parameter_type_in_use",
            message="A parameter type cannot change after it is used.",
        )
    for field, value in values.items():
        setattr(parameter, field, value)
    return save_validated(parameter, update_fields=(*values,))


@transaction.atomic
def delete_parameter(*, pk: int) -> None:
    parameter = get_object_or_problem(
        ParameterDefinition.objects.select_for_update(),
        pk=pk,
    )
    delete_protected(parameter)


@transaction.atomic
def create_device_type_parameter(
    payload: DeviceTypeParameterCreateIn,
) -> DeviceTypeParameter:
    device_type = get_object_or_problem(
        DeviceType.objects.all(),
        pk=payload.device_type_id,
    )
    parameter = get_object_or_problem(
        ParameterDefinition.objects.all(),
        pk=payload.parameter_id,
    )
    return save_validated(
        DeviceTypeParameter(device_type=device_type, parameter=parameter)
    )


@transaction.atomic
def update_device_type_parameter(
    *,
    pk: int,
    payload: DeviceTypeParameterUpdateIn,
) -> DeviceTypeParameter:
    assignment = get_object_or_problem(
        DeviceTypeParameter.objects.select_for_update(),
        pk=pk,
    )
    values = changed_values(payload)
    if _projection_uses_assignment(assignment):
        raise ApiProblem(
            status=409,
            code="assignment_in_use",
            message="An assignment used by a projection rule cannot change.",
        )
    device_type_id = _required_foreign_key(values, "device_type_id")
    if device_type_id is not None:
        values["device_type"] = get_object_or_problem(
            DeviceType.objects.all(),
            pk=device_type_id,
        )
    parameter_id = _required_foreign_key(values, "parameter_id")
    if parameter_id is not None:
        values["parameter"] = get_object_or_problem(
            ParameterDefinition.objects.all(),
            pk=parameter_id,
        )
    for field, value in values.items():
        setattr(assignment, field, value)
    return save_validated(assignment, update_fields=(*values,))


@transaction.atomic
def delete_device_type_parameter(*, pk: int) -> None:
    assignment = get_object_or_problem(
        DeviceTypeParameter.objects.select_for_update(),
        pk=pk,
    )
    if _projection_uses_assignment(assignment):
        raise ApiProblem(
            status=409,
            code="assignment_in_use",
            message="An assignment used by a projection rule cannot be deleted.",
        )
    delete_protected(assignment)
