import json
import os
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def get_credentials() -> Credentials:
    """Return Google API credentials.

    Checks, in order:
    1. GOOGLE_SERVICE_ACCOUNT_JSON env var — full JSON string of a service account key.
    2. GOOGLE_SERVICE_ACCOUNT_FILE env var — path to a service account key JSON file.
    3. OAuth2 user flow — requires GOOGLE_CLIENT_SECRETS_FILE (path to client_secrets.json).
       Persists the token to GOOGLE_TOKEN_FILE (default: token.json).
    """
    # --- Option 1: Service account JSON from environment variable ---
    sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        info = json.loads(sa_json)
        return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)

    # --- Option 2: Service account key file ---
    sa_file = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE")
    if sa_file and Path(sa_file).exists():
        return service_account.Credentials.from_service_account_file(sa_file, scopes=SCOPES)

    # --- Option 3: OAuth2 user credentials ---
    token_path = Path(os.environ.get("GOOGLE_TOKEN_FILE", "token.json"))
    creds: Credentials | None = None

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            secrets_file = os.environ.get("GOOGLE_CLIENT_SECRETS_FILE", "client_secrets.json")
            if not Path(secrets_file).exists():
                raise RuntimeError(
                    "No Google credentials found. Set one of:\n"
                    "  GOOGLE_SERVICE_ACCOUNT_JSON  – service account key as JSON string\n"
                    "  GOOGLE_SERVICE_ACCOUNT_FILE  – path to service account key file\n"
                    "  GOOGLE_CLIENT_SECRETS_FILE   – path to OAuth2 client secrets file\n"
                    "See README for setup instructions."
                )
            flow = InstalledAppFlow.from_client_secrets_file(secrets_file, SCOPES)
            creds = flow.run_local_server(port=0)

        token_path.write_text(creds.to_json())

    return creds
