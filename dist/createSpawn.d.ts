/// <reference types="node" />
import { type Throttle } from './types';
export declare const createSpawn: (taskId: string, { cwd, abortSignal, throttleOutput, triggerName }?: {
    abortSignal?: AbortSignal | undefined;
    cwd?: string | undefined;
    throttleOutput?: Throttle | undefined;
    triggerName?: string | undefined;
}) => (pieces: TemplateStringsArray, ...args: any[]) => Promise<import("zx").ProcessOutput>;
//# sourceMappingURL=createSpawn.d.ts.map