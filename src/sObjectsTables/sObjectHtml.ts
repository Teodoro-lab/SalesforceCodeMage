export function fillHtmlContent(html: string, fields: any[], sObjectName: string, instanceUrl?: string): string {
    const headers = generateTableHeaders();
    const rows = generateTableRows(fields, sObjectName, instanceUrl);
    // Add link icon next to object name
    let objectLink = '';
    let clippy = '';
    let sObjectJsonScript = '';
    
    clippy = `<i id="filterLogsButton" class="codicon codicon-clippy"></i>`;
    const sObjectJson = JSON.stringify({ sObjectName, fields }, null, 2);
    sObjectJsonScript = `<script>window.sObjectJson = ${JSON.stringify(sObjectJson)};</script>`;
    
    if (instanceUrl) {
        console.log(`Instance URL: ${instanceUrl}`);
        objectLink = `<a href="${instanceUrl}/lightning/setup/ObjectManager/${sObjectName}/Details/view" target="_blank" title="Open in Salesforce Setup" style="margin-left:8px;">🧷</a>`;
    }
    
    html = html.replace('${sObjectName}', sObjectName + objectLink + clippy);
    let filled = html.replace('<!-- Table headers and rows will be injected here -->', headers + rows);
    // Inject the JSON script before </body>
    filled = filled.replace('</body>', sObjectJsonScript + '</body>');
    return filled;
}

function generateTableHeaders(): string {
    return `
        <tr>
            <th class="sortable" onclick="sortTable(0)">Label</th>
            <th class="sortable" onclick="sortTable(1)">Name</th>
            <th class="sortable" onclick="sortTable(2)">Type</th>
            <th>Length</th>
            <th>Required</th>
            <th>Picklist Values</th>
            <th>Createable</th>
            <th>Defaulted on Create</th>
        </tr>
    `;
}

function generateTableRows(fields: any[], sObjectName: string, instanceUrl?: string): string {
    return fields.map(field => generateTableRow(field, sObjectName, instanceUrl)).join('');
}

function generateTableRow(field: any, sObjectName: string, instanceUrl?: string): string {
    const picklistValues = generatePicklistValues(field);
    let picklistHTML;

    if (picklistValues.length > 50) {
        let picklistValuesShort = picklistValues.substring(0, 50) + '...';
        picklistHTML = `
            <td class="expandable">${picklistValuesShort}</td>
            <td class="expandable-content">${picklistValues}</td>
        `;
    } else {
        picklistHTML = `<td>${picklistValues}</td>`;
    }

    const requiredDisplay = field.nillable ? 'Optional' : 'Required';
    const requiredStyle = field.nillable ? '' : 'required';

    // Add link icon for field
    let fieldLink = '';
    if (instanceUrl) {
        fieldLink = `<a href="${instanceUrl}/lightning/setup/ObjectManager/${sObjectName}/FieldsAndRelationships/${field.name}/view" target="_blank" title="Open field in Salesforce Setup" style="margin-left:4px;">🧷</a>`;
    }

    return `
        <tr class="field-row">
            <td>${field.label} ${fieldLink}</td>
            <td>${field.name}</td>
            <td>${field.type}</td>
            <td>${field.length || 'N/A'}</td>
            <td class="${requiredStyle}">${requiredDisplay}</td>
            ${picklistHTML}
            <td>${field.createable ? 'Yes' : 'No'}</td>
            <td>${field.defaultedOnCreate ? 'Yes' : 'No'}</td>
        </tr>
    `;
}

function generatePicklistValues(field: any): string {
    if (field.type === 'picklist' && field.picklistValues && field.picklistValues.length > 0) {
        return field.picklistValues.map((val: { label: string; value: string; }) => `${val.label} (${val.value})`).join('<br>');
    }
    return 'N/A';
}