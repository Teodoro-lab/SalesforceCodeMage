# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),  
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] – 2025-07-29

### Added

- **Multi-Selection in Debug Logs Table**  
  Use `Shift + Click` to select multiple logs for batch operations such as downloads.

- **Trace Flags Support**  
  View users with active trace flags, activate new ones for 2 hours, and search users with `Ctrl+F`/`Cmd+F`.  
  _Note: Automated process user trace flags not yet supported and creating the trace flags still require manual setup._

- **Simplified Hover Tooltips**  
  Object hover tooltips now show just a link to the object detail view, reducing clutter.

- **Query Panel in Object View**  
  Auto-generates SOQL queries based on selected object and fields, with a results tab that supports:
  - CSV download  
  - Query copy  
  - Visual subquery expand/collapse (1-level supported; deeper levels shown as JSON)

- **Salesforce Page Links in Object Table**  
  Object and field names include icons to open related pages in Salesforce UI.  
  _Note: Custom field links may lead to "Insufficient privileges" pages due to platform behavior._

- **Copy to Clipboard for Object Definitions**  
  Copy raw object metadata with one click for use in external tools or documentation.

- **Field Filter Checkboxes**  
  Toggle visibility of:
  - System fields  
  - Standard fields  
  - Custom fields  
  All options are enabled by default.

- **Refresh Org Connection Command**  
  Reconnect to a different org without restarting VS Code. Refreshes metadata and views instantly.

- **Debug Log Info Searcher**  
  A new side panel in the Explorer view that automatically parses opened debug logs to show logged messages and key entries for easier analysis.
