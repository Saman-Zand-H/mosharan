from django.contrib.admin import AdminSite, ModelAdmin
from django.contrib.auth.admin import GroupAdmin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group
from django.http import HttpRequest, HttpResponse
from django.utils.translation import gettext_lazy as _

from account.models import Company, User
from device.models import (
    Device,
    DeviceType,
    DeviceTypeParameter,
    Gateway,
    ParameterDefinition,
)
from event.models import (
    EventType,
    ParameterReading,
    PayloadField,
    PayloadSchema,
    ProjectionRule,
    RawEvent,
    Visualization,
    VisualizationTab,
)

from .security import LoginRateThrottle


class PlatformAdminSite(AdminSite):
    site_header = _("Device Telemetry Administration")
    site_title = _("Device Telemetry Admin")
    index_title = _("Platform Administration")

    def has_permission(self, request) -> bool:
        return bool(request.user.is_active and request.user.is_superuser)

    def login(
        self,
        request: HttpRequest,
        extra_context: dict[str, object] | None = None,
    ) -> HttpResponse:
        if request.method == "POST" and not LoginRateThrottle().allow_request(request):
            return HttpResponse("Too many login attempts.", status=429)
        return super().login(request, extra_context)


class UserAdmin(BaseUserAdmin):
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        (_("Personal info"), {"fields": ("first_name", "last_name", "email")}),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "email",
                    "password1",
                    "password2",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                ),
            },
        ),
    )
    list_display = ("username", "email", "is_active", "is_superuser")
    list_filter = ("is_active", "is_staff", "is_superuser")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering = ("username",)


class ServiceManagedAdmin(ModelAdmin):
    """Keep service invariants from being bypassed by direct ModelAdmin saves."""

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False


class CompanyAdmin(ServiceManagedAdmin):
    list_display = ("name", "user", "date_created")
    search_fields = ("name", "user__username", "user__email")


class GatewayAdmin(ServiceManagedAdmin):
    list_display = ("uid", "title", "company", "is_active")
    list_filter = ("company", "is_active")
    search_fields = ("uid", "title", "company__name")


platform_admin_site = PlatformAdminSite(name="platform_admin")
platform_admin_site.register(Group, GroupAdmin)
platform_admin_site.register(User, UserAdmin)
platform_admin_site.register(Company, CompanyAdmin)
platform_admin_site.register(Gateway, GatewayAdmin)
platform_admin_site.register(Device, ServiceManagedAdmin)
platform_admin_site.register(DeviceType, ServiceManagedAdmin)
platform_admin_site.register(DeviceTypeParameter, ServiceManagedAdmin)
platform_admin_site.register(ParameterDefinition, ServiceManagedAdmin)
platform_admin_site.register(EventType, ServiceManagedAdmin)
platform_admin_site.register(PayloadSchema, ServiceManagedAdmin)
platform_admin_site.register(PayloadField, ServiceManagedAdmin)
platform_admin_site.register(ProjectionRule, ServiceManagedAdmin)
platform_admin_site.register(RawEvent, ServiceManagedAdmin)
platform_admin_site.register(ParameterReading, ServiceManagedAdmin)
platform_admin_site.register(VisualizationTab, ServiceManagedAdmin)
platform_admin_site.register(Visualization, ServiceManagedAdmin)
