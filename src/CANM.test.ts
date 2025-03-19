import { canm_to_js, js_canm_to_bytes, track_selections } from "./CANM";
import { test } from "vitest";
import * as fs from 'fs';

test("print test", async () => {
    const path = 'RedBlueExStartScenario1.canm'; // Replace with your own sample data.
    const data = new Uint8Array(fs.readFileSync(path));
    const camn = canm_to_js(data);
    const buffer = js_canm_to_bytes(camn)
    console.log(buffer.byteLength)
    console.log(track_selections())
})