"""Google Sheets MCP server.

Exposes Google Sheets operations as MCP tools so Claude can read, write,
and manage spreadsheets during a conversation.
"""

import json
from typing import Any

from mcp.server.fastmcp import FastMCP

from .sheets_client import SheetsClient

mcp = FastMCP("google-sheets")

_client: SheetsClient | None = None


def _get_client() -> SheetsClient:
    global _client
    if _client is None:
        _client = SheetsClient()
    return _client


# ---------------------------------------------------------------------------
# Reading tools
# ---------------------------------------------------------------------------


@mcp.tool()
def read_sheet(spreadsheet_id: str, range: str) -> str:
    """Read cells from a Google Sheet and return them as a JSON array of rows.

    Args:
        spreadsheet_id: The ID found in the spreadsheet URL
                        (e.g. '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms').
        range: A1 notation range, e.g. 'Sheet1!A1:D10' or just 'A1:D10'.
    """
    data = _get_client().read_range(spreadsheet_id, range)
    return json.dumps(data, indent=2)


@mcp.tool()
def batch_read(spreadsheet_id: str, ranges: list[str]) -> str:
    """Read multiple ranges from a spreadsheet in one request.

    Args:
        spreadsheet_id: The spreadsheet ID.
        ranges: List of A1 notation ranges, e.g. ['Sheet1!A1:B5', 'Sheet2!C1:C10'].
    """
    result = _get_client().batch_read(spreadsheet_id, ranges)
    return json.dumps(result, indent=2)


# ---------------------------------------------------------------------------
# Writing tools
# ---------------------------------------------------------------------------


@mcp.tool()
def write_sheet(spreadsheet_id: str, range: str, values: list[list[Any]]) -> str:
    """Write data to a Google Sheet, overwriting existing cell values.

    Args:
        spreadsheet_id: The spreadsheet ID.
        range: Top-left cell in A1 notation, e.g. 'Sheet1!A1'.
        values: 2-D array of values (rows × columns).
                Example: [["Name", "Score"], ["Alice", 95], ["Bob", 87]]
    """
    result = _get_client().write_range(spreadsheet_id, range, values)
    return json.dumps(result, indent=2)


@mcp.tool()
def append_rows(spreadsheet_id: str, range: str, values: list[list[Any]]) -> str:
    """Append rows after the last row that contains data.

    Args:
        spreadsheet_id: The spreadsheet ID.
        range: A1 range used to find the table, e.g. 'Sheet1' or 'Sheet1!A:Z'.
        values: 2-D array of rows to append.
    """
    result = _get_client().append_rows(spreadsheet_id, range, values)
    return json.dumps(result, indent=2)


@mcp.tool()
def clear_range(spreadsheet_id: str, range: str) -> str:
    """Clear all values in a range (cell formatting is preserved).

    Args:
        spreadsheet_id: The spreadsheet ID.
        range: A1 notation range to clear, e.g. 'Sheet1!A1:Z100'.
    """
    result = _get_client().clear_range(spreadsheet_id, range)
    return json.dumps(result, indent=2)


# ---------------------------------------------------------------------------
# Spreadsheet / sheet management tools
# ---------------------------------------------------------------------------


@mcp.tool()
def get_spreadsheet_info(spreadsheet_id: str) -> str:
    """Return metadata for a spreadsheet: title, URL, and all sheet tabs.

    Args:
        spreadsheet_id: The spreadsheet ID.
    """
    info = _get_client().get_spreadsheet_info(spreadsheet_id)
    return json.dumps(info, indent=2)


@mcp.tool()
def create_spreadsheet(title: str, sheet_names: list[str] | None = None) -> str:
    """Create a new Google Spreadsheet and return its ID and URL.

    Args:
        title: Title of the new spreadsheet.
        sheet_names: Optional list of tab names to create (e.g. ['Jan', 'Feb', 'Mar']).
                     If omitted, Google creates a default 'Sheet1'.
    """
    result = _get_client().create_spreadsheet(title, sheet_names)
    return json.dumps(result, indent=2)


@mcp.tool()
def add_sheet(spreadsheet_id: str, title: str) -> str:
    """Add a new sheet tab to an existing spreadsheet.

    Args:
        spreadsheet_id: The spreadsheet ID.
        title: Name for the new sheet tab.
    """
    result = _get_client().add_sheet(spreadsheet_id, title)
    return json.dumps(result, indent=2)


@mcp.tool()
def delete_sheet(spreadsheet_id: str, sheet_id: int) -> str:
    """Permanently delete a sheet tab from a spreadsheet.

    Use get_spreadsheet_info to find the numeric sheet_id for a tab.

    Args:
        spreadsheet_id: The spreadsheet ID.
        sheet_id: Numeric ID of the sheet tab to delete (not the tab name).
    """
    _get_client().delete_sheet(spreadsheet_id, sheet_id)
    return json.dumps({"deleted": True, "sheet_id": sheet_id})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run()
