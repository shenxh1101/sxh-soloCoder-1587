import * as THREE from 'three';
import { CONFIG } from './config.js';
import { garageManager } from './GarageManager.js';
import { recordManager } from './RecordManager.js';
import { animationController } from './AnimationController.js';
import ModelBuilder from './ModelBuilder.js';
import ParkingService from './ParkingService.js';
import InteractionSystem from './InteractionSystem.js';

class App {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.modelBuilder = null;
        this.parkingService = null;
        this.interactionSystem = null;
        this.clock = new THREE.Clock();
        
        this.init();
    }

    init() {
        this.setupThreeJS();
        this.setupLighting();
        this.setupModelBuilder();
        this.setupParkingService();
        this.setupInteractionSystem();
        this.setupEventBindings();
        this.initializeData();
        this.animate();
        
        console.log('3D自动化立体车库模拟系统已启动');
    }

    setupThreeJS() {
        const container = document.getElementById('sceneContainer');
        const canvas = document.getElementById('threeCanvas');
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a1628);
        this.scene.fog = new THREE.Fog(0x0a1628, 30, 80);

        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(15, 12, 20);
        this.camera.lookAt(0, 3, 0);

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1);
        mainLight.position.set(15, 25, 15);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 100;
        mainLight.shadow.camera.left = -25;
        mainLight.shadow.camera.right = 25;
        mainLight.shadow.camera.top = 25;
        mainLight.shadow.camera.bottom = -25;
        mainLight.shadow.bias = -0.0001;
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.3);
        fillLight.position.set(-10, 15, -10);
        this.scene.add(fillLight);

        const pointLight1 = new THREE.PointLight(0x00d4ff, 0.5, 20);
        pointLight1.position.set(0, 8, -8);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x7c3aed, 0.3, 15);
        pointLight2.position.set(0, 6, 4);
        this.scene.add(pointLight2);

        this.addDecorativeLights();
    }

    addDecorativeLights() {
        const lightColors = [0x00d4ff, 0x7c3aed, 0xf472b6];
        const positions = [
            { x: -8, z: -3 },
            { x: 8, z: -3 },
            { x: 0, z: 3 }
        ];

        positions.forEach((pos, i) => {
            const light = new THREE.PointLight(lightColors[i], 0.3, 12);
            light.position.set(pos.x, 10, pos.z);
            this.scene.add(light);

            const bulbGeometry = new THREE.SphereGeometry(0.15, 16, 16);
            const bulbMaterial = new THREE.MeshBasicMaterial({ color: lightColors[i] });
            const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
            bulb.position.copy(light.position);
            this.scene.add(bulb);
        });
    }

    setupModelBuilder() {
        this.modelBuilder = new ModelBuilder(this.scene);
        this.modelBuilder.garageManager = garageManager;
        this.modelBuilder.buildGarage();
    }

    setupParkingService() {
        this.parkingService = new ParkingService(this.modelBuilder);
    }

    setupInteractionSystem() {
        this.interactionSystem = new InteractionSystem(
            this.scene,
            this.camera,
            this.renderer,
            this.parkingService,
            this.modelBuilder
        );
    }

    setupEventBindings() {
        window.toggleFault = (spaceId) => {
            this.parkingService.toggleFault(spaceId);
        };

        garageManager.onSpaceStatusChange = (space) => {
            if (this.modelBuilder) {
                this.modelBuilder.updateSpaceColor(space);
            }
        };

        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    async initializeData() {
        garageManager.updateStatsUI();
        garageManager.updateSpaceListUI();
        recordManager.updateUI();

        await this.parkingService.initializeDemoVehicles();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        const delta = this.clock.getDelta();

        if (this.interactionSystem) {
            this.interactionSystem.update();
        }

        if (animationController) {
            animationController.update();
        }

        this.updateDecorativeLights();

        this.renderer.render(this.scene, this.camera);
    }

    updateDecorativeLights() {
        const time = Date.now() * 0.001;
        this.scene.children.forEach(child => {
            if (child.isPointLight) {
                child.intensity = 0.3 + Math.sin(time * 2 + child.position.x) * 0.1;
            }
        });
    }

    cleanup() {
        garageManager.cleanup();
        
        if (this.interactionSystem) {
            this.interactionSystem.dispose();
        }

        if (this.renderer) {
            this.renderer.dispose();
        }

        console.log('系统已清理');
    }
}

let app = null;

document.addEventListener('DOMContentLoaded', () => {
    app = new App();
});

export default App;
