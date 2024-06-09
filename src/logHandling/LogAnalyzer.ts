import { useCacheLog } from '../cache';

interface LogAnalysisResult {
    time: string;
    operationName: string;
    description: string;
}

export class LogAnalyzer {
    @useCacheLog('analyzeDebugLog')
    analyzeDebugLog(logId: string, logContent: string): LogAnalysisResult | null {
        if (!logContent) {
            return null;
        }

        const lines = logContent.split('\n');
        let lastTime = '', lastOperation = '';

        for (const line of lines) {
            const match = line.match(/^(\d{2}:\d{2}:\d{2}\.\d+)\s\(\d+\)\|CODE_UNIT_STARTED\|\[EXTERNAL\]\|([\w:\/.$@-]+)(?:\|([^|]+))?/);
            try {
                if (match) {
                    let operationDetails = match[2];
                    let operationName = '';
                    let additionalInfo = '';
                    if (match[3]) {
                        operationName = match[3]?.split('|')[0].trim();  // Captura el nombre de la operación antes del primer pipe
                        additionalInfo = match[3].substring(operationName.length).replace(/^\|/, '').trim(); //después del primer pipe
                    } else {
                        operationName = operationDetails;
                        additionalInfo = '';
                    }
                    console.log('operationName', operationName);    
                    // Handle multi-line trigger descriptions
                    if (operationName === "TRIGGERS" && additionalInfo.length === 0) {
                        lastTime = match[1];
                        lastOperation = operationName;
                        continue;
                    } else if (lastOperation === "TRIGGERS") {
                        operationName += ' | ' + additionalInfo;
                        additionalInfo = ''; // Clear after use
                    }
    
                    return {
                        time: match[1],
                        operationName: operationName,
                        description: "Apex Code Unit Started" + (additionalInfo ? ' | ' + additionalInfo : '')
                    };
                }
    
                // HANDLE FLOWS
    
                let flowMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d+) \(\d+\)\|FLOW_(\w+)_BEGIN\|([^|]+)\|(\w+)\|([^|]+)/);
                if (flowMatch) {
                    return {
                        time: flowMatch[1],
                        operationName: 'Flow Begin ' + flowMatch[5] + '-' + flowMatch[4],
                        description: 'Flow Begin ' + flowMatch[5] + '-' + flowMatch[4]
                    };
                }
    
                // Identificar detalles de una acción de flujo
                let actionDetailMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d+) \(\d+\)\|FLOW_ACTIONCALL_DETAIL\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)/);
                if (actionDetailMatch) {
                    return {
                        time: actionDetailMatch[1],
                        operationName: 'Flow Action ' + actionDetailMatch[3] + ' - ' + actionDetailMatch[4],
                        description: 'Flow Action ' + actionDetailMatch[3] + ' - ' + actionDetailMatch[4]
                    };
                }
            } catch (error) {
                console.log('Error analyzing log:', error);
                return {
                    time: '',
                    operationName: 'Unknown Operation',
                    description: ''
                };
            }
        }
        
        return {
            time: '',
            operationName: 'Unknown Operation',
            description: ''
        };
    }
}
