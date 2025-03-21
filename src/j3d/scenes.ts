
import ArrayBufferSlice from '../ArrayBufferSlice.js';
import { readString } from '../util.js';

import * as UI from '../ui.js';
import * as Viewer from '../viewer.js';

import { AnimationEntry } from './anim.js';
import { BMD, BMT, BTK, BRK, BCK } from '../Common/JSYSTEM/J3D/J3DLoader.js';
import * as RARC from '../Common/JSYSTEM/JKRArchive.js';
import { readBTI_Texture } from '../Common/JSYSTEM/JUTTexture.js';
import { J3DModelData, J3DModelMaterialData } from '../Common/JSYSTEM/J3D/J3DGraphBase.js';
import { J3DModelInstanceSimple } from '../Common/JSYSTEM/J3D/J3DGraphSimple.js';
import { makeBackbufferDescSimple, standardFullClearRenderPassDescriptor } from '../gfx/helpers/RenderGraphHelpers.js';
import { GXRenderHelperGfx, fillSceneParamsDataOnTemplate, GXTextureHolder } from '../gx/gx_render.js';
import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import { GXMaterialHacks } from '../gx/gx_material.js';
import { GfxRenderCache } from '../gfx/render/GfxRenderCache.js';
import * as JPAExplorer from '../InteractiveExamples/JPAExplorer.js';
import { SceneContext } from '../SceneBase.js';
import { GfxrAttachmentSlot } from '../gfx/render/GfxRenderGraph.js';
import { GfxRenderInstList } from '../gfx/render/GfxRenderInstManager.js';

export class J3DRenderer implements Viewer.SceneGfx {
    public renderHelper: GXRenderHelperGfx;
    private renderInstListMain = new GfxRenderInstList();
    public modelInstances: J3DModelInstanceSimple[] = [];
    public rarc: RARC.JKRArchive[] = [];
    public textureHolder = new GXTextureHolder();
    public animations: AnimationEntry[] = [];

    constructor(device: GfxDevice) {
        this.renderHelper = new GXRenderHelperGfx(device);
    }

    public createPanels(): UI.Panel[] {
        const renderHacksPanel = new UI.Panel();
        renderHacksPanel.customHeaderBackgroundColor = UI.COOL_BLUE_COLOR;
        renderHacksPanel.setTitle(UI.RENDER_HACKS_ICON, 'Render Hacks');
        
        const enableVertexColorsCheckbox = new UI.Checkbox('Enable Vertex Colors', true);
        enableVertexColorsCheckbox.onchanged = () => {
            for (let i = 0; i < this.modelInstances.length; i++)
                this.modelInstances[i].setVertexColorsEnabled(enableVertexColorsCheckbox.checked);
        };
        renderHacksPanel.contents.appendChild(enableVertexColorsCheckbox.elem);

        const enableTextures = new UI.Checkbox('Enable Textures', true);
        enableTextures.onchanged = () => {
            for (let i = 0; i < this.modelInstances.length; i++)
                this.modelInstances[i].setTexturesEnabled(enableTextures.checked);
        };
        renderHacksPanel.contents.appendChild(enableTextures.elem);

        const isSkyboxCheckbox = new UI.Checkbox('Enable Skybox Behaviour', false);
        isSkyboxCheckbox.onchanged = () => {
            for (let i = 0; i < this.modelInstances.length; i++)
                this.modelInstances[i].isSkybox = isSkyboxCheckbox.checked;
        };
        renderHacksPanel.contents.appendChild(isSkyboxCheckbox.elem);

        const animPanel = new UI.Panel();
        animPanel.customHeaderBackgroundColor = UI.COOL_BLUE_COLOR;
        animPanel.setTitle(UI.CUTSCENE_ICON, 'Animations');

        const animList = new UI.ListContainer();

        for (let i = 0; i < this.animations.length; i++) {
            const anim = this.animations[i];
            const animCheckbox = new UI.Checkbox(anim.name, false);

            animCheckbox.onchanged = () => {
                for (let i = 0; i < this.modelInstances.length; i++)
                    animCheckbox.checked
                    ? anim.bindAnim(this.modelInstances[i])
                    : anim.clearAnim(this.modelInstances[i]);
            }

            animList.contents.appendChild(animCheckbox.elem);
        }

        animPanel.contents.appendChild(animList.elem);

        const layersPanel = new UI.LayerPanel(this.modelInstances);
        return [layersPanel, animPanel, renderHacksPanel];
    }

    public addModelInstance(scene: J3DModelInstanceSimple): void {
        this.modelInstances.push(scene);
    }

    private prepareToRender(device: GfxDevice, viewerInput: Viewer.ViewerRenderInput): void {
        const renderInstManager = this.renderHelper.renderInstManager;

        const template = this.renderHelper.pushTemplateRenderInst();
        fillSceneParamsDataOnTemplate(template, viewerInput);
        renderInstManager.setCurrentList(this.renderInstListMain);
        for (let i = 0; i < this.modelInstances.length; i++)
            this.modelInstances[i].prepareToRender(device, renderInstManager, viewerInput);
        renderInstManager.popTemplate();

        this.renderHelper.prepareToRender();
    }

    public render(device: GfxDevice, viewerInput: Viewer.ViewerRenderInput) {
        const builder = this.renderHelper.renderGraph.newGraphBuilder();

        const mainColorDesc = makeBackbufferDescSimple(GfxrAttachmentSlot.Color0, viewerInput, standardFullClearRenderPassDescriptor);
        const mainDepthDesc = makeBackbufferDescSimple(GfxrAttachmentSlot.DepthStencil, viewerInput, standardFullClearRenderPassDescriptor);

        const mainColorTargetID = builder.createRenderTargetID(mainColorDesc, 'Main Color');
        const mainDepthTargetID = builder.createRenderTargetID(mainDepthDesc, 'Main Depth');
        builder.pushPass((pass) => {
            pass.setDebugName('Main');
            pass.attachRenderTargetID(GfxrAttachmentSlot.Color0, mainColorTargetID);
            pass.attachRenderTargetID(GfxrAttachmentSlot.DepthStencil, mainDepthTargetID);
            pass.exec((passRenderer) => {
                this.renderInstListMain.drawOnPassRenderer(this.renderHelper.renderCache, passRenderer);
            });
        });
        this.renderHelper.antialiasingSupport.pushPasses(builder, viewerInput, mainColorTargetID);
        builder.resolveRenderTargetToExternalTexture(mainColorTargetID, viewerInput.onscreenTexture);

        this.prepareToRender(device, viewerInput);
        this.renderHelper.renderGraph.execute(builder);
        this.renderInstListMain.reset();
    }

    public destroy(device: GfxDevice): void {
        this.renderHelper.destroy();
        for (let i = 0; i < this.modelInstances.length; i++)
            this.modelInstances[i].destroy(device);
    }
}

const materialHacks: GXMaterialHacks = {
    lightingFudge: (p) => `(0.5 * (${p.ambSource} + 0.6) * ${p.matSource})`,
};

export function createModelInstance(device: GfxDevice, cache: GfxRenderCache, bmdFile: RARC.RARCFile, btkFile: RARC.RARCFile | null, brkFile: RARC.RARCFile | null, bckFile: RARC.RARCFile | null, bmtFile: RARC.RARCFile | null) {
    const bmd = BMD.parse(bmdFile.buffer);
    const bmt = bmtFile ? BMT.parse(bmtFile.buffer) : null;
    const bmdModel = new J3DModelData(device, cache, bmd);
    const scene = new J3DModelInstanceSimple(bmdModel, materialHacks);

    if (bmt !== null)
        scene.setModelMaterialDataOwned(new J3DModelMaterialData(device, cache, bmt));

    if (btkFile !== null) {
        const btk = BTK.parse(btkFile.buffer);
        scene.bindTTK1(btk);
    }

    if (brkFile !== null) {
        const brk = BRK.parse(brkFile.buffer);
        scene.bindTRK1(brk);
    }

    if (bckFile !== null) {
        const bck = BCK.parse(bckFile.buffer);
        scene.bindANK1(bck);
    }

    return scene;
}

function createScenesFromBuffer(device: GfxDevice, renderer: J3DRenderer, buffer: ArrayBufferSlice): void {
    if (['RARC', 'CRAR'].includes(readString(buffer, 0x00, 0x04))) {
        const rarc = RARC.parse(buffer);
        renderer.rarc.push(rarc);

        for (let i = 0; i < rarc.files.length; i++) {
            const file = rarc.files[i];

            if (file.name.length < 4)
                continue;

            const extension = file.name.slice(-4);

            if (extension == '.bmd' || extension == '.bdl') {
                const basename = file.name.split('.')[0];
                const bmtFile = rarc.files.find((f) => f.name === `${basename}.bmt`) || null;

                let modelInstance;

                try {
                    modelInstance = createModelInstance(device, renderer.renderHelper.renderInstManager.gfxRenderCache, file, null, null, null, bmtFile);
                } catch(e) {
                    console.warn(`File ${basename} failed to parse:`, e);
                    continue;
                }

                modelInstance.name = basename;
                renderer.addModelInstance(modelInstance);
                renderer.textureHolder.addTextures(device, modelInstance.modelMaterialData.tex1Data!.tex1.textureDatas);
            }
            else if (extension == '.bti') {
                const texture = readBTI_Texture(file.buffer, file.name);
                renderer.textureHolder.addTextures(device, [texture]);
            }
            else if (extension == '.btk' || extension == '.brk' || extension == '.bck') {
                renderer.animations.push(new AnimationEntry(file));
            }
        }        
    }

    if (['J3D2bmd3', 'J3D2bdl4'].includes(readString(buffer, 0, 8))) {
        const bmd = BMD.parse(buffer);
        const bmdModel = new J3DModelData(device, renderer.renderHelper.renderInstManager.gfxRenderCache, bmd);
        const modelInstance = new J3DModelInstanceSimple(bmdModel);
        renderer.addModelInstance(modelInstance);
        renderer.textureHolder.addTextures(device, modelInstance.modelMaterialData.tex1Data!.tex1.textureDatas);
    }
}

export function createSceneFromBuffer(context: SceneContext, buffer: ArrayBufferSlice): Viewer.SceneGfx {
    if (readString(buffer, 0, 4) === 'RARC') {
        const rarc = RARC.parse(buffer);

        // Special case for SMG's Effect.arc
        if (rarc.findFile('ParticleNames.bcsv') !== null)
            return JPAExplorer.createRendererFromSMGArchive(context, rarc);
    }

    const device = context.device;
    const renderer = new J3DRenderer(device);
    createScenesFromBuffer(device, renderer, buffer);
    return renderer;
}
