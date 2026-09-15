import * as THREE from 'three';
import { CLASS_STYLE, TRACK_COLOR, BACKGROUND } from '../config/theme';
import type { CarClass } from '../types';
import type { HotCar, RenderCar, TrackModel } from '../track/trackModel';
import type { Track } from '../track/generateTrack';
import { pitBoxes, pitLanePoints } from '../track/layout';
import { Projector } from './projection';
import type { TrackRendererContract } from './broadcastTrackRenderer';
import { buildF1Car } from './f1Car3d';
import { racingLineDrawProgress } from './idleCreep';
import {
  boundsOf, carPose, chaseCamera, chaseSubject, openRibbonPositions,
  ribbonHalfWidth, ribbonPositions, toWorld,
} from './circuit3d';

const STOPPED = new Set(['error', 'limit']);

export class Circuit3DRenderer implements TrackRendererContract {
  private static supported: boolean | undefined;

  static isSupported(): boolean {
    if (this.supported !== undefined) return this.supported;
    try {
      const canvas = document.createElement('canvas');
      this.supported = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      this.supported = false;
    }
    return this.supported;
  }

  private readonly feed: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 2, 8000);
  private readonly projector = new Projector();
  private readonly cars = new Map<string, THREE.Group>();
  private readonly bounds;
  private selectHandler: ((carId: string) => void) | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private camPos = new THREE.Vector3(0, 20, 40);
  private camLook = new THREE.Vector3(0, 0, 0);
  private selected: string | null = null;
  private snapped = false;

  constructor(
    host: HTMLElement,
    private readonly track: Track,
  ) {
    this.bounds = boundsOf(track.points);
    this.feed = document.createElement('div');
    this.feed.className = 'broadcast-feed';
    const kicker = document.createElement('div');
    kicker.className = 'chrome-kicker';
    kicker.textContent = 'ONBOARD';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'track-3d';
    this.feed.append(kicker, this.canvas);
    host.appendChild(this.feed);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(BACKGROUND);
    this.scene.fog = new THREE.Fog(BACKGROUND, Math.max(90, this.bounds.span * 0.12), this.bounds.span * 1.4);
    this.scene.add(new THREE.HemisphereLight(0xd7e8f6, 0x141b24, 0.55));
    const sun = new THREE.DirectionalLight(0xffe6c8, 2.2);
    sun.position.set(this.bounds.span * 0.45, this.bounds.span * 0.9, this.bounds.span * 0.25);
    this.scene.add(sun);

    const ribbon = new THREE.BufferGeometry();
    ribbon.setAttribute('position', new THREE.BufferAttribute(ribbonPositions(track), 3));
    ribbon.computeVertexNormals();
    const road = new THREE.Mesh(
      ribbon,
      new THREE.MeshStandardMaterial({
        color: TRACK_COLOR.centerline,
        roughness: 0.78,
        metalness: 0.04,
        side: THREE.DoubleSide,
      }),
    );
    road.position.y = 1.2;
    this.scene.add(road);

    const pitGeo = new THREE.BufferGeometry();
    pitGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(openRibbonPositions(pitLanePoints(track, 8), this.bounds, 6), 3),
    );
    pitGeo.computeVertexNormals();
    const pit = new THREE.Mesh(
      pitGeo,
      new THREE.MeshStandardMaterial({
        color: TRACK_COLOR.pitLane,
        roughness: 0.86,
        metalness: 0.02,
        side: THREE.DoubleSide,
      }),
    );
    pit.position.y = 1.15;
    this.scene.add(pit);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(this.bounds.span * 1.1, 48),
      new THREE.MeshStandardMaterial({ color: 0x0c1118, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.8;
    this.scene.add(ground);

    const start = toWorld(track.points[0]!, this.bounds);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(ribbonHalfWidth() * 2, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: TRACK_COLOR.markerLight }),
    );
    stripe.position.set(start.x, 0.4, start.z);
    this.scene.add(stripe);

    const boot = chaseCamera(carPose(track, 0, 'P', 0), this.bounds.span);
    this.camPos.set(boot.position.x, boot.position.y, boot.position.z);
    this.camLook.set(boot.lookAt.x, boot.lookAt.y, boot.lookAt.z);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.resize();
    this.canvas.addEventListener('pointerdown', this.onPointer);
    window.addEventListener('resize', this.resize);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointer);
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.feed.remove();
  }

  onSelect(handler: (carId: string) => void): void {
    this.selectHandler = handler;
  }

  render(model: TrackModel, now: number, selected: string | null = null): void {
    this.selected = selected;
    this.resize();
    const visible = new Set<string>();
    const stopped = model.hot.filter((car) => STOPPED.has(car.reason));
    const boxes = pitBoxes(this.track, Math.max(2, stopped.length));
    let pit = 0;
    const place = (car: RenderCar | HotCar, progress: number, pitIndex: number | null): void => {
      visible.add(car.carId);
      const mesh = this.ensure(car.carId, car.carClass);
      const pose = pitIndex !== null
        ? { ...toWorld(boxes[pitIndex]!, this.bounds), yaw: 0 }
        : carPose(this.track, progress, car.carClass, car.laneLine);
      mesh.position.set(pose.x, pose.y + 1.2, pose.z);
      mesh.rotation.y = pose.yaw;
      mesh.scale.setScalar(car.carId === selected ? 4.2 : 3.4);
      mesh.visible = true;
      const idle = 'idle' in car && car.idle;
      mesh.traverse((node) => {
        if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) {
          node.material.opacity = idle ? 0.4 : 1;
          node.material.transparent = idle;
        }
      });
    };
    for (const car of model.hot) {
      if (STOPPED.has(car.reason)) {
        this.projector.hold(car.carId, now);
        place(car, car.progress, pit);
        pit += 1;
      } else {
        place(car, racingLineDrawProgress(car, this.projector.step(car.carId, car.progress, now), now), null);
      }
    }
    for (const car of model.cold) {
      place(car, racingLineDrawProgress(car, this.projector.step(car.carId, car.progress, now), now), null);
    }
    for (const [id, mesh] of this.cars) {
      if (!visible.has(id)) mesh.visible = false;
    }
    this.projector.sweep(now);
    this.updateCamera(model, selected);
    this.renderer.render(this.scene, this.camera);
  }

  visualProgressOf(carId: string): number | undefined {
    return this.projector.visual(carId);
  }

  get nodeCount(): number {
    return this.cars.size;
  }

  private ensure(carId: string, carClass: CarClass): THREE.Group {
    let mesh = this.cars.get(carId);
    if (!mesh) {
      mesh = buildF1Car(CLASS_STYLE[carClass].color);
      this.scene.add(mesh);
      this.cars.set(carId, mesh);
    }
    mesh.userData['carId'] = carId;
    return mesh;
  }

  private updateCamera(model: TrackModel, selected: string | null): void {
    const start = chaseCamera(carPose(this.track, 0, 'P', 0), this.bounds.span);
    let targetPos = new THREE.Vector3(start.position.x, start.position.y, start.position.z);
    let targetLook = new THREE.Vector3(start.lookAt.x, start.lookAt.y, start.lookAt.z);
    const subjectId = chaseSubject(model, selected);
    const car = subjectId
      ? model.hot.find((c) => c.carId === subjectId)
        ?? model.cold.find((c) => c.carId === subjectId)
      : undefined;
    if (car) {
      const progress = this.projector.visual(car.carId) ?? car.progress;
      const pose = carPose(this.track, progress, car.carClass, car.laneLine);
      const chase = chaseCamera(pose, this.bounds.span);
      targetPos.set(chase.position.x, chase.position.y, chase.position.z);
      targetLook.set(chase.lookAt.x, chase.lookAt.y, chase.lookAt.z);
    }
    const mix = this.snapped ? 0.14 : 1;
    this.camPos.lerp(targetPos, mix);
    this.camLook.lerp(targetLook, mix);
    this.snapped = true;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private resize = (): void => {
    const host = this.canvas.parentElement;
    if (!host) return;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private onPointer = (event: PointerEvent): void => {
    if (!this.selectHandler) return;
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects([...this.cars.values()], true);
    const hit = hits[0];
    if (!hit) return;
    let obj: THREE.Object3D | null = hit.object;
    while (obj && !obj.userData['carId']) obj = obj.parent;
    const id = obj?.userData['carId'];
    if (typeof id === 'string') this.selectHandler(id);
  };
}


