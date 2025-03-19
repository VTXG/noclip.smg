/*
import { canm_to_js, js_canm_to_bytes, get_track_selections, studio_track_to_track } from "./CANM";
import { test } from "vitest";
import * as Studio from "./Studio";
import * as fs from 'fs';

test("print test", async () => {
    const path = 'RedBlueExStartScenario1.canm'; // Replace with your own sample data.
    const data = new Uint8Array(fs.readFileSync(path));
    const camn = canm_to_js(data);
    console.log(camn);
    const buffer = js_canm_to_bytes(camn)
    console.log(buffer.byteLength)
    console.log(get_track_selections())
    const kf: Studio.Keyframe = {time: 0, value: 0, tangentIn: 0, tangentOut: 0,
        interpInType: 0, interpOutType: 0, easeInCoeff: 0, easeOutCoeff: 0};
    const frame = studio_track_to_track([kf])
    console.log(frame)
})
*/