import ArrayBufferSlice from "../ArrayBufferSlice";
import { readString } from "../util";

class DataViewReader extends DataView<ArrayBufferLike> {
    private position: number;
    constructor(buffer: ArrayBufferLike, byteOffset?: number, byteLength?: number) {
        super(buffer, byteOffset, byteLength)
        this.position = byteOffset ?? 0;
    }
    static viewFromArrayBufferSlice(buffer: ArrayBufferSlice, offs?: number, length?: number) : DataViewReader {
        return new DataViewReader(buffer.arrayBuffer, offs, length)
    }
    override getInt32(byteOffset = this.position, littleEndian?: boolean) : number {
        const result = super.getInt32(byteOffset, littleEndian)
        this.position += 4;
        return result;
    }
    override getFloat32(byteOffset = this.position, littleEndian?: boolean): number {
        const result = super.getFloat32(byteOffset, littleEndian)
        this.position += 4;
        return result;
    }
    getPosition() : number {
        return this.position;
    }
    setPosition(position: number) {
        this.position = position;
    }
}

export enum FrameType {
    CANM = 'CANM',
    CKAN = 'CKAN'
}

export class CANMHeader {
    magic: string;
    frame_type: FrameType;
    unk1 : number;
    unk2 : number;
    unk3 : number;
    unk4 : number;
    frame_count : number;
    offset : number
    constructor() {
        this.magic = 'ANDO'
        this.frame_type = FrameType.CANM
        this.unk1 = 0
        this.unk2 = 0
        this.unk3 = 0
        this.unk4 = 0
        this.frame_count = 0
        this.offset = 0
    }
    static load(buffer: ArrayBufferSlice) : {header: CANMHeader, pos: number} {
        let result = new CANMHeader();
        const view = DataViewReader.viewFromArrayBufferSlice(buffer);
        view.setPosition(8)
        result.magic = readString(buffer, 0, 4);
        const magic = readString(buffer, 4, 4);
        switch (magic) {
            case 'CANM':
                result.frame_type = FrameType.CANM;
                break;
            case 'CKAN':
                result.frame_type = FrameType.CKAN;
                break;
            default:
                break;
        }
        result.unk1 = view.getInt32();
        result.unk2 = view.getInt32();
        result.unk3 = view.getInt32();
        result.unk4 = view.getInt32();
        result.frame_count = view.getInt32();
        result.offset = view.getInt32();
        return {header: result, pos: view.getPosition()};
    }
}

export enum TrackSelection {
    PositionX,
    PositionY,
    PositionZ,
    TargetX,
    TargetY,
    TargetZ,
    Roll,
    FieldOfView
}

const Tracks = [TrackSelection.PositionX, TrackSelection.PositionY, TrackSelection.PositionZ, 
    TrackSelection.TargetX, TrackSelection.TargetY, TrackSelection.TargetZ, TrackSelection.Roll,
    TrackSelection.FieldOfView]

export class Frame {
    frameid: number;
    value: number;
    inslope: number;
    outslope: number;
    constructor() {
        this.frameid = 0.0;
        this.value = 0.0;
        this.inslope = 0.0;
        this.outslope = 0.0
    }
}

export class Track extends Array<Frame> {
    usesingleslope: boolean;
    constructor(count: number = 0) {
        super(count)
        this.usesingleslope = false;
    }
    static load(view: DataViewReader, offset: number, iscanm: boolean) : {result: Track, pos: number} {
        const filecount = view.getInt32();
        const start = view.getInt32();
        let result = new Track();
        if (!iscanm) {
            result.usesingleslope = view.getInt32() === 0;
        }
        const new_pos = view.getPosition();
        view.setPosition(offset + 0x04 + (0x04 * start));
        for (let i = 0; i < filecount; i++) {
            let frame = new Frame();
            if (filecount === 1) {
                frame.value = view.getFloat32();
                result.push(frame);
                continue;
            }
            if (iscanm) {
                frame.frameid = i;
                frame.value = view.getFloat32();
            } else {
                frame.frameid = view.getFloat32();
                frame.value = view.getFloat32();
                frame.inslope = view.getFloat32();
                if (!result.usesingleslope) {
                    frame.outslope = view.getFloat32();
                }
            }
            result.push(frame)
        }
        return {result, pos: new_pos}
    }
}

export class CANM {
    header: CANMHeader;
    tracks: Map<TrackSelection, Track>;
    isfullframes: boolean;
    constructor() {
        this.header = new CANMHeader();
        this.tracks = new Map<TrackSelection, Track>();
        this.isfullframes = false;
    }
    static load(buffer: ArrayBufferSlice) : CANM {
        let result = new CANM();
        const info = CANMHeader.load(buffer);
        result.header = info.header
        let view = DataViewReader.viewFromArrayBufferSlice(buffer);
        view.setPosition(info.pos);
        result.isfullframes = result.header.frame_type === FrameType.CANM;
        const offset = result.header.offset;
        for (let i = 0; i < Tracks.length; i++) {
            const track = Tracks[i];
            const dict = Track.load(view, 0x20 + offset, result.isfullframes)
            view.setPosition(dict.pos);
            result.tracks.set(track, dict.result)
        }
        return result;
    }
}