/**
 * Remotion entry point.
 * Local: registers the root component that declares all compositions.
 * Global: `remotion render src/index.ts Anthem ...` starts here. Source: https://www.remotion.dev/docs/register-root
 */
import {registerRoot} from 'remotion'; // tells the bundler which component lists the compositions
import {RemotionRoot} from './Root'; // our composition list

registerRoot(RemotionRoot); // one call per project
