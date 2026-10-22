const picker=document.getElementById('preview-size'),frame=document.getElementById('mobile-preview');
picker.addEventListener('change',()=>{const [width,height]=picker.value.split('x').map(Number);frame.width=String(width);frame.height=String(height);});
