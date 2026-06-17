import { CONFIG } from './config.js';
import { garageManager } from './GarageManager.js';
import { recordManager } from './RecordManager.js';
import { animationController } from './AnimationController.js';

class ParkingService {
    constructor(modelBuilder) {
        this.modelBuilder = modelBuilder;
        this.isProcessing = false;
        this.pendingPlateNumber = null;
    }

    async parkVehicle(spaceId, plateNumber) {
        if (this.isProcessing) {
            this.showToast('系统正在处理中，请稍候', 'warning');
            return false;
        }

        const space = garageManager.getSpace(spaceId);
        if (!space) {
            this.showToast('车位不存在', 'error');
            return false;
        }

        if (space.isFault) {
            this.showToast('车位故障，无法使用', 'error');
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

        this.isProcessing = true;
        this.setButtonsDisabled(true);

        try {
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
                recordManager.addRecord(plateNumber, 'park', spaceId, '存车成功');
                this.showToast(`车辆 ${plateNumber} 已成功存入车位 ${spaceId}`, 'success');
            }

            this.updateAllUI();
            return result.success;
        } catch (error) {
            console.error('存车失败:', error);
            this.showToast('存车过程中发生错误', 'error');
            return false;
        } finally {
            this.isProcessing = false;
            this.setButtonsDisabled(false);
        }
    }

    async fetchVehicle(plateNumber) {
        if (this.isProcessing) {
            this.showToast('系统正在处理中，请稍候', 'warning');
            return false;
        }

        if (!plateNumber || plateNumber.trim() === '') {
            this.showToast('请输入车牌号', 'warning');
            return false;
        }

        const space = garageManager.findVehicleByPlate(plateNumber);
        if (!space) {
            this.showToast('未找到该车辆', 'error');
            return false;
        }

        if (space.isFault) {
            this.showToast('车位故障，无法取车', 'error');
            return false;
        }

        this.isProcessing = true;
        this.setButtonsDisabled(true);

        try {
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
                recordManager.addRecord(plateNumber, 'fetch', space.id, '取车成功');
                
                setTimeout(() => {
                    if (vehicle && vehicle.parent) {
                        vehicle.parent.remove(vehicle);
                    }
                }, 2000);

                this.showToast(`车辆 ${plateNumber} 已到达出入口`, 'success');
            }

            this.updateAllUI();
            return result.success;
        } catch (error) {
            console.error('取车失败:', error);
            this.showToast('取车过程中发生错误', 'error');
            return false;
        } finally {
            this.isProcessing = false;
            this.setButtonsDisabled(false);
        }
    }

    searchVehicle(plateNumber) {
        if (!plateNumber || plateNumber.trim() === '') {
            this.showToast('请输入车牌号', 'warning');
            garageManager.clearSearchResult();
            return null;
        }

        const space = garageManager.findVehicleByPlate(plateNumber);
        garageManager.showSearchResult(plateNumber);

        if (space) {
            this.modelBuilder.highlightSpace(space.id);
            setTimeout(() => {
                this.modelBuilder.unhighlightSpace(space.id);
            }, 3000);
            this.showToast(`找到车辆 ${plateNumber}，位于车位 ${space.id}`, 'success');
        } else {
            this.showToast('未找到该车辆', 'error');
        }

        return space;
    }

    toggleFault(spaceId) {
        const result = garageManager.toggleFault(spaceId);
        if (result.success) {
            const action = result.space.isFault ? '设置故障' : '解除故障';
            this.showToast(`车位 ${spaceId} ${action}成功`, result.space.isFault ? 'warning' : 'success');
            this.updateAllUI();
        } else {
            this.showToast(result.message, 'error');
        }
        return result.success;
    }

    async handleSpaceClick(spaceId) {
        if (this.isProcessing) {
            this.showToast('系统正在处理中，请稍候', 'warning');
            return;
        }

        const space = garageManager.getSpace(spaceId);
        if (!space) return;

        if (space.isFault) {
            this.showToast('车位故障，无法使用', 'error');
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
            this.pendingPlateNumber = null;
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

        await this.parkVehicle(spaceId, plateNumber);
        
        if (plateInput) {
            plateInput.value = '';
        }
    }

    updateAllUI() {
        garageManager.updateStatsUI();
        garageManager.updateSpaceListUI();
        recordManager.updateUI();
    }

    setButtonsDisabled(disabled) {
        const fetchBtn = document.getElementById('fetchBtn');
        const searchBtn = document.getElementById('searchBtn');
        const plateInput = document.getElementById('plateInput');

        if (fetchBtn) fetchBtn.disabled = disabled;
        if (searchBtn) searchBtn.disabled = disabled;
        if (plateInput) plateInput.disabled = disabled;
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

    async initializeDemoVehicles() {
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
                recordManager.addRecord(vehicle.plate, 'park', vehicle.space, '初始停放');
            }
        }

        this.updateAllUI();
    }
}

export default ParkingService;
