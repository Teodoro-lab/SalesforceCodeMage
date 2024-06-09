export function fillHtmlContent(html: string, fields: any[], sObjectName: string): string {
    const headers = generateTableHeaders();
    const rows = generateTableRows(fields);

    html = html.replace('${sObjectName}', sObjectName);
    return html.replace('<!-- Table headers and rows will be injected here -->', headers + rows);
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

function generateTableRows(fields: any[]): string {
    return fields.map(field => generateTableRow(field)).join('');
}

function generateTableRow(field: any): string {
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

    return `
        <tr class="field-row">
            <td>${field.label}</td>
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