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
    INITIAL_VEHICLES: [
        { plate: '京A12345', space: 'A1' },
        { plate: '京B67890', space: 'A3' },
        { plate: '沪C11111', space: 'B2' },
        { plate: '粤D22222', space: 'C1' },
        { plate: '苏E33333', space: 'C4' }
    ]
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
    const d = new Date(date);
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
