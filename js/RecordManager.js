import { CONFIG, formatTime, RECORD_TYPES, getFaultTypeInfo } from './config.js';

class RecordManager {
    constructor() {
        this.records = [];
        this.nextId = 1;
        this.filter = {
            plateNumber: '',
            spaceId: '',
            type: '',
            startDate: null,
            endDate: null
        };
        this.loadFromStorage();
    }

    addRecord(plateNumber, type, spaceId, description = '', extra = {}) {
        const record = {
            id: `REC${this.nextId++}`,
            plateNumber,
            type,
            spaceId,
            time: new Date(),
            description,
            ...extra
        };
        this.records.unshift(record);
        this.saveToStorage();
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

    getRecordsBySpace(spaceId) {
        return this.records.filter(r => r.spaceId === spaceId);
    }

    setFilter(filter) {
        this.filter = { ...this.filter, ...filter };
        this.updateUI();
    }

    resetFilter() {
        this.filter = {
            plateNumber: '',
            spaceId: '',
            type: '',
            startDate: null,
            endDate: null
        };
        
        const plateEl = document.getElementById('filterPlate');
        const spaceEl = document.getElementById('filterSpace');
        const typeEl = document.getElementById('filterType');
        const startEl = document.getElementById('filterStartDate');
        const endEl = document.getElementById('filterEndDate');
        
        if (plateEl) plateEl.value = '';
        if (spaceEl) spaceEl.value = '';
        if (typeEl) typeEl.value = '';
        if (startEl) startEl.value = '';
        if (endEl) endEl.value = '';
        
        this.updateUI();
    }

    getFilteredRecords() {
        return this.records.filter(record => {
            if (this.filter.plateNumber && 
                !record.plateNumber?.toLowerCase().includes(this.filter.plateNumber.toLowerCase())) {
                return false;
            }
            if (this.filter.spaceId && record.spaceId !== this.filter.spaceId) {
                return false;
            }
            if (this.filter.type && record.type !== this.filter.type) {
                return false;
            }
            if (this.filter.startDate) {
                const start = new Date(this.filter.startDate);
                start.setHours(0, 0, 0, 0);
                if (new Date(record.time) < start) return false;
            }
            if (this.filter.endDate) {
                const end = new Date(this.filter.endDate);
                end.setHours(23, 59, 59, 999);
                if (new Date(record.time) > end) return false;
            }
            return true;
        });
    }

    generateReport() {
        const parkCount = this.records.filter(r => r.type === RECORD_TYPES.PARK).length;
        const fetchCount = this.records.filter(r => r.type === RECORD_TYPES.FETCH).length;
        const faultSetCount = this.records.filter(r => r.type === RECORD_TYPES.FAULT_SET).length;
        const faultClearCount = this.records.filter(r => r.type === RECORD_TYPES.FAULT_CLEAR).length;
        
        return {
            totalRecords: this.records.length,
            parkCount,
            fetchCount,
            faultSetCount,
            faultClearCount,
            records: this.records
        };
    }

    exportToCSV() {
        const records = this.getFilteredRecords();
        
        if (records.length === 0) {
            return { success: false, message: '没有可导出的记录' };
        }

        const typeNames = {
            [RECORD_TYPES.PARK]: '存车',
            [RECORD_TYPES.FETCH]: '取车',
            [RECORD_TYPES.FAULT_SET]: '故障设置',
            [RECORD_TYPES.FAULT_CLEAR]: '故障解除',
            [RECORD_TYPES.TASK_CANCELLED]: '任务取消'
        };

        const headers = ['记录ID', '车牌号', '操作类型', '车位编号', '操作时间', '描述'];
        const rows = records.map(record => [
            record.id,
            record.plateNumber || '-',
            typeNames[record.type] || record.type,
            record.spaceId || '-',
            formatTime(record.time),
            record.description || ''
        ]);

        let csv = '\uFEFF';
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `车库记录_${formatTime(new Date()).replace(/[:\s]/g, '-')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return { success: true, message: `已导出 ${records.length} 条记录`, count: records.length };
    }

    getRecordTypeName(type) {
        const names = {
            [RECORD_TYPES.PARK]: '存车',
            [RECORD_TYPES.FETCH]: '取车',
            [RECORD_TYPES.FAULT_SET]: '故障设置',
            [RECORD_TYPES.FAULT_CLEAR]: '故障解除',
            [RECORD_TYPES.TASK_CANCELLED]: '任务取消'
        };
        return names[type] || type;
    }

    updateUI() {
        const container = document.getElementById('recordList');
        if (!container) return;

        const records = this.getFilteredRecords();

        if (records.length === 0) {
            container.innerHTML = '<p class="placeholder">暂无存取记录</p>';
            return;
        }

        container.innerHTML = records.map(record => {
            const typeName = this.getRecordTypeName(record.type);
            let faultTypeBadge = '';
            
            if ((record.type === RECORD_TYPES.FAULT_SET || record.type === RECORD_TYPES.FAULT_CLEAR) && record.faultType) {
                const faultInfo = getFaultTypeInfo(record.faultType);
                if (faultInfo) {
                    faultTypeBadge = `<span class="record-fault-type" style="background: ${faultInfo.color}20; color: ${faultInfo.color}">${faultInfo.name}</span>`;
                }
            }

            return `
                <div class="record-item ${record.type}">
                    <div class="record-header">
                        <span class="record-type">${typeName}${faultTypeBadge}</span>
                        <span class="record-time">${formatTime(record.time)}</span>
                    </div>
                    <div class="record-details">
                        ${record.plateNumber ? `车牌: <span>${record.plateNumber}</span> | ` : ''}
                        车位: <span>${record.spaceId}</span>
                        ${record.description ? ` | ${record.description}` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    clearRecords() {
        this.records = [];
        this.nextId = 1;
        this.saveToStorage();
        this.updateUI();
    }

    saveToStorage() {
        try {
            const data = {
                records: this.records,
                nextId: this.nextId
            };
            localStorage.setItem(CONFIG.STORAGE.RECORDS_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('保存记录数据失败:', e);
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE.RECORDS_KEY);
            if (!saved) return false;
            
            const data = JSON.parse(saved);
            this.records = (data.records || []).map(r => ({
                ...r,
                time: new Date(r.time)
            }));
            this.nextId = data.nextId || 1;
            
            return this.records.length > 0;
        } catch (e) {
            console.warn('加载记录数据失败:', e);
            return false;
        }
    }

    hasSavedData() {
        return !!localStorage.getItem(CONFIG.STORAGE.RECORDS_KEY);
    }
}

export const recordManager = new RecordManager();
export default RecordManager;
