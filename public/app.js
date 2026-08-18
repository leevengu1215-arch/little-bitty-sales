let state={products:[],sales:[]}, clerk=localStorage.getItem('wechatName')||'', pending=null, selectedDate=dateKey(new Date()), followToday=true;
const $=s=>document.querySelector(s), money=n=>`¥${n.toLocaleString('zh-CN')}`;
function dateKey(d){return new Date(d).toLocaleDateString('sv-SE')}
const toast=m=>{const e=$('#toast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)};
async function api(url,options){const r=await fetch(url,{headers:{'Content-Type':'application/json'},...options}),d=await r.json();if(!r.ok)throw Error(d.error);return d}
$('#wechatName').value=clerk;
$('#wechatName').oninput=e=>{clerk=e.target.value.trim();localStorage.setItem('wechatName',clerk);renderDashboard()};
$('#settlementDate').value=selectedDate;
$('#settlementDate').onchange=e=>{selectedDate=e.target.value;followToday=selectedDate===dateKey(new Date());renderDashboard()};
$('#previousDay').onclick=()=>{const d=new Date(`${selectedDate}T12:00:00`);d.setDate(d.getDate()-1);selectedDate=dateKey(d);followToday=false;$('#settlementDate').value=selectedDate;renderDashboard()};
$('#todayBtn').onclick=()=>{selectedDate=dateKey(new Date());followToday=true;$('#settlementDate').value=selectedDate;renderDashboard()};
$('#exportExcel').onclick=exportExcel;
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab,.page').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(`#${b.dataset.page}`).classList.add('active');render()});
async function load(){try{state=await api('/api/state');render()}catch{$('#products').innerHTML='<div class="empty">商品加载失败，请从“启动销售台”打开</div>'}}
function render(){renderProducts();renderDashboard()}
function renderProducts(){
  const visible=[...new Set(state.products.filter(p=>!p.hidden).map(p=>p.name))];
  $('#products').innerHTML=visible.map((name,i)=>{const ps=state.products.filter(p=>p.name===name),colors=[...new Set(ps.map(p=>p.color))],sizes=[...new Set(ps.map(p=>p.size))],p=ps[0];return `<article class="product" data-name="${name}"><img src="images/${p.image}" alt="${name} ${p.color}" loading="lazy"><div class="productBody"><div class="productHead"><div><h3>${name}</h3><small>${colors.length} 种颜色 · ${sizes.length} 个尺寸</small></div><div class="price"><del>原价 ${money(p.originalPrice)}</del><span>展会价 ${money(p.price)}</span></div></div><div class="options"><select class="color" aria-label="${name}颜色">${colors.map(x=>`<option>${x}</option>`).join('')}</select><select class="size" aria-label="${name}尺寸">${sizes.map(x=>`<option>${x}</option>`).join('')}</select><input class="qty" type="number" min="1" max="99" value="1" inputmode="numeric" aria-label="${name}数量"></div><button class="reviewBtn">确认售出</button></div></article>`}).join('')||'<div class="empty">没有找到商品</div>';
  document.querySelectorAll('.product').forEach(card=>{
    const update=()=>{const p=findVariant(card);card.querySelector('img').src=`images/${p.image}`;card.querySelector('img').alt=`${p.name} ${p.color}`;card.querySelector('.price').innerHTML=`<del>原价 ${money(p.originalPrice)}</del><span>展会价 ${money(p.price)}</span>`};
    card.querySelector('.color').onchange=update;card.querySelector('.size').onchange=update;
    card.querySelector('.reviewBtn').onclick=()=>review(card);
  });
}
function findVariant(card){return state.products.find(p=>p.name===card.dataset.name&&p.color===card.querySelector('.color').value&&p.size===card.querySelector('.size').value)}
function review(card){
  const product=findVariant(card),quantity=Number.parseInt(card.querySelector('.qty').value,10);
  if(!clerk)return toast('请先填写售货员名字');
  if(!Number.isInteger(quantity)||quantity<1||quantity>99)return toast('数量必须是 1–99');
  pending={product,quantity,discount:0,unitPrice:product.price,note:''};
  $('#confirmDetail').innerHTML=`<strong>${product.name}</strong><span>${product.color} · ${product.size} · ${quantity} 件</span><span>售货员：${clerk}</span><span><del>原价 ${money(product.originalPrice*quantity)}</del>　展会价 <b>${money(product.price*quantity)}</b></span>`;
  document.querySelector('input[name="priceMode"][value="standard"]').checked=true;document.querySelector('input[name="discount"][value="0"]').checked=true;$('#otherPrice').value='';$('#otherPrice').disabled=true;$('#saleNote').value='';updateActualPay();
  $('#confirmSale').showModal();
}
function updateActualPay(){if(!pending)return;const other=document.querySelector('input[name="priceMode"]:checked').value==='other';$('#otherPrice').disabled=!other;pending.unitPrice=other?Number($('#otherPrice').value):pending.product.price;pending.discount=Number(document.querySelector('input[name="discount"]:checked').value);$('#actualPay').textContent=Number.isFinite(pending.unitPrice)&&pending.unitPrice>0?`实际收款 ${money(pending.unitPrice*pending.quantity-pending.discount)}`:'请输入有效的其他价格'}
document.querySelectorAll('input[name="discount"]').forEach(x=>x.onchange=updateActualPay);
document.querySelectorAll('input[name="priceMode"]').forEach(x=>x.onchange=updateActualPay);$('#otherPrice').oninput=updateActualPay;
$('#submitSale').onclick=async e=>{e.preventDefault();if(!pending)return;pending.note=$('#saleNote').value.trim();try{await api('/api/sales',{method:'POST',body:JSON.stringify({productId:pending.product.id,quantity:pending.quantity,price:pending.unitPrice,discount:pending.discount,note:pending.note,clerk})});$('#confirmSale').close();toast(`已售出 ${pending.quantity} 件`);pending=null}catch(err){toast(err.message)}};
function renderDashboard(){
  const daySales=state.sales.filter(s=>dateKey(s.createdAt)===selectedDate),active=daySales.filter(s=>!s.voidedAt),qty=s=>s.quantity||1,received=s=>s.price*qty(s)-(s.discount||0);
  $('#count').textContent=active.reduce((n,s)=>n+qty(s),0);$('#revenue').textContent=money(active.reduce((n,s)=>n+s.price*qty(s)-(s.discount||0),0));
  const sum={};active.forEach(s=>{const p=state.products.find(x=>x.id===s.productId),k=`${p.name}|${p.color} · ${p.size}`;sum[k]=(sum[k]||0)+qty(s)});
  $('#summary').innerHTML=Object.entries(sum).sort((a,b)=>b[1]-a[1]).map(([k,n])=>{const [a,b]=k.split('|');return`<div class="row"><div>${a}<small>${b}</small></div><b>${n} 件</b></div>`}).join('')||'<div class="empty">该日期没有销售记录</div>';
  const staff={};active.forEach(s=>{const x=staff[s.clerk]||(staff[s.clerk]={count:0,amount:0});x.count+=qty(s);x.amount+=received(s)});
  $('#staffSummary').innerHTML=Object.entries(staff).sort((a,b)=>b[1].amount-a[1].amount).map(([name,x])=>`<div class="row"><div><b>${name}</b><small>${x.count} 件</small></div><b>${money(x.amount)}</b></div>`).join('')||'<div class="empty">该日期没有售货员记录</div>';
  $('#sales').innerHTML=daySales.map(s=>{const p=state.products.find(x=>x.id===s.productId),n=qty(s),discount=s.discount||0;return`<div class="row ${s.voidedAt?'voided':''}"><div>${p.name}<small>${p.color} · ${p.size} · ${n} 件 · ${new Date(s.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} · 单价 ${money(s.price)}${discount?` · 优惠 ${money(discount)}`:''}${s.note?` · 备注：${s.note}`:''}</small><span class="staffTag">售货员：${s.clerk}</span></div><b class="amount">${money(received(s))}</b>${!s.voidedAt&&s.clerk===clerk?`<button class="void" data-id="${s.id}">撤回</button>`:''}</div>`}).join('')||'<div class="empty">该日期暂无流水</div>';
  document.querySelectorAll('.void').forEach(b=>b.onclick=async()=>{if(!confirm('确认撤回这条销售记录？'))return;try{await api(`/api/sales/${b.dataset.id}/void`,{method:'POST',body:JSON.stringify({clerk})});toast('已撤回')}catch(e){toast(e.message)}})
}
function exportExcel(){
  const rows=state.sales.filter(s=>dateKey(s.createdAt)===selectedDate).map(s=>{const p=state.products.find(x=>x.id===s.productId),n=s.quantity||1,d=s.discount||0;return [new Date(s.createdAt).toLocaleString('zh-CN'),s.clerk,p.name,p.color,p.size,n,p.originalPrice,p.price,s.price,d,s.price*n-d,s.note||'',s.voidedAt?'已撤回':'有效']});
  const safe=v=>{let s=String(v??'');if(/^[=+@-]/.test(s))s=`'${s}`;return `"${s.replaceAll('"','""')}"`};
  const csv='\ufeff'+[['时间','售货员','产品','颜色','尺寸','数量','原价单价','标准展会单价','实际成交单价','优惠','实际收款','备注','状态'],...rows].map(r=>r.map(safe).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`Little-Bitty-销售结算-${selectedDate}.csv`;a.click();URL.revokeObjectURL(url);toast(`已导出 ${rows.length} 条记录`)
}
setInterval(()=>{const now=dateKey(new Date());if(followToday&&selectedDate!==now){selectedDate=now;$('#settlementDate').value=now;renderDashboard()}},60000);
new EventSource('/api/events').onmessage=load;load();
