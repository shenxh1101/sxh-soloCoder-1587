import { CONFIG, generateTaskId, TASK_STATUS, RECORD_TYPES, getFaultTypeInfo } from './config.js';
import { garageManager } from './GarageManager.js';
import { recordManager } from './RecordManager.js';
import { animationController } from './AnimationController.js';

class ParkingService {
    constructor(modelBuilder) {
        this.modelBuilder = modelBuilder;
        this.taskQueue = [];
        this.currentTask = null;
        this.isProcessing = false;
        this.isSystemLocked = false;
        this.pendingFaultSpaceId = null;
        this.lastSearchedPlate = null;
    }

    enqueueTask(taskType, data) {
        const task = {
            id: generateTaskId(),
            type: taskType,
            data,
            status: TASK_STATUS.PENDING,
            createdAt: new Date(),
            startedAt: null,
            completedAt: null,
            error: null
        };

        this.taskQueue.push(task);
        this.updateQueueUI();
        this.showToast(`任务已加入队列，当前排队 ${this.getPendingCount()} 个`, 'info');
        
        if (!this.isProcessing) {
            this.processNextTask();
        }

        return task;
    }

    getPendingCount() {
        return this.taskQueue.filter(t => t.status === TASK_STATUS.PENDING).length;
    }

    async processNextTask() {
        if (this.isProcessing) return;
        
        const pendingTask = this.taskQueue.find(t => t.status === TASK_STATUS.PENDING);
        if (!pendingTask) {
            this.isProcessing = false;
            this.setSystemLocked(false);
            return;
        }

        this.isProcessing = true;
        this.setSystemLocked(true);
        this.currentTask = pendingTask;
        pendingTask.status = TASK_STATUS.RUNNING;
        pendingTask.startedAt = new Date();
        this.updateQueueUI();

        let success = false;
        let error = null;

        try {
            if (pendingTask.type === 'park') {
                success = await this._executeParkTask(pendingTask.data);
            } else if (pendingTask.type === 'fetch') {
                success = await this._executeFetchTask(pendingTask.data);
            }
        } catch (e) {
            console.error('任务执行失败:', e);
            error = e.message || '执行出错';
            success = false;
        }

        pendingTask.status = success ? TASK_STATUS.COMPLETED : TASK_STATUS.FAILED;
        pendingTask.completedAt = new Date();
        pendingTask.error = error;
        this.currentTask = null;

        if (!success && error) {
            recordManager.addRecord(
                pendingTask.data.plateNumber || '',
                RECORD_TYPES.TASK_CANCELLED,
                pendingTask.data.spaceId || '',
                `${pendingTask.type === 'park' ? '存车' : '取车'}失败: ${error}`
            );
        }

        this.updateQueueUI();
        this.updateAllUI();

        setTimeout(() => {
            this.isProcessing = false;
            this.processNextTask();
        }, 500);
    }

    async _executeParkTask(data) {
        const { spaceId, plateNumber } = data;
        const space = garageManager.getSpace(spaceId);

        if (!space) {
            this.showToast('车位不存在', 'error');
            return false;
        }

        if (space.isFault) {
            const faultInfo = getFaultTypeInfo(space.faultType);
            const faultName = faultInfo ? faultInfo.name : '车位故障';
            this.showToast(`${faultName}，无法使用`, 'error');
            return false;
        }

        if (space.status !== 'free') {
            this.showToast('车位已被占用', 'error');
            return false;
        }

        if (garageManager.findVehicleByPlate(plateNumber)) {
            this.showToast('该车牌号已存在', 'error');
            return false;
        }

        this.showToast(`正在将车辆 ${plateNumber} 存入车位 ${spaceId}...`, 'info');

        const vehicle = this.modelBuilder.buildVehicle(plateNumber);
        vehicle.position.set(0, 0.5, CONFIG.GARAGE.EXIT_POSITION.z);

        const startPos = { x: 0, y: 0.5, z: CONFIG.GARAGE.EXIT_POSITION.z };
        const endPos = { 
            x: space.position.x, 
            y: space.position.y, 
            z: space.position.z 
        };

        await animationController.parkVehicle(vehicle, startPos, endPos);

        const result = garageManager.parkVehicle(spaceId, plateNumber);
        if (result.success) {
            garageManager.updateSpaceVehicleMesh(spaceId, vehicle);
            this.modelBuilder.updateSpaceColor(space);
            recordManager.addRecord(plateNumber, RECORD_TYPES.PARK, spaceId, '存车成功');
            this.showToast(`车辆 ${plateNumber} 已成功存入车位 ${spaceId}`, 'success');
            
            if (this.lastSearchedPlate === plateNumber) {
                garageManager.showSearchResult(plateNumber);
            }
        }

        return result.success;
    }

    async _executeFetchTask(data) {
        const { plateNumber } = data;
        const space = garageManager.findVehicleByPlate(plateNumber);

        if (!space) {
            this.showToast('未找到该车辆', 'error');
            return false;
        }

        if (space.isFault) {
            const faultInfo = getFaultTypeInfo(space.faultType);
            const faultName = faultInfo ? faultInfo.name : '车位故障';
            this.showToast(`${faultName}，无法取车`, 'error');
            return false;
        }

        this.showToast(`正在取出车辆 ${plateNumber}...`, 'info');

        const vehicle = space.vehicleMesh;
        const startPos = { 
            x: space.position.x, 
            y: space.position.y, 
            z: space.position.z 
        };
        const endPos = CONFIG.GARAGE.EXIT_POSITION;

        await animationController.fetchVehicle(vehicle, startPos, endPos);

        const result = garageManager.fetchVehicle(plateNumber);
        if (result.success) {
            this.modelBuilder.updateSpaceColor(space);
            recordManager.addRecord(plateNumber, RECORD_TYPES.FETCH, space.id, '取车成功');
            
            setTimeout(() => {
                if (vehicle && vehicle.parent) {
                    vehicle.parent.remove(vehicle);
                }
            }, 2000);

            this.showToast(`车辆 ${plateNumber} 已到达出入口`, 'success');

            if (this.lastSearchedPlate === plateNumber) {
                garageManager.showSearchResult(plateNumber);
            }
        }

        return result.success;
    }

    parkVehicle(spaceId, plateNumber) {
        if (!plateNumber || plateNumber.trim() === '') {
            this.showToast('请输入车牌号', 'warning');
            return null;
        }

        const space = garageManager.getSpace(spaceId);
        if (!space) {
            this.showToast('车位不存在', 'error');
            return null;
        }

        if (space.isFault) {
            const faultInfo = getFaultTypeInfo(space.faultType);
            this.showToast(`${faultInfo?.name || '车位故障'}，无法使用`, 'error');
            return null;
        }

        if (space.status !== 'free') {
            this.showToast('车位已被占用', 'error');
            return null;
        }

        if (garageManager.findVehicleByPlate(plateNumber)) {
            this.showToast('该车牌号已存在', 'error');
            return null;
        }

        return this.enqueueTask('park', { spaceId, plateNumber: plateNumber.trim() });
    }

    fetchVehicle(plateNumber) {
        if (!plateNumber || plateNumber.trim() === '') {
            this.showToast('请输入车牌号', 'warning');
            return null;
        }

        const space = garageManager.findVehicleByPlate(plateNumber);
        if (!space) {
            this.showToast('未找到该车辆', 'error');
            return null;
        }

        if (space.isFault) {
            const faultInfo = getFaultTypeInfo(space.faultType);
            this.showToast(`${faultInfo?.name || '车位故障'}，无法取车`, 'error');
            return null;
        }

        return this.enqueueTask('fetch', { plateNumber: plateNumber.trim() });
    }

    searchVehicle(plateNumber) {
        if (!plateNumber || plateNumber.trim() === '') {
            this.showToast('请输入车牌号', 'warning');
            garageManager.clearSearchResult();
            this.lastSearchedPlate = null;
            return null;
        }

        plateNumber = plateNumber.trim();
        this.lastSearchedPlate = plateNumber;

        const space = garageManager.findVehicleByPlate(plateNumber);
        garageManager.showSearchResult(plateNumber);

        if (space) {
            this.modelBuilder.highlightSpace(space.id);
            setTimeout(() => {
                this.modelBuilder.unhighlightSpace(space.id);
            }, 3000);
            this.showToast(`找到车辆 ${plateNumber}，位于车位 ${space.id}`, 'success');
        } else {
            const history = recordManager.getRecordsByPlate(plateNumber);
            if (history.length > 0) {
                this.showToast(`车辆 ${plateNumber} 已取走，显示历史记录`, 'info');
            } else {
                this.showToast('未找到该车辆', 'error');
            }
        }

        return space;
    }

    openFaultModal(spaceId) {
        if (this.isSystemLocked || this.isProcessing) {
            this.showToast('系统正在执行任务，请稍候再操作', 'warning');
            return;
        }

        const space = garageManager.getSpace(spaceId);
        if (!space) return;

        if (space.isFault) {
            this.clearFault(spaceId);
            return;
        }

        this.pendingFaultSpaceId = spaceId;
        const modal = document.getElementById('faultModal');
        const spaceIdEl = document.getElementById('faultModalSpaceId');
        
        if (spaceIdEl) {
            spaceIdEl.textContent = `车位 ${spaceId}`;
        }

        document.querySelectorAll('input[name="faultType"]').forEach(r => r.checked = false);
        
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    closeFaultModal() {
        this.pendingFaultSpaceId = null;
        const modal = document.getElementById('faultModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    confirmFault() {
        if (!this.pendingFaultSpaceId) {
            this.closeFaultModal();
            return;
        }

        const selectedType = document.querySelector('input[name="faultType"]:checked');
        if (!selectedType) {
            this.showToast('请选择故障类型', 'warning');
            return;
        }

        const faultTypeId = selectedType.value;
        const result = garageManager.setFault(this.pendingFaultSpaceId, faultTypeId);
        
        if (result.success) {
            this.showToast(`车位 ${this.pendingFaultSpaceId} ${result.faultInfo.name}已设置`, 'warning');
            recordManager.addRecord(
                '',
                RECORD_TYPES.FAULT_SET,
                this.pendingFaultSpaceId,
                `${result.faultInfo.name}已设置`,
                { faultType: faultTypeId }
            );
        } else {
            this.showToast(result.message, 'error');
        }

        this.closeFaultModal();
        this.updateAllUI();
    }

    clearFault(spaceId) {
        const result = garageManager.clearFault(spaceId);
        if (result.success) {
            this.showToast(`车位 ${spaceId} ${result.faultInfo?.name || '故障'}已解除`, 'success');
        } else {
            this.showToast(result.message, 'error');
        }
        this.updateAllUI();
    }

    async handleSpaceClick(spaceId) {
        if (this.isSystemLocked) {
            this.showToast('系统正在执行任务，请稍候再操作', 'warning');
            return;
        }

        const space = garageManager.getSpace(spaceId);
        if (!space) return;

        if (space.isFault) {
            const faultInfo = getFaultTypeInfo(space.faultType);
            this.showToast(`${faultInfo?.name || '车位故障'}，无法使用`, 'error');
            return;
        }

        if (space.status === 'occupied') {
            const plateInput = document.getElementById('plateInput');
            if (plateInput) {
                plateInput.value = space.plateNumber;
            }
            this.showToast(`车位 ${spaceId} 已被车辆 ${space.plateNumber} 占用，已自动填充车牌号`, 'info');
            return;
        }

        const plateInput = document.getElementById('plateInput');
        const plateNumber = plateInput ? plateInput.value.trim() : '';

        if (!plateNumber) {
            this.showToast('请先输入车牌号，然后点击空车位存车', 'warning');
            
            if (plateInput) {
                plateInput.focus();
                plateInput.style.borderColor = '#f59e0b';
                setTimeout(() => {
                    plateInput.style.borderColor = '';
                }, 2000);
            }
            return;
        }

        const task = this.parkVehicle(spaceId, plateNumber);
        if (task && plateInput) {
            plateInput.value = '';
        }
    }

    updateQueueUI() {
        const container = document.getElementById('queueList');
        if (!container) return;

        const allTasks = [...this.taskQueue].reverse();
        const displayTasks = allTasks.slice(0, 20);

        if (displayTasks.length === 0) {
            container.innerHTML = '<p class="placeholder">暂无待执行任务</p>';
            garageManager.updateStatsUI(0);
            return;
        }

        const statusText = {
            [TASK_STATUS.PENDING]: '等待中',
            [TASK_STATUS.RUNNING]: '执行中',
            [TASK_STATUS.COMPLETED]: '已完成',
            [TASK_STATUS.FAILED]: '失败',
            [TASK_STATUS.CANCELLED]: '已取消'
        };

        container.innerHTML = displayTasks.map(task => {
            const typeText = task.type === 'park' ? '存车' : '取车';
            const details = task.type === 'park' 
                ? `车牌: <span>${task.data.plateNumber}</span> | 车位: <span>${task.data.spaceId}</span>`
                : `车牌: <span>${task.data.plateNumber}</span>`;

            return `
                <div class="queue-item ${task.type} ${task.status}">
                    <div class="queue-item-header">
                        <span class="queue-task-type">${typeText}</span>
                        <span class="queue-status">${statusText[task.status]}</span>
                    </div>
                    <div class="queue-details">
                        ${details}
                        ${task.error ? `<br><span style="color: #f87171;">错误: ${task.error}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        const pendingCount = this.getPendingCount();
        garageManager.updateStatsUI(pendingCount + (this.currentTask ? 1 : 0));
    }

    updateAllUI() {
        garageManager.updateStatsUI(this.getPendingCount() + (this.currentTask ? 1 : 0));
        garageManager.updateSpaceListUI(null, this.isSystemLocked);
        recordManager.updateUI();
        this.updateQueueUI();
    }

    setSystemLocked(locked) {
        this.isSystemLocked = locked;
        
        const fetchBtn = document.getElementById('fetchBtn');
        const searchBtn = document.getElementById('searchBtn');
        const plateInput = document.getElementById('plateInput');
        const applyFilterBtn = document.getElementById('applyFilterBtn');
        const resetFilterBtn = document.getElementById('resetFilterBtn');
        const exportBtn = document.getElementById('exportBtn');

        if (fetchBtn) fetchBtn.disabled = locked;
        if (searchBtn) searchBtn.disabled = locked;
        if (plateInput) plateInput.disabled = locked;
        if (applyFilterBtn) applyFilterBtn.disabled = locked;
        if (resetFilterBtn) resetFilterBtn.disabled = locked;
        if (exportBtn) exportBtn.disabled = locked;

        garageManager.updateSpaceListUI(null, locked);
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `toast show ${type}`;

        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }

    applyFilter() {
        const plateEl = document.getElementById('filterPlate');
        const spaceEl = document.getElementById('filterSpace');
        const typeEl = document.getElementById('filterType');
        const startEl = document.getElementById('filterStartDate');
        const endEl = document.getElementById('filterEndDate');

        recordManager.setFilter({
            plateNumber: plateEl?.value?.trim() || '',
            spaceId: spaceEl?.value || '',
            type: typeEl?.value || '',
            startDate: startEl?.value || null,
            endDate: endEl?.value || null
        });

        const count = recordManager.getFilteredRecords().length;
        this.showToast(`筛选完成，共 ${count} 条记录`, 'info');
    }

    resetFilter() {
        recordManager.resetFilter();
        this.showToast('筛选条件已重置', 'info');
    }

    exportRecords() {
        const result = recordManager.exportToCSV();
        if (result.success) {
            this.showToast(result.message, 'success');
        } else {
            this.showToast(result.message, 'warning');
        }
    }

    async initializeDemoVehicles() {
        if (garageManager.hasSavedData()) {
            this.updateAllUI();
            return;
        }

        const initialVehicles = CONFIG.INITIAL_VEHICLES;
        
        for (const vehicle of initialVehicles) {
            const space = garageManager.getSpace(vehicle.space);
            if (space && space.status === 'free') {
                const vehicleMesh = this.modelBuilder.buildVehicle(vehicle.plate);
                vehicleMesh.position.set(
                    space.position.x,
                    space.position.y + 0.5,
                    space.position.z
                );
                
                garageManager.parkVehicle(vehicle.space, vehicle.plate);
                garageManager.updateSpaceVehicleMesh(vehicle.space, vehicleMesh);
                this.modelBuilder.updateSpaceColor(space);
                recordManager.addRecord(vehicle.plate, RECORD_TYPES.PARK, vehicle.space, '初始停放');
            }
        }

        this.updateAllUI();
    }
}

export default ParkingService;
