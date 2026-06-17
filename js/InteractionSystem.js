import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { garageManager } from './GarageManager.js';

class InteractionSystem {
    constructor(scene, camera, renderer, parkingService, modelBuilder) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.parkingService = parkingService;
        this.modelBuilder = modelBuilder;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredSpace = null;
        this.isDragging = false;
        this.mouseDownTime = 0;
        this.mouseDownPos = { x: 0, y: 0 };

        this.initControls();
        this.initEventListeners();
    }

    initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 50;
        this.controls.maxPolarAngle = Math.PI / 2.1;
        this.controls.target.set(0, 3, 0);
        this.controls.update();
    }

    initEventListeners() {
        const canvas = this.renderer.domElement;

        canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        canvas.addEventListener('click', this.onClick.bind(this));
        canvas.addEventListener('mouseleave', this.onMouseLeave.bind(this));

        canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        canvas.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });

        window.addEventListener('resize', this.onWindowResize.bind(this));

        document.getElementById('fetchBtn')?.addEventListener('click', () => {
            const plateInput = document.getElementById('plateInput');
            const plateNumber = plateInput ? plateInput.value.trim() : '';
            this.parkingService.fetchVehicle(plateNumber);
        });

        document.getElementById('searchBtn')?.addEventListener('click', () => {
            const plateInput = document.getElementById('plateInput');
            const plateNumber = plateInput ? plateInput.value.trim() : '';
            this.parkingService.searchVehicle(plateNumber);
        });

        document.getElementById('plateInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const plateNumber = e.target.value.trim();
                if (plateNumber) {
                    this.parkingService.searchVehicle(plateNumber);
                }
            }
        });
    }

    onMouseDown(event) {
        this.isDragging = false;
        this.mouseDownTime = Date.now();
        this.mouseDownPos = { x: event.clientX, y: event.clientY };
    }

    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        if (this.mouseDownPos.x && this.mouseDownPos.y) {
            const dx = Math.abs(event.clientX - this.mouseDownPos.x);
            const dy = Math.abs(event.clientY - this.mouseDownPos.y);
            if (dx > 5 || dy > 5) {
                this.isDragging = true;
            }
        }

        this.checkHover();
    }

    onMouseUp(event) {
        const timeDiff = Date.now() - this.mouseDownTime;
        const dx = Math.abs(event.clientX - this.mouseDownPos.x);
        const dy = Math.abs(event.clientY - this.mouseDownPos.y);
        
        if (timeDiff < 300 && dx < 5 && dy < 5) {
            this.isDragging = false;
        }
    }

    onClick(event) {
        if (this.isDragging) return;

        if (this.parkingService && this.parkingService.isSystemLocked) {
            this.parkingService.showToast('系统正在执行任务，请稍候再操作', 'warning');
            return;
        }

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const intersects = this.getIntersects();
        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (object.userData && object.userData.type === 'parkingSpace') {
                this.parkingService.handleSpaceClick(object.userData.spaceId);
            }
        }
    }

    onMouseLeave() {
        this.restoreHoveredSpace();
        this.mouseDownPos = { x: 0, y: 0 };
    }

    onTouchStart(event) {
        if (event.touches.length === 1) {
            event.preventDefault();
            const touch = event.touches[0];
            this.mouseDownTime = Date.now();
            this.mouseDownPos = { x: touch.clientX, y: touch.clientY };
            this.isDragging = false;
        }
    }

    onTouchMove(event) {
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const dx = Math.abs(touch.clientX - this.mouseDownPos.x);
            const dy = Math.abs(touch.clientY - this.mouseDownPos.y);
            if (dx > 10 || dy > 10) {
                this.isDragging = true;
            }
        }
    }

    onTouchEnd(event) {
        if (this.parkingService && this.parkingService.isSystemLocked) {
            this.parkingService.showToast('系统正在执行任务，请稍候再操作', 'warning');
            this.mouseDownPos = { x: 0, y: 0 };
            return;
        }

        if (!this.isDragging && event.changedTouches.length === 1) {
            event.preventDefault();
            const touch = event.changedTouches[0];
            const timeDiff = Date.now() - this.mouseDownTime;
            
            if (timeDiff < 300) {
                const rect = this.renderer.domElement.getBoundingClientRect();
                this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

                const intersects = this.getIntersects();
                if (intersects.length > 0) {
                    const object = intersects[0].object;
                    if (object.userData && object.userData.type === 'parkingSpace') {
                        this.parkingService.handleSpaceClick(object.userData.spaceId);
                    }
                }
            }
        }
        this.mouseDownPos = { x: 0, y: 0 };
    }

    checkHover() {
        if (this.parkingService && this.parkingService.isSystemLocked) {
            this.restoreHoveredSpace();
            this.renderer.domElement.style.cursor = 'not-allowed';
            return;
        }

        const intersects = this.getIntersects();
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (object.userData && object.userData.type === 'parkingSpace') {
                const spaceId = object.userData.spaceId;
                if (this.hoveredSpace !== spaceId) {
                    this.restoreHoveredSpace();
                    this.hoveredSpace = spaceId;
                    this.highlightSpace(spaceId);
                    this.renderer.domElement.style.cursor = 'pointer';
                }
            } else {
                this.restoreHoveredSpace();
            }
        } else {
            this.restoreHoveredSpace();
        }
    }

    getIntersects() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const spaceMeshes = this.modelBuilder.getSpaceMeshes();
        return this.raycaster.intersectObjects(spaceMeshes, true);
    }

    highlightSpace(spaceId) {
        const space = garageManager.getSpace(spaceId);
        
        if (space && space.mesh && !space.isFault && !space.isHighlighted) {
            space.mesh.material.emissiveIntensity = 0.5;
        }
    }

    restoreHoveredSpace() {
        if (this.hoveredSpace) {
            const space = garageManager.getSpace(this.hoveredSpace);
            
            if (space && space.mesh && !space.isFault && !space.isHighlighted) {
                space.mesh.material.emissiveIntensity = 0.2;
            }
            this.hoveredSpace = null;
        }
        if (!this.parkingService || !this.parkingService.isSystemLocked) {
            this.renderer.domElement.style.cursor = 'grab';
        }
    }

    onWindowResize() {
        const container = document.getElementById('sceneContainer');
        if (container) {
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
    }

    update() {
        this.controls.update();
    }

    dispose() {
        this.controls.dispose();
    }
}

export default InteractionSystem;
