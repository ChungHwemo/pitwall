import * as THREE from 'three';

/** 절차적 F1: 노즈·앞날개·뒷날개·오픈휠. 박스카가 아니다. */
export function buildF1Car(color: string): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.22 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.45, metalness: 0.2 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.92 });
  const wing = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.18 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 9.2), bodyMat);
  chassis.position.set(0, 1.15, 0);
  chassis.name = 'chassis';

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 5.2), bodyMat);
  nose.position.set(0, 0.85, 6.4);
  nose.name = 'nose';

  const frontWing = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.18, 1.5), wing);
  frontWing.position.set(0, 0.42, 8.8);
  frontWing.name = 'frontWing';

  const rearWing = new THREE.Group();
  rearWing.name = 'rearWing';
  const plane = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.16, 1.3), wing);
  plane.position.set(0, 2.7, -5.6);
  const plateL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 1.4), dark);
  plateL.position.set(-3.6, 2.1, -5.6);
  const plateR = plateL.clone();
  plateR.position.x = 3.6;
  rearWing.add(plane, plateL, plateR);

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 2.4), dark);
  cockpit.position.set(0, 1.7, -0.4);

  const engine = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 3.4), bodyMat);
  engine.position.set(0, 1.45, -3.2);

  const wheels = new THREE.Group();
  wheels.name = 'wheels';
  const wheelGeo = new THREE.CylinderGeometry(1.15, 1.15, 1.35, 12);
  const spots: Array<[number, number, number]> = [
    [-2.7, 1.15, 5.4], [2.7, 1.15, 5.4], [-2.9, 1.15, -4.8], [2.9, 1.15, -4.8],
  ];
  for (const [x, y, z] of spots) {
    const w = new THREE.Mesh(wheelGeo, tire);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    wheels.add(w);
  }

  g.add(chassis, nose, frontWing, rearWing, cockpit, engine, wheels);
  return g;
}
