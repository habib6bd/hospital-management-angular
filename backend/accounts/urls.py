from django.urls import path
from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenObtainPairView,
    TokenRefreshView,
)

from .views import MeView

app_name = "accounts"

urlpatterns = [
    # Stock SimpleJWT views already reproduce the mock's exact status codes and
    # detail messages ("No active account found with the given credentials",
    # "Token is invalid or expired") — see backend/docs/API_CONTRACT.md §2.
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/blacklist/", TokenBlacklistView.as_view(), name="token_blacklist"),
    path("auth/me/", MeView.as_view(), name="auth_me"),
]
