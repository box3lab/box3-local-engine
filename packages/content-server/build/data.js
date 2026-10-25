"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveData = retrieveData;
const semaphore_1 = require("@box/utils/semaphore");
const LOCAL_RUNTIME_REQUEST_CONCURRENCY = 32;
const LOCAL_RUNTIME_REQUEST_TIMEOUT = 31 * 60 * 1000;
const localRuntimeRequests = new semaphore_1.Semaphore(LOCAL_RUNTIME_REQUEST_CONCURRENCY);
function isLocalRuntimeURL(url) {
    return /^(?:https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?)?\/runtime\/(?:edit|play)(?:\/|$)/.test(url);
}
let retrieve;
async function retrieveData(out, url, retryCount = 0, timeout = 0) {
    const count = Math.max(retryCount + 1, 1);
    if (!retrieve) {
        if (typeof XMLHttpRequest !== 'undefined') {
            retrieve = retrieveWithXHR;
        }
        else if (typeof fetch !== 'undefined') {
            retrieve = retrieveWithFetch;
        }
        else {
            return Promise.reject('Cannot request with xhr or fetch.');
        }
    }
    let adjustedTimeout = timeout;
    for (let i = 0; i < count; i++) {
        const limitLocalRuntime = isLocalRuntimeURL(url);
        const requestTimeout = limitLocalRuntime
            ? Math.max(adjustedTimeout, LOCAL_RUNTIME_REQUEST_TIMEOUT)
            : adjustedTimeout;
        if (limitLocalRuntime) {
            await localRuntimeRequests.p();
        }
        try {
            return await retrieve(out, url, requestTimeout);
        }
        catch (err) {
            if (i === count - 1) {
                return Promise.reject(err);
            }
        }
        finally {
            if (limitLocalRuntime) {
                localRuntimeRequests.v();
            }
        }
        adjustedTimeout = timeout << i;
    }
}
async function retrieveWithXHR(out, url, timeout) {
    const xhr = new XMLHttpRequest();
    xhr.open('get', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.timeout = timeout;
    out.abort = () => xhr.abort();
    const promise = new Promise((resolve, reject) => {
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 && xhr.response) {
                    resolve(new Uint8Array(xhr.response));
                    return;
                }
                reject(`failed to retrieve resources: ${url}. with code ${xhr.status}.  ${xhr.statusText}`);
            }
        };
        xhr.ontimeout = () => {
            reject(`failed to retrieve resources: ${url}.  timeout`);
        };
        xhr.onerror = () => {
            reject(`failed to retrieve resources: ${url}.  unspecified error`);
        };
        xhr.send();
    });
    try {
        const data = await promise;
        out.data = data;
        out.loaded = true;
    }
    catch (err) {
        out.error = true;
        return Promise.reject(err);
    }
}
async function retrieveWithFetch(out, url, timeout) {
    let signal;
    if (typeof AbortController !== 'undefined') {
        const controller = new AbortController();
        signal = controller.signal;
        if (timeout > 0) {
            setTimeout(() => {
                controller.abort(`Abort by timeout: ${timeout}`);
            }, timeout);
        }
        out.abort = () => {
            controller.abort('Abort manually.');
        };
    }
    try {
        const response = await fetch(url, { signal });
        const buffer = await response.arrayBuffer();
        out.data = new Uint8Array(buffer);
        out.loaded = true;
    }
    catch (err) {
        out.error = true;
        return Promise.reject(err);
    }
}
