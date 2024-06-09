# Salesforce CodeMage - A Salesforce Extension for Salesforce Developers

<img src="https://github.com/Teodoro-lab/SalesforceCodeMage/blob/526c52cb2a763913bd5d075ff3ba902c4d08fb11/resources/magicSF-logo.webp" alt="MagicSF-logo" width="200"/>

<a href='https://ko-fi.com/teodorolab' target='_blank'><img height='35' style='border:0px;height:46px;' src='https://az743702.vo.msecnd.net/cdn/kofi3.png?v=0' border='0' alt='Buy Me a Coffee at ko-fi.com'></a>

Salesforce CodeMage enhances the Salesforce development experience by providing direct access to Salesforce orgs' details, opening developer consoles, and displaying Salesforce Object (sObject) fields in a readable table format.

## Features

- **Open Flow in Org**: Open Salesforce flows directly from your local project.
- **Open Developer Console**: Quick access to the developer console of your selected Salesforce org.

- **Show sObject Table**: Visualize fields of any sObject from your Salesforce org in a neat table.<br/>
![Show sObject Table](resources/sf_sobject_table.gif)

- **Show sObject Table with Selected Text**: Same as above but uses the editor's selected text as the sObject name.
- **Apex hover provider for sObjects**: While hovering and sObject in Apex it allows you to see bojects and attributes of those as required or type
- **Caching**: All of the above features works with a cache that is stored in the .sf/magic_sf_api_cache, if you need to see any change as new fields you will have to clear the cache using the command `magicSF: clear cache` or wait till cache expires.

## Requirements

For the extension to operate correctly, you need:
- An authenticated Salesforce org.
- The Salesforce CLI installed and configured on your machine.
- Access rights to the `.sf/config.json` file in your project's root directory to determine the target Salesforce org. (don't have to do anything 99% time you have this)

## Extension Settings

This extension contributes the following settings:

- `mySalesforceExtension.targetOrg`: Set the default target Salesforce org for your extension operations.

## Installation

To install this extension:
1. Download the latest release from the [GitHub repository](https://github.com/Teodoro-lab/SalesforceCodeMage).
2. Open Visual Studio Code.
3. Go to Extensions view by clicking on the Extensions icon on the Sidebar.
4. Click on "Install from VSIX..." and select the downloaded file.

## Usage

Once installed, you can use the commands provided by the extension through the command palette:
1. Open the Command Palette (`Ctrl+Shift+P`).
2. Type and select the command you want to execute (e.g., "magicSF: Open Developer Console").

Each command can also be bound to a keyboard shortcut for quicker access.

## Contributing

Contributions are always welcome! I haven't created a contribution document, but feel free to create issues
or enhancements!

## License

This project is licensed under the MIT License - see the [LICENSE.md](https://github.com/Teodoro-lab/SalesforceCodeMage/blob/7c62dbb69f5fb59523905e3f936dfbc3cb844052/LICENSE) file for details.
