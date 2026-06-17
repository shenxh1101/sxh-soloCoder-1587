import { CONFIG, generateSpaceId, parseSpaceId, formatTime, getFaultTypeInfo } from './config.js';
import { recordManager } from './RecordManager.js';

class GarageManager {
    constructor() {
        this.spaces = new Map();
        this.vehicles = new Map();
        this.onSpaceStatusChange = null;
        this.initializeSpaces();
        this.loadFromStorage();
    }

    initializeSpaces() {
        for (let floor = 1; floor <= CONFIG.GARAGE.FLOORS; floor++) {
            for (let position = 1; position <= CONFIG.GARAGE.SPACES_PER_FLOOR; position++) {
                const id = generateSpaceId(floor, position);
                const { x, y, z } = this.getSpacePosition(floor, position);
                
                this.spaces.set(id, {
                    id,
                    floor,
                    position,
                    status: 'free',
                    plateNumber: null,
                    parkTime: null,
                    fetchTime: null,
                    isFault: false,
                    faultType: null,
                    faultTime: null,
                    mesh: null,
                    plateMesh: null,
                    vehicleMesh: null,
                    position: { x, y, z },
                    originalColor: CONFIG.COLORS.FREE,
                    faultInterval: null,
                    faultBlinkColor: 0
                });
            }
        }
    }

    getSpacePosition(floor, position) {
        const x = (position - 3) * CONFIG.GARAGE.SPACE_WIDTH;
        const y = (floor - 1) * CONFIG.GARAGE.FLOOR_HEIGHT;
        const z = 0;
        return { x, y, z };
    }

    getSpace(spaceId) {
        return this.spaces.get(spaceId);
    }

    getAllSpaces() {
        return Array.from(this.spaces.values());
    }

    getFreeSpaces() {
        return this.getAllSpaces().filter(s => s.status === 'free' && !s.isFault);
    }

    getOccupiedSpaces() {
        return this.getAllSpaces().filter(s => s.status === 'occupied');
    }

    getFaultSpaces() {
        return this.getAllSpaces().filter(s => s.isFault);
    }

    findVehicleByPlate(plateNumber) {
        return this.getAllSpaces().find(
            s => s.status === 'occupied' && s.plateNumber === plateNumber
        );
    }

    findVehicleHistoryByPlate(plateNumber) {
        return recordManager.getRecordsByPlate(plateNumber);
    }

    parkVehicle(spaceId, plateNumber) {
        const space = this.getSpace(spaceId);
        if (!space) return { success: false, message: '车位不存在' };
        if (space.status !== 'free') return { success: false, message: '车位已被占用' };
        if (space.isFault) {
            const faultInfo = getFaultTypeInfo(space.faultType);
            const faultName = faultInfo ? faultInfo.name : '车位故障';
            return { success: false, message: `${faultName}，无法使用` };
        }
        if (this.findVehicleByPlate(plateNumber)) {
            return { success: false, message: '该车牌号已存在' };
        }

        space.status = 'occupied';
        space.plateNumber = plateNumber;
        space.parkTime = new Date();
        space.fetchTime = null;
        
        this.saveToStorage();
        
        if (this.onSpaceStatusChange) {
            this.onSpaceStatusChange(space);
        }
        
        return { success: true, space };
    }

    fetchVehicle(plateNumber) {
        const space = this.findVehicleByPlate(plateNumber);
        if (!space) return { success: false, message: '未找到该车辆' };
        if (space.isFault) {
            const faultInfo = getFaultTypeInfo(space.faultType);
            const faultName = faultInfo ? faultInfo.name : '车位故障';
            return { success: false, message: `${faultName}，无法取车` };
        }

        const vehicleMesh = space.vehicleMesh;
        space.status = 'free';
        space.plateNumber = null;
        space.parkTime = null;
        space.fetchTime = new Date();
        space.vehicleMesh = null;

        this.saveToStorage();

        if (this.onSpaceStatusChange) {
            this.onSpaceStatusChange(space);
        }

        return { success: true, space, vehicleMesh };
    }

    setFault(spaceId, faultTypeId) {
        const space = this.getSpace(spaceId);
        if (!space) return { success: false, message: '车位不存在' };
        if (space.isFault) return { success: false, message: '车位已处于故障状态' };

        const faultInfo = getFaultTypeInfo(faultTypeId);
        if (!faultInfo) return { success: false, message: '无效的故障类型' };

        space.isFault = true;
        space.faultType = faultTypeId;
        space.faultTime = new Date();

        this.startFaultBlink(space, faultTypeId);
        this.saveToStorage();

        if (this.onSpaceStatusChange) {
            this.onSpaceStatusChange(space);
        }

        return { success: true, space, faultInfo };
    }

    clearFault(spaceId) {
        const space = this.getSpace(spaceId);
        if (!space) return { success: false, message: '车位不存在' };
        if (!space.isFault) return { success: false, message: '车位未处于故障状态' };

        const faultInfo = getFaultTypeInfo(space.faultType);
        const faultName = faultInfo ? faultInfo.name : '故障';

        space.isFault = false;
        space.faultType = null;
        space.faultTime = null;

        this.stopFaultBlink(space);
        this.saveToStorage();

        if (this.onSpaceStatusChange) {
            this.onSpaceStatusChange(space);
        }

        return { success: true, space, faultInfo };
    }

    toggleFault(spaceId, faultTypeId = 'lock') {
        const space = this.getSpace(spaceId);
        if (!space) return { success: false, message: '车位不存在' };

        if (space.isFault) {
            return this.clearFault(spaceId);
        } else {
            return this.setFault(spaceId, faultTypeId);
        }
    }

    startFaultBlink(space, faultTypeId) {
        if (space.faultInterval) return;
        
        let colorIndex = 0;
        const faultInfo = getFaultTypeInfo(faultTypeId);
        const faultColor = faultInfo ? this.hexToRgb(faultInfo.color) : 0xf59e0b;
        
        const colors = [CONFIG.COLORS.FAULT, faultColor, CONFIG.COLORS.OCCUPIED];
        let idx = 0;

        space.faultInterval = setInterval(() => {
            if (space.mesh) {
                space.mesh.material.color.setHex(colors[idx]);
                space.mesh.material.emissive.setHex(colors[idx]);
                idx = (idx + 1) % colors.length;
            }
        }, CONFIG.ANIMATION.FAULT_BLINK_INTERVAL);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            (parseInt(result[1], 16) << 16) | (parseInt(result[2], 16) << 8) | parseInt(result[3], 16) : 
            0xf59e0b;
    }

    stopFaultBlink(space) {
        if (space.faultInterval) {
            clearInterval(space.faultInterval);
            space.faultInterval = null;
        }
        
        if (space.mesh) {
            const color = space.status === 'occupied' ? CONFIG.COLORS.OCCUPIED : CONFIG.COLORS.FREE;
            space.mesh.material.color.setHex(color);
            space.mesh.material.emissive.setHex(color);
        }
    }

    updateSpaceMesh(spaceId, mesh) {
        const space = this.getSpace(spaceId);
        if (space) {
            space.mesh = mesh;
            if (space.isFault) {
                this.startFaultBlink(space, space.faultType);
            }
        }
    }

    updateSpacePlateMesh(spaceId, plateMesh) {
        const space = this.getSpace(spaceId);
        if (space) {
            space.plateMesh = plateMesh;
        }
    }

    updateSpaceVehicleMesh(spaceId, vehicleMesh) {
        const space = this.getSpace(spaceId);
        if (space) {
            space.vehicleMesh = vehicleMesh;
        }
    }

    getStats() {
        return {
            total: this.spaces.size,
            occupied: this.getOccupiedSpaces().length,
            free: this.getFreeSpaces().length,
            fault: this.getFaultSpaces().length
        };
    }

    updateStatsUI(queueCount = 0) {
        const stats = this.getStats();
        const totalEl = document.getElementById('totalSpaces');
        const occupiedEl = document.getElementById('occupiedSpaces');
        const freeEl = document.getElementById('freeSpaces');
        const faultEl = document.getElementById('faultSpaces');
        const queueEl = document.getElementById('queueCount');
        
        if (totalEl) totalEl.textContent = stats.total;
        if (occupiedEl) occupiedEl.textContent = stats.occupied;
        if (freeEl) freeEl.textContent = stats.free;
        if (faultEl) faultEl.textContent = stats.fault;
        if (queueEl) queueEl.textContent = queueCount;

        const badgeEl = document.getElementById('queueBadge');
        if (badgeEl) badgeEl.textContent = queueCount;
    }

    updateSpaceListUI(highlightSpaceId = null, locked = false) {
        const container = document.getElementById('spaceList');
        if (!container) return;

        container.innerHTML = this.getAllSpaces().map(space => {
            const statusClass = space.isFault ? 'fault' : space.status;
            let statusText = space.status === 'free' ? '空闲' : '占用';
            if (space.isFault) {
                const faultInfo = getFaultTypeInfo(space.faultType);
                statusText = faultInfo ? faultInfo.name : '故障';
            }
            const faultClass = space.isFault ? 'active' : '';
            const highlightClass = highlightSpaceId === space.id ? 'highlight' : '';
            const faultTypeInfo = space.isFault && space.faultType ? getFaultTypeInfo(space.faultType) : null;
            
            return `
                <div class="space-item ${highlightClass}" data-space-id="${space.id}">
                    <div class="space-info">
                        <span class="space-id">${space.id}</span>
                        <span class="space-status ${statusClass}">${statusText}</span>
                        ${faultTypeInfo ? `<span class="space-fault-type" style="background: ${faultTypeInfo.color}20; color: ${faultTypeInfo.color}">${faultTypeInfo.name}</span>` : ''}
                        ${space.plateNumber ? `<span class="space-plate">${space.plateNumber}</span>` : ''}
                    </div>
                    <button class="btn btn-danger ${faultClass}" 
                            onclick="window.toggleFault('${space.id}')"
                            ${locked ? 'disabled' : ''}>
                        ${space.isFault ? '解除' : '故障'}
                    </button>
                </div>
            `;
        }).join('');
    }

    showSearchResult(plateNumber) {
        const container = document.getElementById('searchResult');
        if (!container) return;

        if (!plateNumber) {
            container.innerHTML = '<p class="placeholder">请输入车牌号进行搜索</p>';
            return;
        }

        const space = this.findVehicleByPlate(plateNumber);
        
        if (space) {
            container.innerHTML = `
                <div class="result-item">
                    <span class="result-label">车牌号:</span>
                    <span class="result-value">${space.plateNumber}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">车位编号:</span>
                    <span class="result-value">${space.id}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">存入时间:</span>
                    <span class="result-value">${formatTime(space.parkTime)}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">状态:</span>
                    <span class="result-value" style="color: #4ade80;">在库中</span>
                </div>
            `;
            this.updateSpaceListUI(space.id);
            return;
        }

        const history = this.findVehicleHistoryByPlate(plateNumber);
        if (history.length > 0) {
            const fetchRecords = history.filter(r => r.type === 'fetch');
            const parkRecords = history.filter(r => r.type === 'park');
            const lastFetch = fetchRecords.length > 0 ? fetchRecords[0] : null;
            const lastPark = parkRecords.length > 0 ? parkRecords[0] : null;

            container.innerHTML = `
                <div class="result-item">
                    <span class="result-label">车牌号:</span>
                    <span class="result-value">${plateNumber}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">状态:</span>
                    <span class="result-value" style="color: #fbbf24;">已取走</span>
                </div>
                ${lastPark ? `
                <div class="result-item">
                    <span class="result-label">最后停放:</span>
                    <span class="result-value">车位 ${lastPark.spaceId}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">存入时间:</span>
                    <span class="result-value">${formatTime(lastPark.time)}</span>
                </div>
                ` : ''}
                ${lastFetch ? `
                <div class="result-item">
                    <span class="result-label">取车时间:</span>
                    <span class="result-value">${formatTime(lastFetch.time)}</span>
                </div>
                ` : ''}
                <div class="fetched-info">
                    ℹ️ 该车辆已不在车库中，以上为历史记录
                </div>
            `;
            this.updateSpaceListUI();
            return;
        }

        container.innerHTML = '<p class="not-found">未找到该车辆</p>';
        this.updateSpaceListUI();
    }

    clearSearchResult() {
        const container = document.getElementById('searchResult');
        if (container) {
            container.innerHTML = '<p class="placeholder">请输入车牌号进行搜索</p>';
        }
        this.updateSpaceListUI();
    }

    initSpaceFilterOptions() {
        const select = document.getElementById('filterSpace');
        if (!select) return;
        
        const options = ['<option value="">全部</option>'];
        this.getAllSpaces().forEach(space => {
            options.push(`<option value="${space.id}">${space.id}</option>`);
        });
        select.innerHTML = options.join('');
    }

    saveToStorage() {
        try {
            const data = {};
            this.spaces.forEach((space, id) => {
                data[id] = {
                    status: space.status,
                    plateNumber: space.plateNumber,
                    parkTime: space.parkTime,
                    fetchTime: space.fetchTime,
                    isFault: space.isFault,
                    faultType: space.faultType,
                    faultTime: space.faultTime
                };
            });
            localStorage.setItem(CONFIG.STORAGE.SPACES_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('保存车位数据失败:', e);
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE.SPACES_KEY);
            if (!saved) return false;
            
            const data = JSON.parse(saved);
            let hasData = false;
            
            Object.keys(data).forEach(id => {
                const space = this.spaces.get(id);
                if (space) {
                    const savedSpace = data[id];
                    space.status = savedSpace.status || 'free';
                    space.plateNumber = savedSpace.plateNumber || null;
                    space.parkTime = savedSpace.parkTime ? new Date(savedSpace.parkTime) : null;
                    space.fetchTime = savedSpace.fetchTime ? new Date(savedSpace.fetchTime) : null;
                    space.isFault = savedSpace.isFault || false;
                    space.faultType = savedSpace.faultType || null;
                    space.faultTime = savedSpace.faultTime ? new Date(savedSpace.faultTime) : null;
                    hasData = true;
                }
            });
            
            return hasData;
        } catch (e) {
            console.warn('加载车位数据失败:', e);
            return false;
        }
    }

    hasSavedData() {
        return !!localStorage.getItem(CONFIG.STORAGE.SPACES_KEY);
    }

    cleanup() {
        this.getAllSpaces().forEach(space => {
            this.stopFaultBlink(space);
        });
    }
}

export const garageManager = new GarageManager();
export default GarageManager;
