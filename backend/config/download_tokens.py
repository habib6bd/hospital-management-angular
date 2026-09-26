"""
Signed, time-limited download tokens for the `download-url` endpoints
(invoices, portal reports). Each `download-url` response promises a `url`
with a `sig=` query param and an `expires_at` 5 minutes out (see
backend/docs/API_CONTRACT.md §8/§9) — this is what actually makes that
signature real instead of the placeholder string it used to be.

The signed link itself is the authorization: once issued to a caller who
passed the ownership/role check in the `download-url` view, the matching
`/file/` view only needs to verify the signature and its expiry, not
re-derive the caller's identity. This mirrors how a presigned S3/GCS URL
works — anyone holding the link can use it, but only for 5 minutes and only
for the exact resource it was signed for.
"""

from django.core import signing

DOWNLOAD_TOKEN_MAX_AGE_SECONDS = 5 * 60


def make_download_token(kind: str, resource_id: int) -> str:
    signer = signing.TimestampSigner(salt=f"hms.download.{kind}")
    return signer.sign(str(resource_id))


def verify_download_token(kind: str, resource_id: int, token: str | None) -> bool:
    if not token:
        return False
    signer = signing.TimestampSigner(salt=f"hms.download.{kind}")
    try:
        value = signer.unsign(token, max_age=DOWNLOAD_TOKEN_MAX_AGE_SECONDS)
    except signing.BadSignature:
        return False
    return value == str(resource_id)
