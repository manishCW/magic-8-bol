export const specs = { 'CAB-100': {weight: 25, perPallet: 20}, 'PWR-200': {weight: 8, perPallet: 40}, 'RCK-300': {weight: 90, perPallet: 4}, 'SEN-400': {weight: 2, perPallet: 100} };
export const lines = [
 {id:1,po:'PO-10421',item:'CAB-100',name:'Network cabinet kit',vendor:'Northstar Supply',site:'Grapevine',date:'2026-09-28',ordered:100,received:20,closed:false},
 {id:2,po:'PO-10421',item:'PWR-200',name:'Power distribution unit',vendor:'Northstar Supply',site:'Grapevine',date:'2026-09-30',ordered:120,received:0,closed:false},
 {id:3,po:'PO-10422',item:'RCK-300',name:'Server rack assembly',vendor:'Atlas Components',site:'Denton',date:'2026-09-29',ordered:24,received:4,closed:false},
 {id:4,po:'PO-10423',item:'SEN-400',name:'Environmental sensor',vendor:'Fieldworks',site:'Austin',date:'2026-09-30',ordered:500,received:100,closed:false},
 {id:5,po:'PO-10424',item:'CAB-100',name:'Network cabinet kit',vendor:'Northstar Supply',site:'Denton',date:'2026-10-02',ordered:160,received:0,closed:false},
 {id:6,po:'PO-10425',item:'NEW-500',name:'Cooling manifold',vendor:'Atlas Components',site:'Grapevine',date:'2026-09-29',ordered:30,received:0,closed:false},
 {id:7,po:'PO-10426',item:'PWR-200',name:'Power distribution unit',vendor:'Fieldworks',site:'Austin',date:'2026-09-25',ordered:200,received:40,closed:false},
 {id:8,po:'PO-10427',item:'RCK-300',name:'Server rack assembly',vendor:'Atlas Components',site:'Grapevine',date:'',ordered:12,received:0,closed:false},
 {id:9,po:'PO-10428',item:'SEN-400',name:'Environmental sensor',vendor:'Fieldworks',site:'Denton',date:'2026-10-05',ordered:300,received:0,closed:false},
 {id:10,po:'PO-10429',item:'CAB-100',name:'Network cabinet kit',vendor:'Northstar Supply',site:'Austin',date:'2026-09-28',ordered:40,received:0,closed:true},
 {id:11,po:'PO-10430',item:'PWR-200',name:'Power distribution unit',vendor:'Fieldworks',site:'Denton',date:'2026-09-28',ordered:80,received:80,closed:false},
 {id:12,po:'PO-10431',item:'RCK-300',name:'Server rack assembly',vendor:'Atlas Components',site:'Austin',date:'2026-10-07',ordered:60,received:0,closed:false}
];
export function eligible(rows) {return rows.filter(r=>!r.closed && r.ordered>r.received);}
export function calculate(row) {const quantity=Math.max(0,row.ordered-row.received); const spec=specs[row.item]; const pallets=spec?Math.ceil(quantity/spec.perPallet):null; return {quantity,pallets,goods:spec?quantity*spec.weight:null,gross:spec?quantity*spec.weight:null};}
export function totals(rows) {return rows.reduce((a,r)=>{const c=calculate(r);a.units+=c.quantity;a.pallets+=c.pallets??0;a.weight+=c.gross??0;a.missing+=c.pallets===null?1:0;return a;},{pos:new Set(rows.map(r=>r.po)).size,units:0,pallets:0,weight:0,missing:0});}
