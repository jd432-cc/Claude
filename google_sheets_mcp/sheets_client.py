from typing import Any

from googleapiclient.discovery import build

from .auth import get_credentials


class SheetsClient:
    """Thin wrapper around the Google Sheets v4 REST API."""

    def __init__(self) -> None:
        creds = get_credentials()
        service = build("sheets", "v4", credentials=creds)
        self._sheets = service.spreadsheets()

    # ------------------------------------------------------------------
    # Reading
    # ------------------------------------------------------------------

    def read_range(self, spreadsheet_id: str, range: str) -> list[list[Any]]:
        """Return a 2-D list of cell values for the given A1 range."""
        result = self._sheets.values().get(
            spreadsheetId=spreadsheet_id,
            range=range,
        ).execute()
        return result.get("values", [])

    def batch_read(
        self, spreadsheet_id: str, ranges: list[str]
    ) -> dict[str, list[list[Any]]]:
        """Return a dict mapping each requested range to its 2-D value list."""
        result = self._sheets.values().batchGet(
            spreadsheetId=spreadsheet_id,
            ranges=ranges,
        ).execute()
        return {
            vr["range"]: vr.get("values", [])
            for vr in result.get("valueRanges", [])
        }

    # ------------------------------------------------------------------
    # Writing
    # ------------------------------------------------------------------

    def write_range(
        self,
        spreadsheet_id: str,
        range: str,
        values: list[list[Any]],
        value_input_option: str = "USER_ENTERED",
    ) -> dict:
        """Overwrite cells in *range* with *values*."""
        result = self._sheets.values().update(
            spreadsheetId=spreadsheet_id,
            range=range,
            valueInputOption=value_input_option,
            body={"values": values},
        ).execute()
        return result

    def append_rows(
        self,
        spreadsheet_id: str,
        range: str,
        values: list[list[Any]],
        value_input_option: str = "USER_ENTERED",
    ) -> dict:
        """Append *values* after the last row with data in *range*."""
        result = self._sheets.values().append(
            spreadsheetId=spreadsheet_id,
            range=range,
            valueInputOption=value_input_option,
            insertDataOption="INSERT_ROWS",
            body={"values": values},
        ).execute()
        return result

    def clear_range(self, spreadsheet_id: str, range: str) -> dict:
        """Clear all values in *range* (formatting is preserved)."""
        return self._sheets.values().clear(
            spreadsheetId=spreadsheet_id,
            range=range,
        ).execute()

    # ------------------------------------------------------------------
    # Spreadsheet / sheet management
    # ------------------------------------------------------------------

    def get_spreadsheet_info(self, spreadsheet_id: str) -> dict:
        """Return title, URL, and a list of sheet tab metadata."""
        result = self._sheets.get(spreadsheetId=spreadsheet_id).execute()
        return {
            "title": result["properties"]["title"],
            "spreadsheet_id": result["spreadsheetId"],
            "spreadsheet_url": result["spreadsheetUrl"],
            "sheets": [
                {
                    "title": s["properties"]["title"],
                    "sheet_id": s["properties"]["sheetId"],
                    "index": s["properties"]["index"],
                    "row_count": s["properties"]["gridProperties"]["rowCount"],
                    "column_count": s["properties"]["gridProperties"]["columnCount"],
                }
                for s in result.get("sheets", [])
            ],
        }

    def create_spreadsheet(
        self, title: str, sheet_names: list[str] | None = None
    ) -> dict:
        """Create a new spreadsheet and return its ID and URL."""
        body: dict[str, Any] = {"properties": {"title": title}}
        if sheet_names:
            body["sheets"] = [{"properties": {"title": n}} for n in sheet_names]
        result = self._sheets.create(body=body).execute()
        return {
            "spreadsheet_id": result["spreadsheetId"],
            "spreadsheet_url": result["spreadsheetUrl"],
            "title": result["properties"]["title"],
        }

    def add_sheet(self, spreadsheet_id: str, title: str) -> dict:
        """Add a new sheet tab and return its metadata."""
        body = {"requests": [{"addSheet": {"properties": {"title": title}}}]}
        result = self._sheets.batchUpdate(
            spreadsheetId=spreadsheet_id, body=body
        ).execute()
        props = result["replies"][0]["addSheet"]["properties"]
        return {
            "sheet_id": props["sheetId"],
            "title": props["title"],
            "index": props["index"],
        }

    def delete_sheet(self, spreadsheet_id: str, sheet_id: int) -> None:
        """Permanently delete the sheet tab with the given numeric *sheet_id*."""
        body = {"requests": [{"deleteSheet": {"sheetId": sheet_id}}]}
        self._sheets.batchUpdate(spreadsheetId=spreadsheet_id, body=body).execute()
