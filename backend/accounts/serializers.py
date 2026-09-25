from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class AuthUserSerializer(serializers.ModelSerializer):
    """Wire shape for AuthUserDto (src/app/core/auth/auth.model.ts)."""

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "staff_id",
            "patient_id",
            "avatar_url",
        ]
        read_only_fields = fields
