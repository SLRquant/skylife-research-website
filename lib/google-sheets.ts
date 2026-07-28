/**
 * Google Sheets helper — SERVER ONLY.
 *
 * Reuses the existing Firebase service account (FIREBASE_SERVICE_ACCOUNT_B64) to authenticate
 * with the Sheets API. No new credentials needed — just enable the Sheets API on the GCP project
 * and share the spreadsheet with the service account's `client_email`.
 */
import "server-only";

import { google, type sheets_v4 } from "googleapis";

let sheetsClient: sheets_v4.Sheets | null = null;

function getSheets(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!raw?.trim()) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set");

  const cleaned = raw.trim().replace(/^["']|["']$/g, "");
  const text = cleaned.startsWith("{")
    ? cleaned
    : Buffer.from(cleaned.replace(/[^A-Za-z0-9+/=]/g, "").replace(/^=+/, ""), "base64").toString("utf8");

  const json = JSON.parse(text) as { client_email: string; private_key: string };
  const privateKey = json.private_key.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: json.client_email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

/**
 * Append a row to a tab in the configured Google Sheet.
 *
 * Fire-and-forget: callers should not await this in the critical path.
 * Errors are logged but never thrown to the caller.
 */
export async function appendRow(tab: string, values: (string | number)[]): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    console.warn("[google-sheets] GOOGLE_SHEET_ID not set — skipping append");
    return;
  }

  try {
    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${tab}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    });
  } catch (err) {
    console.error(`[google-sheets] Failed to append to "${tab}"`, err);
  }
}
