(()=>{
 const format=new URLSearchParams(location.search).get('canvas_format');
 if(format!=='horizontal'&&format!=='vertical')return;
 document.documentElement.dataset.canvasFormat=format;
 document.documentElement.dataset.canvasWidth=format==='vertical'?'1080':'1920';
 document.documentElement.dataset.canvasHeight=format==='vertical'?'1920':'1080';
})();
