/**
 * Small Three.js building blocks shared by the 3D scenes.
 * Local: a full-frame transparent <ThreeCanvas>, a camera rig driven by the frame clock,
 * and glowing point/line clouds whose geometry is rebuilt from plain arrays each frame.
 * Global: LayersScene, LandscapeScene and ManifoldsScene compose these so each scene only
 * computes positions/colors as pure functions of time.
 * Sources: https://www.remotion.dev/docs/three-canvas (width/height required, no useFrame),
 *          https://threejs.org/docs/#api/en/core/BufferGeometry , https://threejs.org/docs/#api/en/materials/PointsMaterial ,
 *          https://r3f.docs.pmnd.rs/api/hooks#usethree
 */
import React, {useEffect, useMemo} from 'react'; // JSX + lifecycle
import {ThreeCanvas} from '@remotion/three'; // Remotion-aware R3F canvas
import {useThree} from '@react-three/fiber'; // access to the camera
import {useVideoConfig} from 'remotion'; // frame size
import * as THREE from 'three'; // geometry/material classes

/** Local: transparent full-frame 3D canvas. Global: 3D scenes sit on top of the shared starfield. */
export const Stage: React.FC<{children: React.ReactNode; fov?: number}> = ({children, fov = 55}) => {
	const {width, height} = useVideoConfig(); // required by ThreeCanvas
	return (
		<ThreeCanvas width={width} height={height} camera={{fov, near: 0.1, far: 500, position: [0, 0, 10]}}
			gl={{alpha: true, antialias: true}} style={{position: 'absolute', inset: 0}}>
			{children}
		</ThreeCanvas>
	);
};

/** Local: place the camera and aim it, every render. Global: frame-driven camera moves (scrubbable, deterministic). */
export const CameraRig: React.FC<{position: [number, number, number]; target: [number, number, number]}> = ({position, target}) => {
	const camera = useThree((s) => s.camera); // the canvas' default camera
	camera.position.set(...position); // set before R3F draws this frame
	camera.lookAt(...target); // orientation from target
	camera.updateProjectionMatrix(); // apply fov/aspect changes if any
	return null; // renders nothing itself
};

let dotTexture: THREE.Texture | null = null; // cached round sprite, created on first use
const getDot = (): THREE.Texture => {
	if (dotTexture) return dotTexture; // reuse
	const c = document.createElement('canvas'); // 64x64 offscreen canvas
	c.width = c.height = 64;
	const g = c.getContext('2d')!; // 2D context
	const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32); // soft radial falloff = glow
	grad.addColorStop(0, 'rgba(255,255,255,1)');
	grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
	grad.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = grad;
	g.fillRect(0, 0, 64, 64);
	dotTexture = new THREE.CanvasTexture(c); // GPU texture from the canvas
	return dotTexture;
};

/** Local: build a BufferGeometry from flat position/color arrays and dispose the previous one. */
const useGeometry = (positions: Float32Array, colors: Float32Array) => {
	const geom = useMemo(() => {
		const g = new THREE.BufferGeometry(); // fresh geometry for this frame's arrays
		g.setAttribute('position', new THREE.BufferAttribute(positions, 3)); // xyz per vertex
		g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); // rgb per vertex
		return g;
	}, [positions, colors]);
	useEffect(() => () => geom.dispose(), [geom]); // free GPU buffers when replaced
	return geom;
};

/** Local: additive glowing points. Global: neurons, SGD particles, manifold samples. */
export const GlowPoints: React.FC<{positions: Float32Array; colors: Float32Array; size?: number; opacity?: number}> = ({positions, colors, size = 0.35, opacity = 1}) => {
	const geom = useGeometry(positions, colors); // per-frame geometry
	return (
		<points geometry={geom}>
			<pointsMaterial size={size} map={getDot()} vertexColors transparent opacity={opacity} depthWrite={false}
				blending={THREE.AdditiveBlending} sizeAttenuation />
		</points>
	);
};

/** Local: additive line segments (pairs of vertices). Global: weights between layers, trails, arrows. */
export const GlowLines: React.FC<{positions: Float32Array; colors: Float32Array; opacity?: number}> = ({positions, colors, opacity = 0.5}) => {
	const geom = useGeometry(positions, colors); // per-frame geometry
	return (
		<lineSegments geometry={geom}>
			<lineBasicMaterial vertexColors transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
		</lineSegments>
	);
};

/** Local: '#rrggbb' -> [r,g,b] in 0..1 scaled by intensity. Global: color math for vertex colors. */
export const rgb = (hex: string, k = 1): [number, number, number] => {
	const c = new THREE.Color(hex); // parses CSS hex
	return [c.r * k, c.g * k, c.b * k]; // scaled (additive blending: brightness)
};
