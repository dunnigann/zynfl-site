/* Keep every table value available on narrow screens without sideways scrolling. */
function prepareResponsiveTables(){
 document.querySelectorAll('table:not([data-responsive])').forEach(table=>{
  table.dataset.responsive='true';
  const headers=[...table.querySelectorAll('thead tr:first-child th')].map(th=>(th.querySelector('.matrix-full')||th).textContent.trim());
  if(table.classList.contains('matrix')){
   const rows=[...table.querySelectorAll('tbody tr')];
   if(!rows.length)return;
   const panel=document.createElement('div');panel.className='mobile-matrix';
   const label=document.createElement('label');label.textContent='Choose a manager';
   const select=document.createElement('select');select.setAttribute('aria-label','Choose a manager to compare');
   rows.forEach((row,i)=>select.add(new Option(row.cells[0].textContent.trim(),i)));
   label.append(select);panel.append(label);
   const list=document.createElement('dl');panel.append(list);
   const draw=()=>{list.replaceChildren();const row=rows[Number(select.value)];[...row.cells].slice(1).forEach((cell,i)=>{
    if(headers[i+1]===row.cells[0].textContent.trim())return;
    const item=document.createElement('div');item.className=cell.className;
    const name=document.createElement('dt');name.textContent=headers[i+1];
    const value=document.createElement('dd');value.textContent=cell.textContent.trim()||'—';
    item.append(name,value);list.append(item);
   });};
   select.addEventListener('change',draw);draw();table.after(panel);
  }else{
   table.classList.add('responsive-table');
   table.querySelectorAll('tbody tr').forEach(row=>[...row.cells].forEach((cell,i)=>{cell.dataset.label=headers[i]||'';}));
  }
 });
}
prepareResponsiveTables();
const responsiveObserver=new MutationObserver(prepareResponsiveTables);
responsiveObserver.observe(document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>go((location.hash||'#home').slice(1)));
