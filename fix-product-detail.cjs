const fs = require('fs');
let content = fs.readFileSync('src/pages/ProductDetail.tsx', 'utf8');

const oldInlineGrid = `<div className="grid grid-cols-3 gap-2 w-full pt-1">`;
const newInlineGrid = `<div className="hidden md:grid grid-cols-[auto_1fr_1fr] gap-2 w-full pt-1">`;
content = content.replace(oldInlineGrid, newInlineGrid);

const oldMobileBar = `<div 
          id="product-mobile-action-bar"
          className="md:hidden fixed bottom-4 left-4 right-4 z-[995] bg-white border border-neutral-200 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >`;
const newMobileBar = `<div 
          id="product-mobile-action-bar"
          className="md:hidden fixed bottom-4 left-4 right-4 z-[9999] bg-white border border-neutral-200/80 rounded-2xl shadow-2xl p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
        >`;
content = content.replace(oldMobileBar, newMobileBar);

fs.writeFileSync('src/pages/ProductDetail.tsx', content);
