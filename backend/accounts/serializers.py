from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class AuthUserSerializer(serializers.ModelSerializer):
    """Wire shape for AuthUserDto (src/app/core/auth/auth.model.ts)."""

    # `patient` is the FK; Django's `<field>_id` accessor already gives the raw
    # id with no extra join, so this reads straight off that attribute.
    patient_id = serializers.IntegerField(read_only=True)

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
