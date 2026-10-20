import {createClient} from "npm:@supabase/supabase-js@2.112.4";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escape=(value:string)=>value.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
Deno.serve(async req=>{
 const allowed=(Deno.env.get("BRANDEX_ALLOWED_ORIGINS")??"").split(",").map(v=>v.trim()).filter(Boolean),origin=req.headers.get("origin");
 const cors:Record<string,string>=origin&&allowed.includes(origin)?{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"}:{};
 const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
 if(origin&&!allowed.includes(origin))return response({error:"Origin not allowed"},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return response({error:"POST required"},405);
 const auth=req.headers.get("authorization");if(!auth)return response({error:"Sign in required"},401);
 const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const {data:{user},error:authError}=await sb.auth.getUser();if(authError||!user)return response({error:"Sign in required"},401);
 const {data:profile}=await sb.from("profiles").select("role").eq("user_id",user.id).single();if(profile?.role!=="admin")return response({error:"Admin required"},403);
 const operation=crypto.randomUUID();let caseId="",claimed=false;
 try{
  const form=await req.formData();caseId=String(form.get("case_id")??"");const uploadId=String(form.get("upload_id")??crypto.randomUUID()),fileValue=form.get("file"),syncOnly=form.get("action")==="sync";
  const file=fileValue instanceof File?fileValue:null;
  if(!caseId||caseId.length>200||(!syncOnly&&(!UUID.test(uploadId)||!file||file.size===0||file.size>20*1024*1024||!["application/pdf","image/png","image/jpeg"].includes(file.type))))return response({error:"Choose a PDF, PNG or JPEG up to 20 MB"},400);
  if(file&&!syncOnly){
   const head=new Uint8Array(await file.slice(0,16).arrayBuffer());
   const starts=(bytes:number[])=>bytes.every((byte,index)=>head[index]===byte);
   const valid=file.type==="application/pdf"
    ? /\.pdf$/i.test(file.name)&&starts([0x25,0x50,0x44,0x46,0x2d])
    : file.type==="image/png"
     ? /\.png$/i.test(file.name)&&starts([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])
     : /\.jpe?g$/i.test(file.name)&&starts([0xff,0xd8,0xff]);
   if(!valid)return response({error:"File contents do not match its PDF, PNG or JPEG type"},400);
  }
  const {data:previous,error:lookupError}=await sb.from("case_drive_files").select("*").eq("upload_id",uploadId).maybeSingle();if(lookupError)throw lookupError;
  if(previous){if(previous.trademark_id!==caseId)return response({error:"Upload belongs to another case"},409);return response({file_id:previous.drive_file_id});}
  const {data:record,error:recordError}=await sb.from("trademarks").select("id,type,client_code,case_number,application_name,tm_cpr_number,nice_class,status").eq("id",caseId).single();if(recordError)throw recordError;
  const {data:link,error:linkError}=await sb.from("billing_case_links").select("*, billing_clients(*)").eq("trademark_id",caseId).single();if(linkError)throw linkError;
  const client=link.billing_clients;
  const {data:series,error:seriesError}=await sb.from("billing_series").select("drive_root_id").eq("code",client.series).single();if(seriesError)throw seriesError;
  if(!series.drive_root_id)return response({error:"Set this series' verified Drive root folder ID first"},409);
  const clientId=Deno.env.get("GOOGLE_CLIENT_ID"),clientSecret=Deno.env.get("GOOGLE_CLIENT_SECRET"),refresh=Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if(!clientId||!clientSecret||!refresh)return response({error:"Drive OAuth setup is not configured"},503);
  const {data:lease,error:leaseError}=await sb.rpc("claim_drive_case",{p_case:caseId,p_operation:operation});if(leaseError)throw leaseError;if(!lease)return response({error:"Another upload is active for this case; retry shortly"},409);claimed=true;
  const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:new URLSearchParams({grant_type:"refresh_token",client_id:clientId,client_secret:clientSecret,refresh_token:refresh})});
  const token=await tokenResponse.json();if(!tokenResponse.ok||!token.access_token)throw new Error("Drive authorization needs renewal");
  async function drive(path:string,init:RequestInit={}){const r=await fetch("https://www.googleapis.com/drive/v3/"+path,{...init,headers:{Authorization:`Bearer ${token.access_token}`,...init.headers}});if(!r.ok)throw new Error(`Drive operation failed (${r.status}); retry with the same upload ID`);return r.status===204?null:await r.json();}
  async function folder(parent:string,name:string,saved?:string){if(saved){const f=await drive(`files/${encodeURIComponent(saved)}?fields=id,mimeType,trashed,parents`);if(f.trashed||f.mimeType!=="application/vnd.google-apps.folder"||!Array.isArray(f.parents)||!f.parents.includes(parent))throw new Error("Linked folder is outside its verified parent; reconcile before upload");return saved;}
   const query=`'${escape(parent)}' in parents and name='${escape(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
   const found=await drive(`files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=100`);if(found.files.length>1)throw new Error("Duplicate folder names: reconcile the existing folder ID first");
   if(found.files.length)return found.files[0].id;
   return (await drive("files?fields=id",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder",parents:[parent]})})).id;
  }
  const clientFolder=await folder(series.drive_root_id,`${client.series}-${client.code} ${client.name}`,client.drive_folder_id);
  if(!client.drive_folder_id){const {error}=await sb.from("billing_clients").update({drive_folder_id:clientFolder}).eq("id",client.id);if(error)throw error;}
  const caseName=`${client.code}-${record.case_number} ${record.application_name}${record.tm_cpr_number?" "+record.tm_cpr_number:""}${record.nice_class?" C"+record.nice_class:""}`;
  const caseFolder=await folder(clientFolder,caseName,link.drive_folder_id);
  if(link.drive_folder_id){await drive(`files/${encodeURIComponent(caseFolder)}?fields=id`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:caseName})});}
  else {const {error}=await sb.from("billing_case_links").update({drive_folder_id:caseFolder}).eq("trademark_id",caseId);if(error)throw error;}
  const {error:syncError}=await sb.from("case_operations").upsert({trademark_id:caseId,drive_sync_pending:false},{onConflict:"trademark_id"});if(syncError)throw syncError;
  if(syncOnly)return response({folder_id:caseFolder,synced:true});
  if(!file)return response({error:"File required"},400);
  const existing=await drive(`files?q=${encodeURIComponent(`'${escape(caseFolder)}' in parents and appProperties has { key='brandexUpload' and value='${uploadId}' } and trashed=false`)}&fields=files(id)&pageSize=100`);
  let fileId=existing.files[0]?.id;
  if(!fileId){
   const name=file.name.replace(/[\x00-\x1f]/g,"").slice(0,180);
   const metadata={name,parents:[caseFolder],appProperties:{brandexUpload:uploadId}};
   const start=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",{method:"POST",headers:{Authorization:`Bearer ${token.access_token}`,"Content-Type":"application/json","X-Upload-Content-Type":file.type,"X-Upload-Content-Length":String(file.size)},body:JSON.stringify(metadata)});
   const location=start.headers.get("location");if(!start.ok||!location||!location.startsWith("https://www.googleapis.com/upload/"))throw new Error("Could not start Drive upload");
   const r=await fetch(location,{method:"PUT",headers:{Authorization:`Bearer ${token.access_token}`,"Content-Type":file.type},body:file});
   if(!r.ok)throw new Error("Drive upload failed; retry the same upload ID");fileId=(await r.json()).id;
  }

  const {error}=await sb.from("case_drive_files").insert({upload_id:uploadId,trademark_id:caseId,drive_file_id:fileId,original_name:file.name,mime_type:file.type});if(error)throw error;
  return response({file_id:fileId,folder_id:caseFolder});
 }catch(error){console.error("case-drive-upload",error instanceof Error?error.message:"Failure");return response({error:error instanceof Error?error.message:"Upload failed"},500);}
 finally{if(claimed)await sb.rpc("release_drive_case",{p_case:caseId,p_operation:operation});}
});
