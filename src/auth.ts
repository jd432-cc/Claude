import { google, sheets_v4 } from "googleapis";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export function getSheetsClient(): sheets_v4.Sheets {
  const keyfilePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  const keyfileJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  const accessToken = process.env.GOOGLE_ACCESS_TOKEN;

  if (accessToken) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return google.sheets({ version: "v4", auth });
  }

  if (keyfileJson) {
    const credentials = JSON.parse(keyfileJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
  }

  if (keyfilePath) {
    const resolved = resolve(keyfilePath);
    if (!existsSync(resolved)) {
      throw new Error(`Service account key file not found: ${resolved}`);
    }
    const credentials = JSON.parse(readFileSync(resolved, "utf-8"));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
  }

  // Fall back to Application Default Credentials (e.g. gcloud auth)
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}
