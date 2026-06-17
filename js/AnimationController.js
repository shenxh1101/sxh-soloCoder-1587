import * as THREE from 'three';
import { CONFIG } from './config.js';

class AnimationController {
    constructor() {
        this.isAnimating = false;
        this.queue = [];
        this.clock = new THREE.Clock();
        this.animations = [];
    }

    update() {
        const delta = this.clock.getDelta();
        
        for (let i = this.animations.length - 1; i >= 0; i--) {
            const anim = this.animations[i];
            anim.elapsed += delta;
            const progress = Math.min(anim.elapsed / anim.duration, 1);
            const easedProgress = this.easeInOutCubic(progress);

            if (anim.type === 'move') {
                anim.object.position.lerpVectors(anim.start, anim.end, easedProgress);
            } else if (anim.type === 'property') {
                const currentValue = anim.startValue + (anim.endValue - anim.startValue) * easedProgress;
                anim.property.currentValue = currentValue;
            }

            if (progress >= 1) {
                this.animations.splice(i, 1);
                if (anim.onComplete) {
                    anim.onComplete();
                }
            }
        }

        if (this.animations.length === 0 && this.isAnimating) {
            this.isAnimating = false;
            if (this.onAllComplete) {
                this.onAllComplete();
                this.onAllComplete = null;
            }
        }
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    animateMove(object, targetPosition, duration, onComplete) {
        const start = object.position.clone();
        const end = new THREE.Vector3(
            targetPosition.x !== undefined ? targetPosition.x : object.position.x,
            targetPosition.y !== undefined ? targetPosition.y : object.position.y,
            targetPosition.z !== undefined ? targetPosition.z : object.position.z
        );

        const distance = start.distanceTo(end);
        const actualDuration = duration || this.calculateDuration(distance);

        this.animations.push({
            type: 'move',
            object,
            start,
            end,
            elapsed: 0,
            duration: actualDuration,
            onComplete
        });

        this.isAnimating = true;
    }

    calculateDuration(distance) {
        const horizontalSpeed = CONFIG.ANIMATION.HORIZONTAL_SPEED;
        return Math.max(distance / horizontalSpeed, 0.5);
    }

    async animateSequence(animations) {
        this.isAnimating = true;
        
        for (const anim of animations) {
            await new Promise((resolve) => {
                if (anim.type === 'move') {
                    this.animateMove(anim.object, anim.target, anim.duration, resolve);
                }
            });
        }

        this.isAnimating = false;
    }

    async parkVehicle(vehicle, startPos, endPos) {
        const path = this.calculateParkPath(startPos, endPos);
        
        for (const step of path) {
            await new Promise((resolve) => {
                this.animateMove(vehicle, step.target, step.duration, resolve);
            });
        }
    }

    async fetchVehicle(vehicle, startPos, endPos) {
        const path = this.calculateFetchPath(startPos, endPos);
        
        for (const step of path) {
            await new Promise((resolve) => {
                this.animateMove(vehicle, step.target, step.duration, resolve);
            });
        }
    }

    calculateParkPath(startPos, endPos) {
        const path = [];
        
        path.push({
            target: { x: 0, y: 0.5, z: -4 },
            duration: 1.5
        });
        
        if (endPos.y > 0.5) {
            path.push({
                target: { x: 0, y: endPos.y + 0.5, z: -4 },
                duration: (endPos.y) / CONFIG.ANIMATION.VERTICAL_SPEED
            });
        }
        
        if (Math.abs(endPos.x) > 0.1) {
            path.push({
                target: { x: endPos.x, y: endPos.y + 0.5, z: -4 },
                duration: Math.abs(endPos.x) / CONFIG.ANIMATION.HORIZONTAL_SPEED
            });
        }
        
        path.push({
            target: { x: endPos.x, y: endPos.y + 0.5, z: endPos.z },
            duration: Math.abs(endPos.z + 4) / CONFIG.ANIMATION.DEPTH_SPEED
        });

        return path;
    }

    calculateFetchPath(startPos, endPos) {
        const path = [];
        
        path.push({
            target: { x: startPos.x, y: startPos.y + 0.5, z: -4 },
            duration: Math.abs(startPos.z + 4) / CONFIG.ANIMATION.DEPTH_SPEED
        });
        
        if (Math.abs(startPos.x) > 0.1) {
            path.push({
                target: { x: 0, y: startPos.y + 0.5, z: -4 },
                duration: Math.abs(startPos.x) / CONFIG.ANIMATION.HORIZONTAL_SPEED
            });
        }
        
        if (startPos.y > 0.5) {
            path.push({
                target: { x: 0, y: 0.5, z: -4 },
                duration: (startPos.y) / CONFIG.ANIMATION.VERTICAL_SPEED
            });
        }
        
        path.push({
            target: { x: endPos.x, y: endPos.y, z: endPos.z },
            duration: 2
        });

        return path;
    }

    isBusy() {
        return this.isAnimating || this.animations.length > 0;
    }

    waitForAll() {
        return new Promise((resolve) => {
            if (!this.isBusy()) {
                resolve();
                return;
            }
            this.onAllComplete = resolve;
        });
    }

    stopAll() {
        this.animations = [];
        this.isAnimating = false;
    }
}

export const animationController = new AnimationController();
export default AnimationController;
