# Google Sheets MCP Server

An MCP (Model Context Protocol) server that gives Claude Code the ability to read, write, and manage Google Sheets.

## Tools

| Tool | Description |
|---|---|
| `read_sheet` | Read data from a range |
| `write_sheet` | Write/overwrite data in a range |
| `append_sheet` | Append rows to a table |
| `batch_read` | Read multiple ranges in one call |
| `clear_range` | Clear values from a range |
| `create_spreadsheet` | Create a new spreadsheet |
| `get_spreadsheet_info` | Get spreadsheet metadata (sheets, dimensions) |
| `add_sheet` | Add a new tab to a spreadsheet |

## Setup

### 1. Install & Build

```bash
npm install
npm run build
```

### 2. Google Credentials

Choose **one** of these authentication methods:

**Option A — Service Account Key File** (recommended for automation):
1. Create a service account in the [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Enable the **Google Sheets API** in your project
3. Download the JSON key file
4. Share your target spreadsheets with the service account email
5. Set the env var:
   ```
   GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/path/to/key.json
   ```

**Option B — Service Account Key JSON** (inline):
```
GOOGLE_SERVICE_ACCOUNT_KEY_JSON='{"type":"service_account",...}'
```

**Option C — OAuth Access Token** (short-lived):
```
GOOGLE_ACCESS_TOKEN=ya29.xxx
```

**Option D — Application Default Credentials** (gcloud CLI):
```bash
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/spreadsheets
```

### 3. Register with Claude Code

Add this to your Claude Code MCP settings (`~/.claude/settings.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "node",
      "args": ["/absolute/path/to/this/repo/dist/index.js"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_KEY_FILE": "/path/to/service-account-key.json"
      }
    }
  }
}
```

Or if you prefer `npx` after publishing:
```json
{
  "mcpServers": {
    "google-sheets": {
      "command": "npx",
      "args": ["-y", "google-sheets-mcp-server"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_KEY_FILE": "/path/to/key.json"
      }
    }
  }
}
```

## Usage Examples

Once connected, Claude can:

- **"Read the data in my spreadsheet"** — provide the spreadsheet ID from the URL
- **"Add a row with today's expenses"** — appends to an existing table
- **"Create a new spreadsheet for Q1 budgets"** — creates and returns the URL
- **"What sheets/tabs does this spreadsheet have?"** — returns metadata

The spreadsheet ID is the long string in the URL:
```
https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
```
