export const CONFIG = {
    GARAGE: {
        FLOORS: 3,
        SPACES_PER_FLOOR: 5,
        TOTAL_SPACES: 15,
        SPACE_WIDTH: 3,
        SPACE_DEPTH: 6,
        FLOOR_HEIGHT: 4,
        GARAGE_WIDTH: 18,
        GARAGE_DEPTH: 8,
        EXIT_POSITION: { x: 0, y: 0.5, z: -10 }
    },
    COLORS: {
        FREE: 0x22c55e,
        OCCUPIED: 0xef4444,
        FAULT: 0xf59e0b,
        FAULT_LIFT: 0xeab308,
        FAULT_TRAVERSE: 0xf97316,
        FAULT_LOCK: 0xdc2626,
        HIGHLIGHT: 0x00d4ff,
        GARAGE: 0x334155,
        GARAGE_FLOOR: 0x1e293b,
        PILLAR: 0x475569,
        VEHICLE_BODY: 0x3b82f6,
        VEHICLE_WINDOW: 0x60a5fa,
        VEHICLE_WHEEL: 0x1f2937,
        PLATE: 0xffffff,
        PLATE_TEXT: 0x1f2937,
        ENTRANCE: 0x00d4ff
    },
    ANIMATION: {
        HORIZONTAL_SPEED: 3,
        VERTICAL_SPEED: 2,
        DEPTH_SPEED: 3,
        FAULT_BLINK_INTERVAL: 500
    },
    FAULT_TYPES: {
        LIFT: { id: 'lift', name: '升降故障', description: '升降机故障，无法升降', color: '#eab308' },
        TRAVERSE: { id: 'traverse', name: '横移故障', description: '横移机构故障，无法横移', color: '#f97316' },
        LOCK: { id: 'lock', name: '车位锁故障', description: '车位锁故障，车辆无法取放', color: '#dc2626' }
    },
    STORAGE: {
        SPACES_KEY: 'garage_spaces_data',
        RECORDS_KEY: 'garage_records_data',
        QUEUE_KEY: 'garage_queue_data'
    },
    INITIAL_VEHICLES: [
        { plate: '京A12345', space: 'A1' },
        { plate: '京B67890', space: 'A3' },
        { plate: '沪C11111', space: 'B2' },
        { plate: '粤D22222', space: 'C1' },
        { plate: '苏E33333', space: 'C4' }
    ]
};

export const RECORD_TYPES = {
    PARK: 'park',
    FETCH: 'fetch',
    FAULT_SET: 'fault_set',
    FAULT_CLEAR: 'fault_clear',
    TASK_CANCELLED: 'task_cancelled'
};

export const TASK_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

export function generateSpaceId(floor, position) {
    const floorLetter = String.fromCharCode(64 + floor);
    return `${floorLetter}${position}`;
}

export function parseSpaceId(spaceId) {
    const floorLetter = spaceId.charAt(0);
    const floor = floorLetter.charCodeAt(0) - 64;
    const position = parseInt(spaceId.charAt(1));
    return { floor, position };
}

export function formatTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatDateForInput(date) {
    const d = new Date(date);
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function generateTaskId() {
    return `TASK${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
}

export function getFaultTypeInfo(faultTypeId) {
    const types = Object.values(CONFIG.FAULT_TYPES);
    return types.find(t => t.id === faultTypeId) || null;
}
