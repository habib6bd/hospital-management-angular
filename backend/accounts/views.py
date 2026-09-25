from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import AuthUserSerializer


class MeView(APIView):
    """GET /api/auth/me/ -> AuthUserDto."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(AuthUserSerializer(request.user).data)
