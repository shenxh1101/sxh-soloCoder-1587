import { formatTime } from './config.js';

class RecordManager {
    constructor() {
        this.records = [];
        this.nextId = 1;
    }

    addRecord(plateNumber, type, spaceId, description = '') {
        const record = {
            id: `REC${this.nextId++}`,
            plateNumber,
            type,
            spaceId,
            time: new Date(),
            description
        };
        this.records.unshift(record);
        this.updateUI();
        return record;
    }

    getRecords() {
        return [...this.records];
    }

    getRecordsByPlate(plateNumber) {
        return this.records.filter(r => r.plateNumber === plateNumber);
    }

    getRecordsByType(type) {
        return this.records.filter(r => r.type === type);
    }

    generateReport() {
        const parkCount = this.records.filter(r => r.type === 'park').length;
        const fetchCount = this.records.filter(r => r.type === 'fetch').length;
        
        return {
            totalRecords: this.records.length,
            parkCount,
            fetchCount,
            records: this.records
        };
    }

    updateUI() {
        const container = document.getElementById('recordList');
        if (!container) return;

        if (this.records.length === 0) {
            container.innerHTML = '<p class="placeholder">暂无存取记录</p>';
            return;
        }

        container.innerHTML = this.records.map(record => `
            <div class="record-item ${record.type}">
                <div class="record-header">
                    <span class="record-type">${record.type === 'park' ? '存车' : '取车'}</span>
                    <span class="record-time">${formatTime(record.time)}</span>
                </div>
                <div class="record-details">
                    车牌: <span>${record.plateNumber}</span> | 
                    车位: <span>${record.spaceId}</span>
                    ${record.description ? ` | ${record.description}` : ''}
                </div>
            </div>
        `).join('');
    }

    clearRecords() {
        this.records = [];
        this.updateUI();
    }
}

export const recordManager = new RecordManager();
export default RecordManager;
