import baseModel from './model.js';
import {createStorageDesign} from './storage-design';
import {createAtmosphereDesign} from './atmosphere-design';
import {createSalonDesign} from './salon-design';
import {createHomeDesign} from './home-design';
import {createLifeDesign} from './life-design';
import {createSpaceRevision} from './space-revision';
import {createR2Design} from './r2-design';
import {createR3Design} from './r3-design';
/** Authoring composition runs at build time; the browser consumes its one final snapshot. */
export const finalModel = createR3Design(createR2Design(createSpaceRevision(createLifeDesign(createHomeDesign(
 createSalonDesign(createAtmosphereDesign(createStorageDesign(structuredClone(baseModel) as never))),
)))));
