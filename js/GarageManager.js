import { CONFIG, generateSpaceId, parseSpaceId, formatTime } from './config.js';

class GarageManager {
    constructor() {
        this.spaces = new Map();
        this.vehicles = new Map();
        this.onSpaceStatusChange = null;
        this.initializeSpaces();
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
                    isFault: false,
                    mesh: null,
                    plateMesh: null,
                    vehicleMesh: null,
                    position: { x, y, z },
                    originalColor: CONFIG.COLORS.FREE,
                    faultInterval: null
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

    parkVehicle(spaceId, plateNumber) {
        const space = this.getSpace(spaceId);
        if (!space) return { success: false, message: '车位不存在' };
        if (space.status !== 'free') return { success: false, message: '车位已被占用' };
        if (space.isFault) return { success: false, message: '车位故障，无法使用' };
        if (this.findVehicleByPlate(plateNumber)) {
            return { success: false, message: '该车牌号已存在' };
        }

        space.status = 'occupied';
        space.plateNumber = plateNumber;
        space.parkTime = new Date();
        
        if (this.onSpaceStatusChange) {
            this.onSpaceStatusChange(space);
        }
        
        return { success: true, space };
    }

    fetchVehicle(plateNumber) {
        const space = this.findVehicleByPlate(plateNumber);
        if (!space) return { success: false, message: '未找到该车辆' };
        if (space.isFault) return { success: false, message: '车位故障，无法取车' };

        const vehicleMesh = space.vehicleMesh;
        space.status = 'free';
        space.plateNumber = null;
        space.parkTime = null;
        space.vehicleMesh = null;

        if (this.onSpaceStatusChange) {
            this.onSpaceStatusChange(space);
        }

        return { success: true, space, vehicleMesh };
    }

    toggleFault(spaceId) {
        const space = this.getSpace(spaceId);
        if (!space) return { success: false, message: '车位不存在' };

        space.isFault = !space.isFault;
        
        if (space.isFault) {
            this.startFaultBlink(space);
        } else {
            this.stopFaultBlink(space);
        }

        if (this.onSpaceStatusChange) {
            this.onSpaceStatusChange(space);
        }

        return { success: true, space };
    }

    startFaultBlink(space) {
        if (space.faultInterval) return;
        
        let isYellow = false;
        space.faultInterval = setInterval(() => {
            if (space.mesh) {
                const color = isYellow ? CONFIG.COLORS.FAULT : CONFIG.COLORS.OCCUPIED;
                space.mesh.material.color.setHex(color);
                isYellow = !isYellow;
            }
        }, CONFIG.ANIMATION.FAULT_BLINK_INTERVAL);
    }

    stopFaultBlink(space) {
        if (space.faultInterval) {
            clearInterval(space.faultInterval);
            space.faultInterval = null;
        }
        
        if (space.mesh) {
            const color = space.status === 'occupied' ? CONFIG.COLORS.OCCUPIED : CONFIG.COLORS.FREE;
            space.mesh.material.color.setHex(color);
        }
    }

    updateSpaceMesh(spaceId, mesh) {
        const space = this.getSpace(spaceId);
        if (space) {
            space.mesh = mesh;
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

    updateStatsUI() {
        const stats = this.getStats();
        document.getElementById('totalSpaces').textContent = stats.total;
        document.getElementById('occupiedSpaces').textContent = stats.occupied;
        document.getElementById('freeSpaces').textContent = stats.free;
        document.getElementById('faultSpaces').textContent = stats.fault;
    }

    updateSpaceListUI(highlightSpaceId = null) {
        const container = document.getElementById('spaceList');
        if (!container) return;

        container.innerHTML = this.getAllSpaces().map(space => {
            const statusClass = space.isFault ? 'fault' : space.status;
            const statusText = space.isFault ? '故障' : (space.status === 'free' ? '空闲' : '占用');
            const faultClass = space.isFault ? 'active' : '';
            const highlightClass = highlightSpaceId === space.id ? 'highlight' : '';
            
            return `
                <div class="space-item ${highlightClass}" data-space-id="${space.id}">
                    <div class="space-info">
                        <span class="space-id">${space.id}</span>
                        <span class="space-status ${statusClass}">${statusText}</span>
                        ${space.plateNumber ? `<span class="space-plate">${space.plateNumber}</span>` : ''}
                    </div>
                    <button class="btn btn-danger ${faultClass}" 
                            onclick="window.toggleFault('${space.id}')"
                            ${space.status === 'occupied' && !space.isFault ? '' : ''}>
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
        if (!space) {
            container.innerHTML = '<p class="not-found">未找到该车辆</p>';
            return;
        }

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
        `;

        this.updateSpaceListUI(space.id);
    }

    clearSearchResult() {
        const container = document.getElementById('searchResult');
        if (container) {
            container.innerHTML = '<p class="placeholder">请输入车牌号进行搜索</p>';
        }
        this.updateSpaceListUI();
    }

    cleanup() {
        this.getAllSpaces().forEach(space => {
            this.stopFaultBlink(space);
        });
    }
}

export const garageManager = new GarageManager();
export default GarageManager;
