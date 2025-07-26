'use strict';

import * as sfcore from '@salesforce/core';
import * as child_process from 'child_process';
import * as util from 'util';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { useCache } from './cache';
import * as timezone from 'moment-timezone';
import { findWorkspaceTargetOrg } from './salesforceUtils';

export class SalesforceAPI {
    private static instance: SalesforceAPI;
    private connection: sfcore.Connection | null = null;
    private currentTargetOrg: string | null = null;
    private static readonly promisifiedExec = util.promisify(child_process.exec);
    
    private constructor() {}

    public static getInstance(): SalesforceAPI {
        if (!SalesforceAPI.instance) {
            SalesforceAPI.instance = new SalesforceAPI();
        }
        return SalesforceAPI.instance;
    }

    /**
     * Finds the target org from workspace configuration
     */
    private findWorkspaceTargetOrg(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace is open.');
        }

        const configPath = path.normalize(path.join(workspaceFolders[0].uri.fsPath, '.sf', 'config.json'));
        if (!fs.existsSync(configPath)) {
            throw new Error('No config file found. Please check if the config file exists in the .sf in the root directory.');
        }

        const data = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(data.toString());
        const configTargetOrg = config['target-org'];

        if (!configTargetOrg) {
            throw new Error('No target org found in config file. Please check if the target-org is present in the config file.');
        }

        return configTargetOrg;
    }

    /**
     * Ensures connection is available and up-to-date with current target org
     */
    private async ensureConnection(): Promise<void> {
        try {
            const orgs = await SalesforceAPI.getOrgsInfo();
            const targetOrg = findWorkspaceTargetOrg();
            const targetOrgInfo = orgs.find((org: any) => org.alias === targetOrg);
            
            if (!targetOrgInfo) {
                throw new Error(`Target org '${targetOrg}' not found in available orgs`);
            }
            
            // Create new connection if none exists or target org has changed
            if (!this.connection || this.currentTargetOrg !== targetOrg) {
                await this.connect(targetOrgInfo.username);
            }
        } catch (error) {
            throw new Error(`Failed to establish connection: ${error}`);
        }
    }

    /**
     * Connects to Salesforce using the specified username
     */
    public async connect(username: string): Promise<void> {
        try {
            this.connection = await sfcore.Connection.create({
                authInfo: await sfcore.AuthInfo.create({ username })
            });
            this.currentTargetOrg = username;
            vscode.window.showInformationMessage(`Connected to Salesforce org: ${username}`);
        } catch (error) {
            this.connection = null;
            this.currentTargetOrg = null;
            throw new Error(`Failed to connect to org '${username}': ${error}`);
        }
    }

    /**
     * Forces a connection refresh, useful when target org changes
     */
    public async refreshConnection(): Promise<void> {
        this.connection = null;
        this.currentTargetOrg = null;
        await this.ensureConnection();
    }

    /**
     * Gets current connection, ensuring it's valid for the current target org
     */
    public async getConnection(): Promise<sfcore.Connection> {
        await this.ensureConnection();
        if (!this.connection) {
            throw new Error('Failed to establish Salesforce connection');
        }
        return this.connection;
    }

    /**
     * Checks if connection is active for the current target org
     */
    public isConnected(): boolean {
        try {
            const targetOrg = this.findWorkspaceTargetOrg();
            return this.connection !== null && this.currentTargetOrg === targetOrg;
        } catch {
            return false;
        }
    }

    public static async getOrgsInfo(): Promise<any> {
        const { stdout } = await this.promisifiedExec('sf org list --json');
        const jsonOutput = JSON.parse(stdout);
        if (jsonOutput.status === 0) {
            const nonScratchOrgs = jsonOutput.result.nonScratchOrgs || [];
            const scratchOrgs = jsonOutput.result.scratchOrgs || [];
            return [...nonScratchOrgs, ...scratchOrgs];
        } else {
            vscode.window.showErrorMessage(jsonOutput);
        }
    }

    public static async getConnection(username: string): Promise<sfcore.Connection> {
        const connection = await sfcore.Connection.create({
            authInfo: await sfcore.AuthInfo.create({ username: username })
        });
        return connection;
    }

    @useCache('fields')
    public async fieldsOf(sObjectName: string) {
        await this.ensureConnection();
        if (!this.connection) { throw new Error('Connection not initialized'); }
        const fieldsInfo = await (await this.connection.describe(sObjectName)).fields;
        return fieldsInfo;
    }

    /**
     * Returns up to `limit` sObjects whose name or API name matches the input text.
     * @param input Partial name or API name to match
     * @param limit Max number of results
     */
    public async sObjectsMatchingName(input: string, limit: number = 20): Promise<Array<{ name: string, label: string }>> {
        await this.ensureConnection();
        if (!this.connection) { throw new Error('Connection not initialized'); }
        const result = await this.connection.describeGlobal();
        const lowerInput = input.toLowerCase();
        const matches = result.sobjects.filter((obj: any) =>
            obj.name.toLowerCase().includes(lowerInput) ||
            (obj.label && obj.label.toLowerCase().includes(lowerInput))
        );
        return matches.slice(0, limit).map((obj: any) => ({ name: obj.name, label: obj.label }));
    }

    public async fetchRecords(queryString: string) {
        if (!this.connection) { throw new Error('Connection not initialized'); }
        const recordsInfo = await this.connection.query(queryString);
        return recordsInfo.records;
    }

    public static async openConnection(userName: string) {
        const api = SalesforceAPI.getInstance();
        await api.connect(userName);
        vscode.window.showInformationMessage(`Connection initialized for username: ${userName}`);
    }

    /**
     * Opens connection using the current workspace target org
     */
    public static async openWorkspaceConnection() {
        const api = SalesforceAPI.getInstance();
        try {
            const targetOrg = api.findWorkspaceTargetOrg();
            await api.connect(targetOrg);
            vscode.window.showInformationMessage(`Connection initialized for workspace target org: ${targetOrg}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to connect to workspace target org: ${error}`);
            throw error;
        }
    }

    @useCache('orgDetails')
    public async orgDetails(orgName: string): Promise<any> {
        await this.ensureConnection();
        if (!this.connection) { throw new Error('Connection not initialized'); }
        const { stdout } = await SalesforceAPI.promisifiedExec('sf org display -o ' + orgName + ' --verbose --json');
        const jsonOutput = JSON.parse(stdout);
        if (jsonOutput.status === 0) {
            return jsonOutput.result;
        } else {
            vscode.window.showErrorMessage(`Error: ${jsonOutput}`);
            throw new Error('Failed to get org details');
        }
    }

    public static async openFlowInOrg(filePath: string) {
        try {
            vscode.window.showInformationMessage(`Opening flow in org...`);
            await this.promisifiedExec('sf org open --source-file ' + filePath);
        } catch (error: any) {
            vscode.window.showErrorMessage(error.message, { modal: false });
        }
    }

    public async debugLogsList(): Promise<any> {
        await this.ensureConnection();
        if (!this.connection) { throw new Error('Connection not initialized'); }
        let defaultQuery = `
            SELECT Id, Application, DurationMilliseconds, Location, LogLength, LogUser.Name, Operation, Request, StartTime, Status 
            FROM ApexLog 
            ORDER BY StartTime 
            DESC LIMIT 100
        `;
        let apexLogQuery: string = vscode.workspace.getConfiguration('magicSF').get('apexLogQuery') || defaultQuery;
        let debugLogs = await this.fetchRecords(apexLogQuery);
        debugLogs.forEach((log: any) => {
            log.StartTime = SalesforceAPI.formatLogDate(log.StartTime);
        });
        return debugLogs;
    }

    public async debugLog(id: string): Promise<any> {
        await this.ensureConnection();
        if (!this.connection) { throw new Error('Connection not initialized'); }
        const baseUrl = this.connection.tooling._baseUrl();
        const url = `${baseUrl}/sobjects/ApexLog/${id}/Body`;
        const response = await this.connection.tooling.request(url);
        return { log: response.toString() || '' };
    }

    private static formatLogDate(date: string): string {
        return timezone.tz(date, 'UTC').format('YYYY-MM-DD \nhh:mm:ss A z');
    }

    public async getTraceFlags() {
        await this.ensureConnection();
        if (!this.connection) { throw new Error('Connection not initialized'); }

        const baseUrl = this.connection.tooling._baseUrl();
        const query = `SELECT Id, TracedEntity.Name, TracedEntityId, LogType, DebugLevel.DeveloperName, StartDate, ExpirationDate, DebugLevelId FROM TraceFlag WHERE LogType='USER_DEBUG'`;
        const encodedQuery = encodeURIComponent(query);
        const url = `${baseUrl}/query/?q=${encodedQuery}`;
        const response = await this.connection.tooling.request(url) as { records: any[] };
        return response.records;
    }

    public async reactivateTraceFlag(traceFlagId: string): Promise<void> {
        await this.ensureConnection();
        if (!this.connection) { throw new Error('Connection not initialized'); }

        const baseUrl = this.connection.tooling._baseUrl();
        const url = `${baseUrl}/sobjects/TraceFlag/${traceFlagId}`;
        const payload = {
            StartDate: new Date().toISOString(),
            ExpirationDate: new Date(Date.now() + 120 * 60 * 1000).toISOString(), // 120 minutes from now
        };

        try {
            let response = await this.connection.request({
                method: 'PATCH',
                url,
                body: JSON.stringify(payload),
                headers: { 'content-type': 'application/json' },
            });
        } catch (error) {
            console.error('Error reactivating trace flag: ', error);
        }
    }

    /**
     * Utility method to get current target org without throwing errors
     */
    public getCurrentTargetOrg(): string | null {
        try {
            return this.findWorkspaceTargetOrg();
        } catch {
            return null;
        }
    }
}