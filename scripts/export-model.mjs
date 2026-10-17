import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try {
 const {finalModel}=await server.ssrLoadModule('/src/final-design.ts');
 const ids=finalModel.objects.map(o=>o.id);
 if(new Set(ids).size!==ids.length)throw new Error('Duplicate final object IDs');
 await writeFile('src/generated-layout.json',JSON.stringify(finalModel));
 console.log(`Final model ${finalModel.version}: ${ids.length} objects; generated at build time`);
} finally {await server.close();}
