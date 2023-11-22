"use strict";
// cspell:words nothrow
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSpawn = void 0;
const errors_1 = require("./errors");
const findNearestDirectory_1 = require("./findNearestDirectory");
const killPsTree_1 = require("./killPsTree");
const Logger_1 = require("./Logger");
const chalk_1 = __importDefault(require("chalk"));
const randomcolor_1 = __importDefault(require("randomcolor"));
const throttle_debounce_1 = require("throttle-debounce");
const zx_1 = require("zx");
const log = Logger_1.Logger.child({
    namespace: 'createSpawn',
});
const prefixLines = (subject, prefix) => {
    const response = [];
    for (const fragment of subject.split('\n')) {
        response.push(prefix + fragment);
    }
    return response.join('\n');
};
const createSpawn = (taskId, { cwd = process.cwd(), abortSignal, throttleOutput, triggerName, triggerHexColor, } = {}) => {
    let stdoutBuffer = [];
    let stderrBuffer = [];
    const flush = () => {
        if (stdoutBuffer.length) {
            // eslint-disable-next-line no-console
            console.log(stdoutBuffer.join('\n'));
        }
        if (stderrBuffer.length) {
            // eslint-disable-next-line no-console
            console.error(stderrBuffer.join('\n'));
        }
        stdoutBuffer = [];
        stderrBuffer = [];
    };
    const output = (0, throttle_debounce_1.throttle)(throttleOutput === null || throttleOutput === void 0 ? void 0 : throttleOutput.delay, () => {
        flush();
    }, {
        noLeading: true,
    });
    const colorText = chalk_1.default.hex(triggerHexColor || (0, randomcolor_1.default)({ luminosity: 'dark' }));
    return async (pieces, ...args) => {
        const binPath = (await (0, findNearestDirectory_1.findNearestDirectory)('node_modules', cwd)) + '/.bin';
        zx_1.$.cwd = cwd;
        zx_1.$.prefix = `set -euo pipefail; export PATH="${binPath}:$PATH";`;
        let onStdout;
        let onStderr;
        const formatChunk = (chunk) => {
            const prefixTriggerName = triggerName ? triggerName + ' ' : '';
            return prefixLines(chunk.toString().trimEnd(), colorText(`${prefixTriggerName}${taskId}`) + ' > ');
        };
        if (throttleOutput === null || throttleOutput === void 0 ? void 0 : throttleOutput.delay) {
            onStdout = (chunk) => {
                stdoutBuffer.push(formatChunk(chunk));
                output();
            };
            onStderr = (chunk) => {
                stderrBuffer.push(formatChunk(chunk));
                output();
            };
        }
        else {
            onStdout = (chunk) => {
                // eslint-disable-next-line no-console
                console.log(formatChunk(chunk));
            };
            onStderr = (chunk) => {
                // eslint-disable-next-line no-console
                console.error(formatChunk(chunk));
            };
        }
        if (abortSignal === null || abortSignal === void 0 ? void 0 : abortSignal.aborted) {
            throw new errors_1.UnexpectedError('Attempted to spawn a process after the task was aborted.');
        }
        // eslint-disable-next-line promise/prefer-await-to-then
        const processPromise = (0, zx_1.$)(pieces, ...args)
            .nothrow()
            .quiet();
        processPromise.stdout.on('data', onStdout);
        processPromise.stderr.on('data', onStderr);
        if (abortSignal) {
            const kill = () => {
                var _a;
                const pid = (_a = processPromise.child) === null || _a === void 0 ? void 0 : _a.pid;
                if (!pid) {
                    log.warn('no process to kill');
                    return;
                }
                // TODO make this configurable
                // eslint-disable-next-line promise/prefer-await-to-then
                (0, killPsTree_1.killPsTree)(pid, 5000).then(() => {
                    log.debug('task %s was killed', taskId);
                    processPromise.stdout.off('data', onStdout);
                    processPromise.stderr.off('data', onStderr);
                });
            };
            abortSignal.addEventListener('abort', kill, {
                once: true,
            });
            // eslint-disable-next-line promise/prefer-await-to-then
            processPromise.finally(() => {
                abortSignal.removeEventListener('abort', kill);
            });
        }
        const result = await processPromise;
        flush();
        if (result.exitCode === 0) {
            return result;
        }
        if (abortSignal === null || abortSignal === void 0 ? void 0 : abortSignal.aborted) {
            throw new errors_1.AbortError('Program was aborted.');
        }
        log.error('task %s exited with an error', taskId);
        throw new Error('Program exited with code ' + result.exitCode + '.');
    };
};
exports.createSpawn = createSpawn;
//# sourceMappingURL=createSpawn.js.map