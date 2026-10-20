import baseModel from './model.js';
import {createStorageDesign} from './storage-design';
import {createAtmosphereDesign} from './atmosphere-design';
import {createSalonDesign} from './salon-design';
import {createHomeDesign} from './home-design';
import {createLifeDesign} from './life-design';
import {createSpaceRevision} from './space-revision';
import {createR2Design} from './r2-design';
import {createR3Design} from './r3-design';
import {createR4Design} from './r4-design';
import {createR5Design} from './r5-design';
import {createR6Design} from './r6-design';

/** Authoring composition runs at build time; the browser consumes its one final snapshot. */
const storageBase = createStorageDesign(structuredClone(baseModel) as never);
const atmosphere = createAtmosphereDesign(storageBase);
const salon = createSalonDesign(atmosphere);
const home = createHomeDesign(salon);
const life = createLifeDesign(home);
const space = createSpaceRevision(life);
const r2 = createR2Design(space);
const r3 = createR3Design(r2);
const r4 = createR4Design(r3);
const r5 = createR5Design(r4);

export const finalModel = createR6Design(r5);
