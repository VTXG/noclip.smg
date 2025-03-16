import { GXTextureHolder } from '../gx/gx_render.js';

import * as TPL from './tpl.js';
import { GfxDevice } from '../gfx/platform/GfxPlatform.js';

export class TPLTextureHolder extends GXTextureHolder<TPL.TPLTexture> {
    public addTPLTextures(device: GfxDevice, tpl: TPL.TPL): void {
        this.addTextures(device, tpl.textures);
    }
}