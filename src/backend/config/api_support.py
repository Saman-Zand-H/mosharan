from collections.abc import Iterable
from typing import Any, TypeVar

from django.core.exceptions import ValidationError
from django.db import IntegrityError, models
from django.db.models.deletion import ProtectedError
from django.utils.encoding import force_str
from ninja import Schema
from pydantic import ConfigDict


def _to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ApiSchema(Schema):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        extra="forbid",
        from_attributes=True,
        populate_by_name=True,
    )


class ApiProblem(Exception):
    def __init__(
        self,
        *,
        status: int,
        code: str,
        message: str,
        fields: dict[str, list[str]] | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields


ModelT = TypeVar("ModelT", bound=models.Model)


def get_object_or_problem(
    queryset: models.QuerySet[ModelT],
    *,
    pk: int,
) -> ModelT:
    try:
        return queryset.get(pk=pk)
    except queryset.model.DoesNotExist as error:
        raise ApiProblem(
            status=404,
            code="not_found",
            message="Resource was not found.",
        ) from error


def save_validated(
    instance: ModelT,
    *,
    update_fields: Iterable[str] | None = None,
) -> ModelT:
    try:
        instance.full_clean()
        if update_fields is None:
            instance.save()
        else:
            fields = tuple(update_fields)
            concrete_field_names = {
                field.name for field in instance._meta.concrete_fields
            }
            if "date_updated" in concrete_field_names:
                fields = tuple(dict.fromkeys((*fields, "date_updated")))
            instance.save(update_fields=fields)
    except ValidationError as error:
        raise_validation_problem(error)
    except IntegrityError as error:
        raise ApiProblem(
            status=409,
            code="conflict",
            message="Resource conflicts with an existing record.",
        ) from error
    return instance


def delete_protected(instance: models.Model) -> None:
    try:
        instance.delete()
    except ProtectedError as error:
        protected_counts: dict[str, int] = {}
        for protected in error.protected_objects:
            name = protected._meta.label_lower
            protected_counts[name] = protected_counts.get(name, 0) + 1
        summary = ", ".join(
            f"{name}: {count}" for name, count in sorted(protected_counts.items())
        )
        message = "Resource is still in use."
        if summary:
            message = f"{message} Protected references: {summary}."
        raise ApiProblem(
            status=409,
            code="resource_in_use",
            message=message,
        ) from error
    except IntegrityError as error:
        raise ApiProblem(
            status=409,
            code="resource_in_use",
            message="Resource is still in use.",
        ) from error


def raise_validation_problem(error: ValidationError) -> None:
    if hasattr(error, "message_dict"):
        fields = {
            _to_camel(name): [force_str(message) for message in messages]
            for name, messages in error.message_dict.items()
        }
    else:
        fields = {"__all__": [force_str(message) for message in error.messages]}
    raise ApiProblem(
        status=422,
        code="validation_error",
        message="Submitted data is invalid.",
        fields=fields,
    ) from error


def changed_values(payload: ApiSchema) -> dict[str, Any]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ApiProblem(
            status=422,
            code="validation_error",
            message="At least one field must be supplied.",
            fields={"__all__": ["At least one field must be supplied."]},
        )
    return values
