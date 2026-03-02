#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getSheetsClient } from "./auth.js";

const server = new McpServer({
  name: "google-sheets",
  version: "1.0.0",
});

// ---------- Tool: read_sheet ----------
server.tool(
  "read_sheet",
  "Read data from a Google Sheets range. Returns cell values as a 2D array.",
  {
    spreadsheetId: z.string().describe("The ID of the spreadsheet (from the URL)"),
    range: z.string().describe("A1 notation range, e.g. 'Sheet1!A1:D10' or 'Sheet1'"),
  },
  async ({ spreadsheetId, range }) => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = res.data.values ?? [];
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ rowCount: rows.length, data: rows }, null, 2),
        },
      ],
    };
  }
);

// ---------- Tool: write_sheet ----------
server.tool(
  "write_sheet",
  "Write data to a Google Sheets range. Overwrites existing values in the target range.",
  {
    spreadsheetId: z.string().describe("The ID of the spreadsheet"),
    range: z.string().describe("A1 notation range to write to, e.g. 'Sheet1!A1'"),
    values: z
      .array(z.array(z.string()))
      .describe("2D array of cell values, e.g. [[\"Name\",\"Age\"],[\"Alice\",\"30\"]]"),
  },
  async ({ spreadsheetId, range, values }) => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    return {
      content: [
        {
          type: "text" as const,
          text: `Updated ${res.data.updatedCells} cells in range ${res.data.updatedRange}.`,
        },
      ],
    };
  }
);

// ---------- Tool: append_sheet ----------
server.tool(
  "append_sheet",
  "Append rows to the end of a table in a Google Sheet.",
  {
    spreadsheetId: z.string().describe("The ID of the spreadsheet"),
    range: z.string().describe("A1 notation of the table to append to, e.g. 'Sheet1!A:D'"),
    values: z
      .array(z.array(z.string()))
      .describe("2D array of rows to append"),
  },
  async ({ spreadsheetId, range, values }) => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    return {
      content: [
        {
          type: "text" as const,
          text: `Appended ${res.data.updates?.updatedRows ?? 0} rows to ${res.data.updates?.updatedRange}.`,
        },
      ],
    };
  }
);

// ---------- Tool: create_spreadsheet ----------
server.tool(
  "create_spreadsheet",
  "Create a new Google Spreadsheet and return its ID and URL.",
  {
    title: z.string().describe("Title for the new spreadsheet"),
    sheetTitles: z
      .array(z.string())
      .optional()
      .describe("Optional list of sheet/tab names to create (defaults to one 'Sheet1')"),
  },
  async ({ title, sheetTitles }) => {
    const sheets = getSheetsClient();
    const requestBody: Record<string, unknown> = {
      properties: { title },
    };
    if (sheetTitles && sheetTitles.length > 0) {
      requestBody.sheets = sheetTitles.map((t) => ({
        properties: { title: t },
      }));
    }
    const res = await sheets.spreadsheets.create({ requestBody });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              spreadsheetId: res.data.spreadsheetId,
              url: res.data.spreadsheetUrl,
              sheets: res.data.sheets?.map((s) => s.properties?.title),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---------- Tool: get_spreadsheet_info ----------
server.tool(
  "get_spreadsheet_info",
  "Get metadata about a spreadsheet: title, sheets/tabs, and their dimensions.",
  {
    spreadsheetId: z.string().describe("The ID of the spreadsheet"),
  },
  async ({ spreadsheetId }) => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const info = {
      title: res.data.properties?.title,
      locale: res.data.properties?.locale,
      sheets: res.data.sheets?.map((s) => ({
        title: s.properties?.title,
        sheetId: s.properties?.sheetId,
        rowCount: s.properties?.gridProperties?.rowCount,
        columnCount: s.properties?.gridProperties?.columnCount,
      })),
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }],
    };
  }
);

// ---------- Tool: clear_range ----------
server.tool(
  "clear_range",
  "Clear all values from a specified range in a Google Sheet.",
  {
    spreadsheetId: z.string().describe("The ID of the spreadsheet"),
    range: z.string().describe("A1 notation range to clear, e.g. 'Sheet1!A1:D10'"),
  },
  async ({ spreadsheetId, range }) => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
      requestBody: {},
    });
    return {
      content: [
        {
          type: "text" as const,
          text: `Cleared range ${res.data.clearedRange}.`,
        },
      ],
    };
  }
);

// ---------- Tool: add_sheet ----------
server.tool(
  "add_sheet",
  "Add a new sheet/tab to an existing spreadsheet.",
  {
    spreadsheetId: z.string().describe("The ID of the spreadsheet"),
    title: z.string().describe("Title for the new sheet tab"),
  },
  async ({ spreadsheetId, title }) => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
    const newSheet = res.data.replies?.[0]?.addSheet;
    return {
      content: [
        {
          type: "text" as const,
          text: `Created sheet "${newSheet?.properties?.title}" (sheetId: ${newSheet?.properties?.sheetId}).`,
        },
      ],
    };
  }
);

// ---------- Tool: batch_read ----------
server.tool(
  "batch_read",
  "Read multiple ranges from a spreadsheet in a single request.",
  {
    spreadsheetId: z.string().describe("The ID of the spreadsheet"),
    ranges: z
      .array(z.string())
      .describe("List of A1 notation ranges to read"),
  },
  async ({ spreadsheetId, ranges }) => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
    });
    const results = (res.data.valueRanges ?? []).map((vr) => ({
      range: vr.range,
      data: vr.values ?? [],
    }));
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(results, null, 2) },
      ],
    };
  }
);

// ---------- Start the server ----------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
