/** Check actual Neon metadata as well as local env; never log credential values. */
export function assertNeonTarget({projectId,branch,branchInfo,endpoints,directOptions,pooledOptions}){
 if(branchInfo?.project_id!==projectId||branchInfo.name!==branch)throw new Error('NEON_CONTEXT_MISMATCH');
 if(!directOptions?.host?.endsWith('.neon.tech')||directOptions.host.includes('-pooler'))throw new Error('NEON_DIRECT_ENDPOINT_REQUIRED');
 const endpoint=endpoints?.find(item=>item.project_id===projectId&&item.branch_id===branchInfo.id&&item.type==='read_write'&&item.host===directOptions.host);
 if(!endpoint)throw new Error('NEON_ENDPOINT_BRANCH_MISMATCH');
 if(pooledOptions?.host?.replace('-pooler.','.')!==directOptions.host
   ||pooledOptions.database!==directOptions.database||pooledOptions.user!==directOptions.user
   ||pooledOptions.password!==directOptions.password)throw new Error('NEON_POOLED_DIRECT_MISMATCH');
}
