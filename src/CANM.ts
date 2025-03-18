import { rust } from "./rustlib";

export class Track {
    values: rust.Frame[];
    usesinglescope: boolean;
}

export class CAMN {
    header: rust.CANMHeader;
    tracks: Record<rust.TrackSelection, [Track]>;
    isfullframes: boolean;
}

export function camn_to_js(data: Uint8Array) : CAMN {
    return rust.canm_to_js(data);
}