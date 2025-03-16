import * as RARC from '../Common/JSYSTEM/JKRArchive.js';
import { J3DModelInstanceSimple } from "../Common/JSYSTEM/J3D/J3DGraphSimple";
import { TTK1, TRK1, ANK1, AnimationBase, BCK, BTK, BRK } from "../Common/JSYSTEM/J3D/J3DLoader";

export class AnimationEntry {
    public animation: AnimationBase;
    public name: string;
    public type: string;

    constructor(file: RARC.RARCFile) {
        this.name = file.name;
        this.type = file.name.slice(-3);

        switch (this.type) {
            case "btk": this.animation = BTK.parse(file.buffer); break;
            case "brk": this.animation = BRK.parse(file.buffer); break;
            case "bck": this.animation = BCK.parse(file.buffer); break;
            default: throw new Error("Invalid type.");
        }
    }

    public bindAnim(model: J3DModelInstanceSimple): void {
        switch (this.type) {
            case "btk": model.bindTTK1(this.animation as TTK1); break;
            case "brk": model.bindTRK1(this.animation as TRK1); break;
            case "bck": model.bindANK1(this.animation as ANK1); break;
            default: throw new Error("Invalid type.");
        }
    }

    public clearAnim(model: J3DModelInstanceSimple): void {
        switch (this.type) {
            case "btk": model.bindTTK1(null); break;
            case "brk": model.bindTRK1(null); break;
            case "bck": model.bindANK1(null); break;
            default: throw new Error("Invalid type.");
        }
    }
}