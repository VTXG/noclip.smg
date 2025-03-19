import { rust } from "./rustlib";
import * as Studio from "./Studio";

export class Track {
    values: rust.Frame[];
    usesinglescope: boolean;
}

export class CANM {
    header: rust.CANMHeader;
    tracks: Map<string, Track>;
    isfullframes: boolean;
}

export function canm_to_js(data: Uint8Array): CANM {
    return rust.canm_to_js(data);
}

export function js_canm_to_bytes(data: CANM): Uint8Array {
    return rust.js_canm_to_bytes(data)
}

export function get_track_selections(): string[] {
    return Object.values(rust.TrackSelection).filter((x) => typeof x === 'string')
}

export function studio_track_to_track(keyframes: Studio.Keyframe[]): Track {
    const track = new Track();
    track.values = [];

    for (let i = 0; i < keyframes.length; i++) {
        const keyframe = keyframes[i];
        const frame = new rust.Frame();
        
        frame.frameid = keyframe.time;
        frame.value = keyframe.value;
        frame.inslope = keyframe.tangentIn;
        frame.outslope = keyframe.tangentOut;

        track.values.push(frame);
    }

    return track;
}