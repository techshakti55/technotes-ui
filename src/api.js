import {demoMode,demoRequest} from './demo';
export const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
export class ApiError extends Error { constructor(status, body){super(body?.message || `Request failed (${status})`);this.status=status;this.body=body;} }
export async function request(path,{method='GET',token,body,etag}={}){
  if(demoMode)return demoRequest(path,{method,body,etag});
  const headers={'Accept':'application/json'};
  if(body!==undefined) headers['Content-Type']='application/json';
  if(token) headers.Authorization=`Bearer ${token}`;
  if(etag) headers['If-Match']=etag;
  const response=await fetch(`${apiBase}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  let data=null; if(response.status!==204){const raw=await response.text();if(raw){try{data=JSON.parse(raw)}catch{throw new ApiError(response.status,{message:'Unexpected API response. Check Gateway routing.'})}}}
  if(!response.ok) throw new ApiError(response.status,data);
  return {data,etag:response.headers.get('ETag')};
}
export const page=(data)=>Array.isArray(data)?data:(data?.items || []);
export const publicCategories=()=>request('/api/v1/public/categories?rootOnly=true&page=0&size=100');
export const children=(id)=>request(`/api/v1/public/categories?parentId=${encodeURIComponent(id)}&page=0&size=100`);
export const publicNotes=(categoryId)=>request(`/api/v1/public/notes?page=0&size=100&sort=publishedAt,desc${categoryId?`&primaryCategoryId=${encodeURIComponent(categoryId)}`:''}`);
export const publicNote=(slug)=>request(`/api/v1/public/notes/${encodeURIComponent(slug)}`);
export const myNotes=(token)=>request('/api/v1/notes?view=mine&page=0&size=100&sort=updatedAt,desc',{token});
export const noteById=(id,token)=>request(`/api/v1/notes/${encodeURIComponent(id)}`,{token});
export const createNote=(body,token)=>request('/api/v1/notes',{method:'POST',body,token});
export const editNote=(id,body,etag,token)=>request(`/api/v1/notes/${encodeURIComponent(id)}`,{method:'PATCH',body,etag,token});
export const noteAction=(id,action,etag,token,body)=>request(`/api/v1/notes/${encodeURIComponent(id)}/${action}`,{method:'POST',body,etag,token});
export const createCategory=(body,token)=>request('/api/v1/categories',{method:'POST',body,token});
export const me=(token)=>request('/api/v1/users/me',{token});
