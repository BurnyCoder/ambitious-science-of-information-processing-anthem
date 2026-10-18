/**
 * Remotion CLI configuration (applies to `npx remotion studio|render|still`).
 * Local: render settings for the anthem video.
 * Global: anthem/render.py calls the CLI, which reads this file; Three.js scenes need the ANGLE GL backend.
 * Sources: https://www.remotion.dev/docs/config , https://www.remotion.dev/docs/three (use 'angle' for WebGL)
 */
import {Config} from '@remotion/cli/config'; // official config entry point

Config.setChromiumOpenGlRenderer('angle'); // WebGL (Three.js) does not render with the default GL backend
Config.setVideoImageFormat('jpeg'); // JPEG frames are faster to capture than PNG; no alpha needed
Config.setJpegQuality(92); // high quality intermediate frames to limit banding in dark gradients
Config.setOverwriteOutput(true); // re-renders replace out/anthem.mp4
Config.setCrf(18); // H.264 quality: visually near-lossless for neon on black
