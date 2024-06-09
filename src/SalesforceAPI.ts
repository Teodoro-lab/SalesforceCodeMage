'use strict';

import * as sfcore from '@salesforce/core';
import * as child_process from 'child_process';
import * as util from 'util';
import * as vscode from 'vscode';
import { useCache } from './cache';
import * as timezone from 'moment-timezone';

export class SalesforceAPI {
    private static instance: SalesforceAPI;
    private connection: sfcore.Connection | null = null;
    private static readonly promisifiedExec = util.promisify(child_process.exec);
    
    private constructor() {}

    public static getInstance(): SalesforceAPI {
        if (!SalesforceAPI.instance) {
            SalesforceAPI.instance = new SalesforceAPI();
        }
        return SalesforceAPI.instance;
    }

    public async connect(username: string) {
        this.connection = await sfcore.Connection.create({
            authInfo: await sfcore.AuthInfo.create({ username })
        });
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

    public static async getConnection(username: string) : Promise<sfcore.Connection>{
        const connection = await sfcore.Connection.create({
            authInfo: await sfcore.AuthInfo.create({ username:  username})
        });
        return connection; 
    }

    @useCache('fields')
    public async fieldsOf(sObjectName: string) {
        if (!this.connection) throw new Error('Connection not initialized');
        const fieldsInfo = await (await this.connection.describe(sObjectName)).fields;
        return fieldsInfo;
    }

    public async fetchRecords(queryString: string) {
        if (!this.connection) throw new Error('Connection not initialized');
        const recordsInfo = await this.connection.query(queryString);
        return recordsInfo.records;
    }

    public static async openConnection(userName: string) {
        const api = SalesforceAPI.getInstance();
        await api.connect(userName);
        vscode.window.showInformationMessage(`Connection initialized for username: ${userName}`);
    }

    @useCache('orgDetails')
    public async orgDetails(orgName: string): Promise<any> {
        if (!this.connection) throw new Error('Connection not initialized');
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
        } catch (error : any) {
            vscode.window.showErrorMessage(error.message, { modal: false });
        }
    }

    public async debugLogsList(): Promise<any> {
        if (!this.connection) throw new Error('Connection not initialized');
        let defaultQuery = `
            SELECT Id, Application, DurationMilliseconds, Location, LogLength, LogUser.Name, Operation, Request, StartTime, Status 
            FROM ApexLog 
            ORDER BY StartTime 
            DESC LIMIT 100
        `;
        let apexLogQuery : string = vscode.workspace.getConfiguration('magicSF').get('apexLogQuery') || defaultQuery;
        let debugLogs = await this.fetchRecords(apexLogQuery);
        debugLogs.forEach((log: any) => {
            log.StartTime = SalesforceAPI.formatLogDate(log.StartTime);
        });
        return debugLogs;
    }

    public async debugLog(id: string): Promise<any> {
        if (!this.connection) throw new Error('Connection not initialized');
        const baseUrl = this.connection.tooling._baseUrl();
        const url = `${baseUrl}/sobjects/ApexLog/${id}/Body`;
        const response = await this.connection.tooling.request(url);
        return { log: response.toString() || '' };
    }

    private static formatLogDate(date: string): string {
        return timezone.tz(date, 'UTC').format('YYYY-MM-DD \nhh:mm:ss A z');
    }
}