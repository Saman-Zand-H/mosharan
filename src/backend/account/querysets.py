from typing import ClassVar

from django.db import models


class CompanyScopedQuerySet(models.QuerySet):
    """Scope company-owned records to an authenticated active user."""

    company_user_lookup: ClassVar[str]

    def visible_to(self, user: object):
        if not getattr(user, "is_authenticated", False) or not getattr(
            user, "is_active", False
        ):
            return self.none()
        user_id = getattr(user, "pk", None)
        if user_id is None:
            return self.none()
        if getattr(user, "is_superuser", False):
            return self.all()
        return self.filter(**{self.company_user_lookup: user_id})
