export const issueLabels={estimated:'Estimated specifications — verify',spec:'Missing SKU match',date:'Missing requested date',overdue:'Past requested date'};
export function receivedPoMessage(lines,search){
 const query=search.trim().toLowerCase();
 if(!query)return '';
 const matches=lines.filter(r=>r.po.toLowerCase()===query);
 if(!matches.length||!matches.every(r=>r.received>=r.ordered))return '';
 return `${matches[0].po} is already fully received according to the uploaded data. All ${matches.length} saved order lines have zero outstanding quantity, so this order is excluded from expected inbound pallets and the receiving calendar.`;
}
export function lineIssues(row,calculation,today){
 const issues=[];
 if(calculation.spec?.estimation)issues.push({type:"estimated",detail:calculation.spec.estimation.basis+". Planning estimate; verify pallet packing and weight before operational use."});
 if(!calculation.spec)issues.push({type:'spec',detail:`No SKU specification matches item ${row.item}, location ${row.site}, and UOM ${row.uom}. Upload a matching SKU record or correct the order identifiers.`});
 if(!row.date)issues.push({type:'date',detail:'This order line has no requested receipt date. Add the date to the order data; until then it is Unscheduled.'});
 else if(row.date<today)issues.push({type:'overdue',detail:`Requested receipt date ${row.date} is before planning snapshot ${today}, with quantity still outstanding. Review the order receipt status and requested date.`});
 return issues;
}
