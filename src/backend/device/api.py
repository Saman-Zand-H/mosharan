from django.http import HttpRequest
from ninja import Router
from ninja.pagination import LimitOffsetPagination, paginate
from ninja.responses import Status

from config.api_support import get_object_or_problem
from config.security import active_superuser_auth

from .models import (
    Device,
    DeviceType,
    DeviceTypeParameter,
    Gateway,
    ParameterDefinition,
)
from .schemas import (
    DeviceCreateIn,
    DeviceOut,
    DeviceTypeCreateIn,
    DeviceTypeOut,
    DeviceTypeParameterCreateIn,
    DeviceTypeParameterOut,
    DeviceTypeParameterUpdateIn,
    DeviceTypeUpdateIn,
    DeviceUpdateIn,
    GatewayCreateIn,
    GatewayOut,
    GatewayUpdateIn,
    ParameterCreateIn,
    ParameterOut,
    ParameterUpdateIn,
)
from .services import (
    create_device,
    create_device_type,
    create_device_type_parameter,
    create_gateway,
    create_parameter,
    delete_device,
    delete_device_type,
    delete_device_type_parameter,
    delete_gateway,
    delete_parameter,
    update_device,
    update_device_type,
    update_device_type_parameter,
    update_gateway,
    update_parameter,
)

management_router = Router(
    auth=active_superuser_auth,
    tags=["Platform management"],
    by_alias=True,
)


@management_router.get("/gateways", response=list[GatewayOut])
@paginate(LimitOffsetPagination)
def list_gateways(request: HttpRequest):
    return Gateway.objects.select_related("company").order_by("uid", "pk")


@management_router.get("/gateways/{pk}", response=GatewayOut)
def get_gateway(request: HttpRequest, pk: int):
    return get_object_or_problem(Gateway.objects.all(), pk=pk)


@management_router.post("/gateways", response={201: GatewayOut})
def post_gateway(request: HttpRequest, payload: GatewayCreateIn):
    return Status(201, create_gateway(payload))


@management_router.patch("/gateways/{pk}", response=GatewayOut)
def patch_gateway(request: HttpRequest, pk: int, payload: GatewayUpdateIn):
    return update_gateway(pk=pk, payload=payload)


@management_router.delete("/gateways/{pk}", response={204: None})
def remove_gateway(request: HttpRequest, pk: int):
    delete_gateway(pk=pk)
    return Status(204, None)


@management_router.get("/devices", response=list[DeviceOut])
@paginate(LimitOffsetPagination)
def list_devices(request: HttpRequest):
    return Device.objects.select_related("gateway", "device_type").order_by(
        "gateway__uid", "local_id", "pk"
    )


@management_router.get("/devices/{pk}", response=DeviceOut)
def get_device(request: HttpRequest, pk: int):
    return get_object_or_problem(Device.objects.all(), pk=pk)


@management_router.post("/devices", response={201: DeviceOut})
def post_device(request: HttpRequest, payload: DeviceCreateIn):
    return Status(201, create_device(payload))


@management_router.patch("/devices/{pk}", response=DeviceOut)
def patch_device(request: HttpRequest, pk: int, payload: DeviceUpdateIn):
    return update_device(pk=pk, payload=payload)


@management_router.delete("/devices/{pk}", response={204: None})
def remove_device(request: HttpRequest, pk: int):
    delete_device(pk=pk)
    return Status(204, None)


@management_router.get("/device-types", response=list[DeviceTypeOut])
@paginate(LimitOffsetPagination)
def list_device_types(request: HttpRequest):
    return DeviceType.objects.order_by("code", "pk")


@management_router.get("/device-types/{pk}", response=DeviceTypeOut)
def get_device_type(request: HttpRequest, pk: int):
    return get_object_or_problem(DeviceType.objects.all(), pk=pk)


@management_router.post("/device-types", response={201: DeviceTypeOut})
def post_device_type(request: HttpRequest, payload: DeviceTypeCreateIn):
    return Status(201, create_device_type(payload))


@management_router.patch("/device-types/{pk}", response=DeviceTypeOut)
def patch_device_type(request: HttpRequest, pk: int, payload: DeviceTypeUpdateIn):
    return update_device_type(pk=pk, payload=payload)


@management_router.delete("/device-types/{pk}", response={204: None})
def remove_device_type(request: HttpRequest, pk: int):
    delete_device_type(pk=pk)
    return Status(204, None)


@management_router.get("/parameters", response=list[ParameterOut])
@paginate(LimitOffsetPagination)
def list_parameters(request: HttpRequest):
    return ParameterDefinition.objects.order_by("code", "pk")


@management_router.get("/parameters/{pk}", response=ParameterOut)
def get_parameter(request: HttpRequest, pk: int):
    return get_object_or_problem(ParameterDefinition.objects.all(), pk=pk)


@management_router.post("/parameters", response={201: ParameterOut})
def post_parameter(request: HttpRequest, payload: ParameterCreateIn):
    return Status(201, create_parameter(payload))


@management_router.patch("/parameters/{pk}", response=ParameterOut)
def patch_parameter(request: HttpRequest, pk: int, payload: ParameterUpdateIn):
    return update_parameter(pk=pk, payload=payload)


@management_router.delete("/parameters/{pk}", response={204: None})
def remove_parameter(request: HttpRequest, pk: int):
    delete_parameter(pk=pk)
    return Status(204, None)


@management_router.get(
    "/device-type-parameters",
    response=list[DeviceTypeParameterOut],
)
@paginate(LimitOffsetPagination)
def list_device_type_parameters(request: HttpRequest):
    return DeviceTypeParameter.objects.select_related(
        "device_type", "parameter"
    ).order_by("device_type__code", "parameter__code", "pk")


@management_router.get(
    "/device-type-parameters/{pk}",
    response=DeviceTypeParameterOut,
)
def get_device_type_parameter(request: HttpRequest, pk: int):
    return get_object_or_problem(DeviceTypeParameter.objects.all(), pk=pk)


@management_router.post(
    "/device-type-parameters",
    response={201: DeviceTypeParameterOut},
)
def post_device_type_parameter(
    request: HttpRequest,
    payload: DeviceTypeParameterCreateIn,
):
    return Status(201, create_device_type_parameter(payload))


@management_router.patch(
    "/device-type-parameters/{pk}",
    response=DeviceTypeParameterOut,
)
def patch_device_type_parameter(
    request: HttpRequest,
    pk: int,
    payload: DeviceTypeParameterUpdateIn,
):
    return update_device_type_parameter(pk=pk, payload=payload)


@management_router.delete("/device-type-parameters/{pk}", response={204: None})
def remove_device_type_parameter(request: HttpRequest, pk: int):
    delete_device_type_parameter(pk=pk)
    return Status(204, None)
