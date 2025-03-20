import { rust } from "./rustlib";
import * as Studio from "./Studio";

export class Track {
    values: rust.Frame[];
    usesinglescope: boolean;
    constructor(usesinglescope: boolean = true) {
        this.values = []
        this.usesinglescope = usesinglescope
    }
}

export class CANMHeader {
    frame_count: number;
    frame_type: string;
    magic: string;
    offset: number;
    unk1: number;
    unk2: number;
    unk3: number;
    unk4: number;
    constructor(frame_type : rust.FrameType = rust.FrameType.CANM) {
        this.magic = 'ANDO'
        if (frame_type === rust.FrameType.CANM) {
            this.frame_type = 'CANM'
        } else if (frame_type === rust.FrameType.CKAN) {
            this.frame_type = 'CKAN'
        }
        this.unk1 = 0;
        this.unk2 = 0
        this.unk3 = 0;
        this.unk4 = 0;
        this.frame_count = 0;
        this.offset = 0;
    }
}

export class CANM {
    header: CANMHeader;
    tracks: Map<string, Track[]>;
    isfullframes: boolean;
    constructor(frame_type = rust.FrameType.CANM, isfullframes: boolean = false) {
        this.header = new CANMHeader(frame_type);
        this.tracks = new Map<string, Track[]>();
        this.isfullframes = isfullframes
    }
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

export function studio_track_to_track(keyframes: Studio.Keyframe[], usesinglescope: boolean = true): Track {
    const track = new Track();
    track.values = [];
    track.usesinglescope = usesinglescope;

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