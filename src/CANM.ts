import { rust } from "./rustlib";

export class Track {
    values: rust.Frame[];
    usesinglescope: boolean;
}

export class CAMN {
    header: rust.CANMHeader;
    tracks: Map<string, [Track]>;
    isfullframes: boolean;
}

export function canm_to_js(data: Uint8Array) : CAMN {
    return rust.canm_to_js(data);
}

export function js_canm_to_bytes(data: CAMN) : Uint8Array {
    return rust.js_canm_to_bytes(data)
}

export function track_selections() : string[] {
    return Object.values(rust.TrackSelection).filter((x) => typeof x === 'string')
}