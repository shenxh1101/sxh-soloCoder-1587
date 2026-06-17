import * as THREE from 'three';
import { CONFIG, generateSpaceId, getFaultTypeInfo } from './config.js';
import { garageManager } from './GarageManager.js';

class ModelBuilder {
    constructor(scene) {
        this.scene = scene;
        this.garageGroup = new THREE.Group();
        this.vehicleGroup = new THREE.Group();
        this.spaceMeshes = [];
        this.faultIndicatorMeshes = {};
        this.faultAnimations = {};
        this.scene.add(this.garageGroup);
        this.scene.add(this.vehicleGroup);
    }

    buildGarage() {
        this.buildGround();
        this.buildFloors();
        this.buildPillars();
        this.buildWalls();
        this.buildParkingSpaces();
        this.buildEntrance();
        this.buildTransferMechanism();
        return this.garageGroup;
    }

    buildGround() {
        const groundGeometry = new THREE.PlaneGeometry(50, 30);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.9,
            metalness: 0.1
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        ground.receiveShadow = true;
        this.garageGroup.add(ground);
    }

    buildFloors() {
        for (let floor = 0; floor < CONFIG.GARAGE.FLOORS; floor++) {
            const floorGeometry = new THREE.BoxGeometry(
                CONFIG.GARAGE.GARAGE_WIDTH,
                0.3,
                CONFIG.GARAGE.GARAGE_DEPTH
            );
            const floorMaterial = new THREE.MeshStandardMaterial({
                color: CONFIG.COLORS.GARAGE_FLOOR,
                roughness: 0.7,
                metalness: 0.3
            });
            const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
            floorMesh.position.set(
                0,
                floor * CONFIG.GARAGE.FLOOR_HEIGHT - 0.15,
                0
            );
            floorMesh.receiveShadow = true;
            this.garageGroup.add(floorMesh);
        }

        const topGeometry = new THREE.BoxGeometry(
            CONFIG.GARAGE.GARAGE_WIDTH + 1,
            0.4,
            CONFIG.GARAGE.GARAGE_DEPTH + 1
        );
        const topMaterial = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.GARAGE,
            roughness: 0.6,
            metalness: 0.4
        });
        const topMesh = new THREE.Mesh(topGeometry, topMaterial);
        topMesh.position.set(
            0,
            CONFIG.GARAGE.FLOORS * CONFIG.GARAGE.FLOOR_HEIGHT + 0.2,
            0
        );
        topMesh.receiveShadow = true;
        this.garageGroup.add(topMesh);
    }

    buildPillars() {
        const pillarGeometry = new THREE.BoxGeometry(0.4, CONFIG.GARAGE.FLOOR_HEIGHT * 3, 0.4);
        const pillarMaterial = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.PILLAR,
            roughness: 0.5,
            metalness: 0.5
        });

        const pillarPositions = [
            { x: -7.5, z: -3.5 },
            { x: 7.5, z: -3.5 },
            { x: -7.5, z: 3.5 },
            { x: 7.5, z: 3.5 },
            { x: 0, z: -3.5 },
            { x: 0, z: 3.5 }
        ];

        pillarPositions.forEach(pos => {
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(pos.x, CONFIG.GARAGE.FLOOR_HEIGHT * 1.5, pos.z);
            pillar.castShadow = true;
            this.garageGroup.add(pillar);
        });
    }

    buildWalls() {
        const backWallGeometry = new THREE.BoxGeometry(
            CONFIG.GARAGE.GARAGE_WIDTH,
            CONFIG.GARAGE.FLOOR_HEIGHT * 3 + 0.4,
            0.3
        );
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.GARAGE,
            roughness: 0.8,
            metalness: 0.2,
            side: THREE.DoubleSide
        });
        const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
        backWall.position.set(0, CONFIG.GARAGE.FLOOR_HEIGHT * 1.5, CONFIG.GARAGE.GARAGE_DEPTH / 2);
        this.garageGroup.add(backWall);

        const sideWallGeometry = new THREE.BoxGeometry(
            0.3,
            CONFIG.GARAGE.FLOOR_HEIGHT * 3 + 0.4,
            CONFIG.GARAGE.GARAGE_DEPTH
        );
        const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        leftWall.position.set(-CONFIG.GARAGE.GARAGE_WIDTH / 2, CONFIG.GARAGE.FLOOR_HEIGHT * 1.5, 0);
        this.garageGroup.add(leftWall);

        const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        rightWall.position.set(CONFIG.GARAGE.GARAGE_WIDTH / 2, CONFIG.GARAGE.FLOOR_HEIGHT * 1.5, 0);
        this.garageGroup.add(rightWall);
    }

    buildParkingSpaces() {
        for (let floor = 1; floor <= CONFIG.GARAGE.FLOORS; floor++) {
            for (let position = 1; position <= CONFIG.GARAGE.SPACES_PER_FLOOR; position++) {
                this.buildSingleParkingSpace(floor, position);
            }
        }
    }

    buildSingleParkingSpace(floor, position) {
        const spaceId = generateSpaceId(floor, position);
        const space = garageManager.getSpace(spaceId);
        
        const spaceGeometry = new THREE.BoxGeometry(
            CONFIG.GARAGE.SPACE_WIDTH - 0.2,
            0.1,
            CONFIG.GARAGE.SPACE_DEPTH - 0.5
        );
        const spaceMaterial = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.FREE,
            roughness: 0.4,
            metalness: 0.6,
            emissive: CONFIG.COLORS.FREE,
            emissiveIntensity: 0.2
        });
        const spaceMesh = new THREE.Mesh(spaceGeometry, spaceMaterial);
        spaceMesh.position.set(space.position.x, space.position.y + 0.05, space.position.z);
        spaceMesh.userData = { type: 'parkingSpace', spaceId };
        spaceMesh.receiveShadow = true;
        this.garageGroup.add(spaceMesh);
        this.spaceMeshes.push(spaceMesh);
        garageManager.updateSpaceMesh(spaceId, spaceMesh);

        const borderGeometry = new THREE.EdgesGeometry(spaceGeometry);
        const borderMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        border.position.copy(spaceMesh.position);
        this.garageGroup.add(border);

        this.buildSpaceLabel(spaceId, space.position);
    }

    buildSpaceLabel(spaceId, position) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, 128, 64);
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(spaceId, 64, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const labelGeometry = new THREE.PlaneGeometry(1.5, 0.75);
        const labelMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        label.position.set(position.x, position.y + 2, position.z - CONFIG.GARAGE.SPACE_DEPTH / 2 + 0.3);
        this.garageGroup.add(label);
    }

    buildEntrance() {
        const entranceFrameGeometry = new THREE.BoxGeometry(6, 3.5, 0.3);
        const entranceMaterial = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.ENTRANCE,
            roughness: 0.3,
            metalness: 0.7,
            emissive: CONFIG.COLORS.ENTRANCE,
            emissiveIntensity: 0.3
        });

        const topFrame = new THREE.Mesh(
            new THREE.BoxGeometry(6, 0.3, 0.3),
            entranceMaterial
        );
        topFrame.position.set(0, 2, -CONFIG.GARAGE.GARAGE_DEPTH / 2);
        this.garageGroup.add(topFrame);

        const leftFrame = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 3.2, 0.3),
            entranceMaterial
        );
        leftFrame.position.set(-2.85, 0.4, -CONFIG.GARAGE.GARAGE_DEPTH / 2);
        this.garageGroup.add(leftFrame);

        const rightFrame = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 3.2, 0.3),
            entranceMaterial
        );
        rightFrame.position.set(2.85, 0.4, -CONFIG.GARAGE.GARAGE_DEPTH / 2);
        this.garageGroup.add(rightFrame);

        const groundGeometry = new THREE.BoxGeometry(5, 0.05, 3);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.9
        });
        const entranceGround = new THREE.Mesh(groundGeometry, groundMaterial);
        entranceGround.position.set(0, 0.025, -CONFIG.GARAGE.GARAGE_DEPTH / 2 - 1.5);
        this.garageGroup.add(entranceGround);

        const arrowCanvas = document.createElement('canvas');
        arrowCanvas.width = 256;
        arrowCanvas.height = 128;
        const ctx = arrowCanvas.getContext('2d');
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#00d4ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▼ 出入口 ▼', 128, 64);
        
        const arrowTexture = new THREE.CanvasTexture(arrowCanvas);
        const arrowGeometry = new THREE.PlaneGeometry(4, 2);
        const arrowMaterial = new THREE.MeshBasicMaterial({
            map: arrowTexture,
            transparent: true
        });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.rotation.x = -Math.PI / 2;
        arrow.position.set(0, 0.03, -CONFIG.GARAGE.GARAGE_DEPTH / 2 - 1.5);
        this.garageGroup.add(arrow);
    }

    buildTransferMechanism() {
        const liftGeometry = new THREE.BoxGeometry(4, 0.2, 7);
        const liftMaterial = new THREE.MeshStandardMaterial({
            color: 0x64748b,
            roughness: 0.4,
            metalness: 0.6
        });
        const lift = new THREE.Mesh(liftGeometry, liftMaterial);
        lift.position.set(0, 0.1, -1.5);
        lift.userData = { type: 'lift' };
        this.garageGroup.add(lift);
        this.liftPlatform = lift;
    }

    buildVehicle(plateNumber, color = null) {
        const vehicleGroup = new THREE.Group();
        
        const bodyColor = color || this.getRandomVehicleColor();
        const bodyGeometry = new THREE.BoxGeometry(2, 0.8, 4.5);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: bodyColor,
            roughness: 0.3,
            metalness: 0.7
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.6;
        body.castShadow = true;
        vehicleGroup.add(body);

        const cabinGeometry = new THREE.BoxGeometry(1.9, 0.6, 2.5);
        const cabinMaterial = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.VEHICLE_WINDOW,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.6
        });
        const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
        cabin.position.set(0, 1.2, 0.2);
        cabin.castShadow = true;
        vehicleGroup.add(cabin);

        const wheelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.VEHICLE_WHEEL,
            roughness: 0.9
        });
        
        const wheelPositions = [
            { x: -0.9, z: 1.5 },
            { x: 0.9, z: 1.5 },
            { x: -0.9, z: -1.5 },
            { x: 0.9, z: -1.5 }
        ];

        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, 0.35, pos.z);
            wheel.castShadow = true;
            vehicleGroup.add(wheel);
        });

        const plateCanvas = document.createElement('canvas');
        plateCanvas.width = 256;
        plateCanvas.height = 128;
        const ctx = plateCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 256, 128);
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 248, 120);
        ctx.font = 'bold 56px Arial';
        ctx.fillStyle = '#1f2937';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(plateNumber, 128, 64);

        const plateTexture = new THREE.CanvasTexture(plateCanvas);
        const plateGeometry = new THREE.PlaneGeometry(0.8, 0.4);
        const plateMaterial = new THREE.MeshBasicMaterial({
            map: plateTexture,
            side: THREE.DoubleSide
        });
        
        const frontPlate = new THREE.Mesh(plateGeometry, plateMaterial);
        frontPlate.position.set(0, 0.4, 2.26);
        vehicleGroup.add(frontPlate);

        const rearPlate = new THREE.Mesh(plateGeometry, plateMaterial);
        rearPlate.position.set(0, 0.4, -2.26);
        rearPlate.rotation.y = Math.PI;
        vehicleGroup.add(rearPlate);

        vehicleGroup.userData = { type: 'vehicle', plateNumber };
        this.vehicleGroup.add(vehicleGroup);

        return vehicleGroup;
    }

    getRandomVehicleColor() {
        const colors = [
            0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b, 
            0x8b5cf6, 0xec4899, 0x06b6d4, 0x84cc16
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    updateSpaceColor(space) {
        if (!space.mesh) return;

        if (space.isFault) {
            this.setSpaceFault(space);
            return;
        }

        this.clearSpaceFault(space.id);

        const color = space.status === 'occupied' ? CONFIG.COLORS.OCCUPIED : CONFIG.COLORS.FREE;
        space.mesh.material.color.setHex(color);
        space.mesh.material.emissive.setHex(color);
    }

    setSpaceFault(space) {
        if (!space || !space.mesh) return;

        const faultInfo = getFaultTypeInfo(space.faultType);
        const faultColor = faultInfo ? new THREE.Color(faultInfo.color) : new THREE.Color(CONFIG.COLORS.FAULT);

        space.mesh.material.color.copy(faultColor);
        space.mesh.material.emissive.copy(faultColor);

        this.createFaultIndicator(space, faultInfo);
        this.startFaultAnimation(space.id, faultColor);
    }

    createFaultIndicator(space, faultInfo) {
        this.clearFaultIndicator(space.id);

        if (!space.mesh) return;

        const indicatorGeometry = new THREE.BoxGeometry(
            CONFIG.GARAGE.SPACE_WIDTH - 0.4,
            0.05,
            CONFIG.GARAGE.SPACE_DEPTH - 0.7
        );
        const faultColor = faultInfo ? new THREE.Color(faultInfo.color) : new THREE.Color(CONFIG.COLORS.FAULT);
        const indicatorMaterial = new THREE.MeshBasicMaterial({
            color: faultColor,
            transparent: true,
            opacity: 0.8
        });
        const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        indicator.position.set(
            space.position.x,
            space.position.y + 0.15,
            space.position.z
        );
        this.garageGroup.add(indicator);
        this.faultIndicatorMeshes[space.id] = indicator;

        if (faultInfo) {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = faultInfo.color;
            ctx.fillRect(0, 0, 256, 64);
            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚠ ' + faultInfo.name, 128, 32);

            const texture = new THREE.CanvasTexture(canvas);
            const labelGeometry = new THREE.PlaneGeometry(2.5, 0.6);
            const labelMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true
            });
            const faultLabel = new THREE.Mesh(labelGeometry, labelMaterial);
            faultLabel.position.set(
                space.position.x,
                space.position.y + 1.5,
                space.position.z - CONFIG.GARAGE.SPACE_DEPTH / 2 + 0.5
            );
            this.garageGroup.add(faultLabel);
            this.faultIndicatorMeshes[space.id + '_label'] = faultLabel;
        }
    }

    clearSpaceFault(spaceId) {
        this.clearFaultIndicator(spaceId);
        this.stopFaultAnimation(spaceId);

        const space = garageManager.getSpace(spaceId);
        if (space && space.mesh) {
            const color = space.status === 'occupied' ? CONFIG.COLORS.OCCUPIED : CONFIG.COLORS.FREE;
            space.mesh.material.color.setHex(color);
            space.mesh.material.emissive.setHex(color);
            space.mesh.material.emissiveIntensity = 0.2;
        }
    }

    clearFaultIndicator(spaceId) {
        if (this.faultIndicatorMeshes[spaceId]) {
            this.garageGroup.remove(this.faultIndicatorMeshes[spaceId]);
            delete this.faultIndicatorMeshes[spaceId];
        }
        if (this.faultIndicatorMeshes[spaceId + '_label']) {
            this.garageGroup.remove(this.faultIndicatorMeshes[spaceId + '_label']);
            delete this.faultIndicatorMeshes[spaceId + '_label'];
        }
    }

    startFaultAnimation(spaceId, color) {
        this.stopFaultAnimation(spaceId);
        const space = garageManager.getSpace(spaceId);
        if (!space || !space.mesh) return;

        const startIntensity = 0.2;
        const endIntensity = 0.8;
        const duration = 1000;
        let startTime = Date.now();

        const animate = () => {
            if (!space.mesh) return;
            const elapsed = Date.now() - startTime;
            const progress = (elapsed % duration) / duration;
            const intensity = startIntensity + (endIntensity - startIntensity) * (0.5 + 0.5 * Math.sin(progress * Math.PI * 2));
            space.mesh.material.emissiveIntensity = intensity;

            if (this.faultIndicatorMeshes[spaceId]) {
                this.faultIndicatorMeshes[spaceId].material.opacity = 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 2));
            }

            this.faultAnimations[spaceId] = requestAnimationFrame(animate);
        };
        this.faultAnimations[spaceId] = requestAnimationFrame(animate);
    }

    stopFaultAnimation(spaceId) {
        if (this.faultAnimations[spaceId]) {
            cancelAnimationFrame(this.faultAnimations[spaceId]);
            delete this.faultAnimations[spaceId];
        }
        const space = garageManager.getSpace(spaceId);
        if (space && space.mesh) {
            space.mesh.material.emissiveIntensity = 0.2;
        }
    }

    highlightSpace(spaceId) {
        const space = garageManager.getSpace(spaceId);
        if (space && space.mesh) {
            space.isHighlighted = true;
            space.mesh.material.emissive.setHex(CONFIG.COLORS.HIGHLIGHT);
            space.mesh.material.emissiveIntensity = 0.6;
        }
    }

    unhighlightSpace(spaceId) {
        const space = garageManager.getSpace(spaceId);
        if (space && space.mesh) {
            space.isHighlighted = false;
            if (space.isFault) {
                return;
            }
            const color = space.status === 'occupied' ? CONFIG.COLORS.OCCUPIED : CONFIG.COLORS.FREE;
            space.mesh.material.emissive.setHex(color);
            space.mesh.material.emissiveIntensity = 0.2;
        }
    }

    getSpaceMeshes() {
        return this.spaceMeshes;
    }

    getLiftPlatform() {
        return this.liftPlatform;
    }
}

export default ModelBuilder;
