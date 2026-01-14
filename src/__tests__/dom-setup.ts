import { Window } from "happy-dom";

const window = new Window();
// @ts-ignore
globalThis.document = window.document;
// @ts-ignore
globalThis.window = window;
