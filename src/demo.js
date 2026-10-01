export const demoMode=import.meta.env.VITE_DEMO_MODE==='true';
const category={id:'11111111-1111-4111-8111-111111111111',name:'Core Java',slug:'core-java',parentId:null,level:1,active:true,sortOrder:0};
const seed={id:'22222222-2222-4222-8222-222222222222',slug:'understanding-arraylist',title:'Understanding ArrayList',summary:'How ArrayList stores elements, grows its capacity and gives fast indexed access.',contentMarkdown:'# ArrayList, explained\n\nAn `ArrayList` is a resizable array. It keeps elements in order and lets you access an item by its index.\n\n## Why use it?\n\nUse it when you need fast reads by position and the number of elements can change.\n\n```java\nList<String> topics = new ArrayList<>();\ntopics.add("Java");\ntopics.add("DSA");\nSystem.out.println(topics.get(0)); // Java\n```\n\n## One thing to remember\n\nAdding an element at the beginning can be slower because later elements must shift.',primaryCategoryId:category.id,categoryName:'Core Java',tags:['java','collections'],contentKind:'NOTE',authorId:'33333333-3333-4333-8333-333333333333',status:'PUBLISHED',visibility:'PUBLIC',version:1,createdAt:'2026-09-29T04:00:00Z',updatedAt:'2026-09-29T04:00:00Z',publishedAt:'2026-09-29T04:00:00Z',revisionNumber:1};
const storage='technotes.demo.notes';
const get=()=>{try{return JSON.parse(localStorage.getItem(storage))||[seed]}catch{return [seed]}};
const put=arr=>localStorage.setItem(storage,JSON.stringify(arr));
const result=(data,etag=null)=>({data,etag});
const listed=items=>result({items,page:0,size:100,totalElements:items.length,totalPages:items.length?1:0});
export async function demoRequest(path,{method='GET',body}={}){
 await new Promise(r=>setTimeout(r,120));const notes=get();
 if(path.startsWith('/api/v1/users/me'))return result({id:seed.authorId,displayName:'Shakti Singh',email:'admin@technotes.example',roles:['ADMIN'],status:'ACTIVE'});
 if(path.startsWith('/api/v1/public/categories'))return listed([category]);
 if(path.startsWith('/api/v1/public/notes/')){const n=notes.find(x=>x.slug===decodeURIComponent(path.split('/').pop())&&x.status==='PUBLISHED');if(!n)throw Error('Note not found');return result(n)}
 if(path.startsWith('/api/v1/public/notes')){const u=new URL(path,'http://example.test');return listed(notes.filter(x=>x.status==='PUBLISHED'&&(!u.searchParams.get('primaryCategoryId')||x.primaryCategoryId===u.searchParams.get('primaryCategoryId'))).map(({contentMarkdown,...rest})=>rest))}
 if(path==='/api/v1/categories'&&method==='POST')return result({...category,...body});
 if(path.startsWith('/api/v1/notes?'))return listed(notes.map(({contentMarkdown,...rest})=>rest));
 if(path==='/api/v1/notes'&&method==='POST'){const id=crypto.randomUUID(),n={...body,id,slug:body.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+id.slice(0,8),categoryName:'Core Java',contentKind:'NOTE',authorId:seed.authorId,status:'DRAFT',version:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};put([n,...notes]);return result(n,`"note-${id}-v0"`)}
 const m=path.match(/^\/api\/v1\/notes\/([^/?]+)(?:\/(submit|publish))?$/);if(m){let n=notes.find(x=>x.id===m[1]);if(!n)throw Error('Note not found');if(method==='GET')return result(n,`"note-${n.id}-v${n.version}"`);if(method==='PATCH')n={...n,...body,version:n.version+1,updatedAt:new Date().toISOString()};else if(m[2]==='submit')n={...n,status:'IN_REVIEW',version:n.version+1};else if(m[2]==='publish')n={...n,status:'PUBLISHED',version:n.version+1,publishedAt:new Date().toISOString()};put(notes.map(x=>x.id===n.id?n:x));return result(n,`"note-${n.id}-v${n.version}"`)}
 throw Error('Demo route is unavailable.');
}
