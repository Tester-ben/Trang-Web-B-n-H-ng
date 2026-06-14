/* =========================================================
   THE STYLE HUB - STYLIST AI CHATBOT V2
   Fix:
   - Logo chatbot kéo lên/xuống được
   - Lưu lịch sử chat khi chuyển trang
   - Tư vấn size theo dữ liệu người dùng nhập
   - Tư vấn size quần/áo theo bảng Nam/Nữ
   - Tư vấn size giày theo bảng Nam/Nữ + hỏi mang vừa/rộng
   ========================================================= */

(function () {
"use strict";

const STORAGE_MESSAGES = "tsh_ai_chat_messages_v2";
const STORAGE_CONTEXT = "tsh_ai_chat_context_v2";
const STORAGE_POS = "tsh_ai_chat_pos_y_v2";
const STYLE_ID = "stylehub-ai-chat-style-v2";
const WIDGET_ID = "stylehub-ai-chat-widget";

const CLOTHING_SIZE = {
    male: [
        {size:"XS", minW:42, maxW:47, height:"1m54 - 1m59"},
        {size:"S", minW:48, maxW:53, height:"1m60 - 1m64"},
        {size:"M", minW:53, maxW:60, height:"1m65 - 1m69"},
        {size:"L", minW:61, maxW:68, height:"1m70 - 1m75"},
        {size:"XL", minW:69, maxW:75, height:"trên 1m75"},
        {size:"XXL", minW:76, maxW:200, height:"trên 1m75"}
    ],
    female: [
        {size:"XS", minW:32, maxW:36, height:"1m42 - 1m47"},
        {size:"S", minW:37, maxW:42, height:"1m48 - 1m53"},
        {size:"M", minW:43, maxW:48, height:"1m54 - 1m59"},
        {size:"L", minW:49, maxW:54, height:"1m60 - 1m65"},
        {size:"XL", minW:55, maxW:60, height:"trên 1m65"},
        {size:"XXL", minW:61, maxW:200, height:"trên 1m65"}
    ]
};

const SHOE_SIZE = {
    male: [
        {cm:24, eu:"38 2/3"}, {cm:24.5, eu:"39 1/3"}, {cm:25, eu:"40"},
        {cm:25.5, eu:"40 2/3"}, {cm:26, eu:"41 1/3"}, {cm:26.5, eu:"42"},
        {cm:27, eu:"42 2/3"}, {cm:27.5, eu:"43 1/3"}, {cm:28, eu:"44"},
        {cm:28.5, eu:"44 2/3"}, {cm:29, eu:"45 1/3"}, {cm:29.5, eu:"46"},
        {cm:30, eu:"46 1/3"}, {cm:31, eu:"48"}, {cm:32, eu:"49 1/3"}, {cm:33, eu:"50 2/3"}
    ],
    female: [
        {cm:21, eu:"35"}, {cm:21.5, eu:"35 1/2"}, {cm:22, eu:"36"},
        {cm:22.5, eu:"36 2/3"}, {cm:23, eu:"37 1/3"}, {cm:23.5, eu:"38"},
        {cm:24, eu:"38 2/3"}, {cm:24.5, eu:"39 1/3"}, {cm:25, eu:"40"},
        {cm:25.5, eu:"40 2/3"}, {cm:26, eu:"41 1/3"}, {cm:26.5, eu:"42"},
        {cm:27, eu:"42 2/3"}, {cm:27.5, eu:"43 1/3"}, {cm:28, eu:"44"},
        {cm:29, eu:"45"}
    ]
};

function injectStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const s=document.createElement("style");
    s.id=STYLE_ID;
    s.textContent=`
.tsh-chat-toggle{
    position:fixed;right:24px;bottom:24px;width:64px;height:64px;border-radius:50%;border:none;
    background:#092f2f;color:#fff;z-index:99990;cursor:grab;box-shadow:0 10px 28px rgba(0,0,0,.22);
    display:flex;align-items:center;justify-content:center;transition:box-shadow .25s ease;
    user-select:none;touch-action:none;
}
.tsh-chat-toggle:active{cursor:grabbing}
.tsh-chat-logo{
    width:46px;height:46px;border-radius:50%;background:#050505;color:#fff;border:1px solid rgba(255,255,255,.25);
    display:flex;align-items:center;justify-content:center;font-weight:800;letter-spacing:1.5px;position:relative;overflow:hidden;
}
.tsh-chat-logo:before{content:"";position:absolute;width:28px;height:34px;border:2px solid rgba(255,255,255,.75);border-radius:12px 12px 16px 16px;opacity:.45}
.tsh-chat-logo span{position:relative;z-index:1;font-size:12px}
.tsh-chat-box{
    position:fixed;right:24px;bottom:100px;width:390px;height:610px;max-width:calc(100vw - 32px);max-height:calc(100vh - 120px);
    background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 18px 52px rgba(0,0,0,.24);z-index:99991;display:none;
    flex-direction:column;font-family:Roboto,Arial,sans-serif;
}
.tsh-chat-box.open{display:flex}
.tsh-chat-header{height:72px;background:#0b3030;color:#fff;display:flex;align-items:center;gap:12px;padding:0 18px}
.tsh-chat-header-title{flex:1;font-size:16px;font-weight:700}
.tsh-chat-close{border:none;background:transparent;color:#fff;font-size:26px;cursor:pointer;transform:rotate(90deg)}
.tsh-chat-body{flex:1;overflow-y:auto;padding:18px 16px 12px;background:#fff;scroll-behavior:smooth}
.tsh-chat-meta{color:#8a8f95;font-size:12px;margin:10px 0 5px}
.tsh-msg{max-width:86%;padding:12px 15px;border-radius:16px;font-size:14px;line-height:1.45;margin-bottom:10px;word-break:break-word}
.tsh-msg.bot{background:#f3f3f3;color:#151515;border-top-left-radius:6px}
.tsh-msg.user{background:#050505;color:#fff;margin-left:auto;border-top-right-radius:6px}
.tsh-typing{width:68px;padding:13px 16px;border-radius:18px;background:#f3f3f3;display:flex;gap:5px;margin:5px 0 12px}
.tsh-typing span{width:7px;height:7px;background:#aaa;border-radius:50%;animation:tshBlink 1s infinite ease-in-out}
.tsh-typing span:nth-child(2){animation-delay:.15s}.tsh-typing span:nth-child(3){animation-delay:.3s}
@keyframes tshBlink{0%,80%,100%{opacity:.3}40%{opacity:1}}
.tsh-product-list{display:flex;flex-direction:column;gap:10px;margin:8px 0}
.tsh-product-card{display:grid;grid-template-columns:78px 1fr 28px;gap:10px;align-items:center;background:#fff;border-radius:14px;padding:8px;box-shadow:0 2px 10px rgba(0,0,0,.06);border:1px solid #eee}
.tsh-product-card img{width:78px;height:78px;object-fit:cover;border-radius:10px;background:#f5f5f5}
.tsh-product-name{display:block;font-size:13px;line-height:1.35;color:#06f;text-decoration:none;margin-bottom:6px;max-height:35px;overflow:hidden}
.tsh-product-price{font-size:14px;font-weight:800;color:#111}.tsh-product-old{font-size:12px;color:#888;text-decoration:line-through;margin-left:6px}
.tsh-product-cart{border:none;background:#000;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px}
.tsh-chat-suggestions{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 12px;background:#fff}
.tsh-chat-suggestions button{border:1px solid #ddd;background:#fff;color:#111;border-radius:18px;padding:7px 10px;font-size:12px;cursor:pointer}
.tsh-chat-suggestions button:hover{background:#111;color:#fff;border-color:#111}
.tsh-chat-inputbar{display:flex;align-items:center;gap:8px;padding:12px 14px 16px;background:#fff;border-top:1px solid #f0f0f0}
.tsh-chat-input{flex:1;height:44px;border:1px solid #ddd;border-radius:22px;padding:0 15px;font-size:14px;outline:none}
.tsh-chat-send{width:44px;height:44px;border-radius:50%;border:none;background:#000;color:#fff;font-size:18px;cursor:pointer}
@media(max-width:520px){
    .tsh-chat-box{right:10px;left:10px;width:auto;bottom:88px;height:560px}
    .tsh-chat-toggle{right:18px;bottom:18px}
}`;
    document.head.appendChild(s);
}

function db(){try{return typeof database==="object"?database:(window.database||{})}catch(e){return {}}}
function esc(x){return String(x||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function norm(x){return String(x||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function time(){return new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}
function loadMessages(){try{return JSON.parse(localStorage.getItem(STORAGE_MESSAGES))||[]}catch(e){return []}}
function saveMessages(arr){localStorage.setItem(STORAGE_MESSAGES,JSON.stringify(arr.slice(-60)))}
function loadContext(){try{return JSON.parse(localStorage.getItem(STORAGE_CONTEXT))||{}}catch(e){return {}}}
function saveContext(ctx){localStorage.setItem(STORAGE_CONTEXT,JSON.stringify(ctx||{}))}
function img(item){return item.mainImg||(Array.isArray(item.images)&&item.images[0])||""}
function old(item){return item.oldPrice||item.originalPrice||item.comparePrice||""}

function inferGender(q){
    const t=norm(q);
    if(t.includes("nu")||t.includes("women")||t.includes("womens")||t.includes("girl")||t.includes("chị")||t.includes("chi")) return "female";
    if(t.includes("nam")||t.includes("men")||t.includes("mens")||t.includes("anh")||t.includes("trai")) return "male";
    return "";
}
function inferCat(q){
    const t=norm(q);
    if(t.includes("nu")||t.includes("women")||t.includes("vay")||t.includes("dam"))return"women";
    if(t.includes("kid")||t.includes("tre")||t.includes("be"))return"kids";
    if(t.includes("sale")||t.includes("giam")||t.includes("re"))return"sale";
    if(t.includes("giay")||t.includes("dep")||t.includes("shoe")||t.includes("sneaker"))return"shoes";
    if(t.includes("nam")||t.includes("men"))return"men";
    return"";
}
function inferIntent(q){
    const t=norm(q);
    if(t.includes("size")||t.includes("cao")||t.includes("nang")||/\d+\s*(kg|m|cm)/.test(t))return"size";
    if(t.includes("jean")||t.includes("denim"))return"jeans";
    if(t.includes("quan")||t.includes("pant")||t.includes("short"))return"pants";
    if(t.includes("hoodie")||t.includes("ao khoac"))return"hoodie";
    if(t.includes("ao")||t.includes("top")||t.includes("tee")||t.includes("shirt"))return"tops";
    if(t.includes("giay")||t.includes("dep")||t.includes("shoe")||t.includes("sneaker"))return"shoes";
    if(t.includes("vay")||t.includes("dam")||t.includes("dress"))return"dress";
    return"general";
}
function parseWeight(q){
    const t=norm(q);
    let m=t.match(/(\d{2,3})\s*(kg|ki|kí)/);
    if(m)return +m[1];
    const nums=t.match(/\b\d{2,3}\b/g);
    if(nums){
        const a=nums.map(Number).filter(n=>n>=32&&n<=120);
        if(a.length)return a[a.length-1];
    }
    return null;
}
function parseHeight(q){
    const t=norm(q);
    let m=t.match(/1m\s*(\d{1,2})/);
    if(m)return 100+Number(m[1]);
    m=t.match(/(\d{3})\s*cm/);
    if(m)return Number(m[1]);
    m=t.match(/(\d)\.(\d{2})\s*m/);
    if(m)return Number(m[1])*100+Number(m[2]);
    return null;
}
function parseFootCM(q){
    const t=norm(q).replace(",",".");
    let m=t.match(/(\d{2}(?:\.\d)?)\s*cm/);
    if(m)return Number(m[1]);
    m=t.match(/chan\s*(\d{2}(?:\.\d)?)/);
    if(m)return Number(m[1]);
    return null;
}
function inferFit(q){
    const t=norm(q);
    if(t.includes("rong")||t.includes("thoai mai")||t.includes("rộng")) return "loose";
    if(t.includes("vua")||t.includes("om")||t.includes("fit")||t.includes("vừa")) return "regular";
    return "";
}
function clothingSize(weight, gender, fit){
    const list=CLOTHING_SIZE[gender]||CLOTHING_SIZE.male;
    let row=list.find(r=>weight>=r.minW&&weight<=r.maxW)||list[list.length-1];
    if(fit==="loose"){
        const idx=list.findIndex(r=>r.size===row.size);
        if(idx>=0 && idx<list.length-1) row=list[idx+1];
    }
    return row;
}
function shoeSize(cm, gender, fit){
    const list=SHOE_SIZE[gender]||SHOE_SIZE.male;
    const target=fit==="loose"?cm+0.5:cm;
    let row=list.find(r=>r.cm>=target)||list[list.length-1];
    return row;
}
function productScore(item,id,cat,intent,q){
    const text=norm(`${id} ${item.key||""} ${item.brand||""} ${item.name||""} ${item.category||""} ${item.type||""}`);
    let s=0;
    if(cat==="men"&&(id.includes("men")||text.includes("men")||text.includes("mens")))s+=4;
    if(cat==="women"&&(id.includes("women")||text.includes("women")||text.includes("womens")))s+=4;
    if(cat==="kids"&&(id.includes("kid")||text.includes("kid")))s+=4;
    if(cat==="sale"&&(id.includes("sale")||text.includes("sale")))s+=5;
    if(cat==="shoes"&&(id.includes("shoe")||text.includes("shoe")||text.includes("sneaker")||text.includes("slipper")||text.includes("boot")))s+=6;
    if(intent==="jeans"&&(text.includes("jean")||text.includes("denim")))s+=8;
    if(intent==="pants"&&(text.includes("pant")||text.includes("sweatpant")||text.includes("short")||text.includes("jean")))s+=6;
    if(intent==="hoodie"&&text.includes("hoodie"))s+=7;
    if(intent==="tops"&&(text.includes("tee")||text.includes("shirt")||text.includes("top")||text.includes("tank")))s+=6;
    if(intent==="shoes"&&(text.includes("shoe")||text.includes("sneaker")||text.includes("slipper")||text.includes("boot")||text.includes("basketball")))s+=6;
    if(intent==="dress"&&(text.includes("dress")||text.includes("skirt")))s+=6;
    norm(q).split(/\s+/).forEach(w=>{if(w.length>2&&text.includes(w))s++});
    return s;
}
function products(q){
    const data=db(), cat=inferCat(q), intent=inferIntent(q);
    const arr=Object.keys(data).map(id=>({id,item:data[id],score:productScore(data[id]||{},id,cat,intent,q)})).filter(x=>x.item&&(x.item.name||x.item.mainImg));
    const ranked=arr.filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
    return ranked.length?ranked:arr.slice(0,3);
}
function productCards(list){
    return `<div class="tsh-product-list">`+list.map(({id,item})=>`
        <div class="tsh-product-card">
            <img src="${img(item)}" alt="${esc(item.name)}">
            <div>
                <a class="tsh-product-name" href="product-detail.html?id=${encodeURIComponent(id)}">${esc(item.name)}</a>
                <span class="tsh-product-price">${esc(item.price)}</span>${old(item)?`<span class="tsh-product-old">${esc(old(item))}</span>`:""}
            </div>
            <button class="tsh-product-cart" data-product-id="${esc(id)}" title="Add to Bag">🛒</button>
        </div>`).join("")+`</div>`;
}
function buildReply(q){
    const ctx=loadContext();
    const t=norm(q);
    const gender=inferGender(q)||ctx.gender||"";
    const intent=inferIntent(q);
    const fit=inferFit(q)||ctx.fit||"";
    const weight=parseWeight(q)||ctx.weight||null;
    const height=parseHeight(q)||ctx.height||null;
    const foot=parseFootCM(q)||ctx.footCM||null;
    const cat=inferCat(q);

    if(inferGender(q)) ctx.gender=inferGender(q);
    if(parseWeight(q)) ctx.weight=parseWeight(q);
    if(parseHeight(q)) ctx.height=parseHeight(q);
    if(parseFootCM(q)) ctx.footCM=parseFootCM(q);
    if(inferFit(q)) ctx.fit=inferFit(q);
    if(intent==="shoes"||cat==="shoes") ctx.lastIntent="shoes";
    if(["tops","pants","hoodie","jeans","dress"].includes(intent)) ctx.lastIntent="clothing";
    saveContext(ctx);

    if(t.includes("hi")||t.includes("hello")||t.includes("chao")){
        return "Chào bạn! Mình là Stylist AI của THE STYLE HUB. Bạn cần tìm áo, quần, giày hay tư vấn size?";
    }

    const lastIntent=ctx.lastIntent||"";

    if((intent==="shoes"||cat==="shoes"||lastIntent==="shoes") && (intent==="size"||foot||t.includes("vua")||t.includes("rong")||t.includes("rộng"))){
        if(!gender) return "Bạn muốn chọn size giày nam hay nữ? Và chiều dài bàn chân của bạn khoảng bao nhiêu cm?";
        if(!foot) return "Bạn cho mình chiều dài bàn chân tính bằng cm nhé. Ví dụ: chân 25.5cm.";
        if(!fit) return "Bạn muốn mang vừa chân hay rộng/thoải mái hơn?";
        const row=shoeSize(foot, gender, fit);
        const genderText=gender==="female"?"nữ":"nam";
        const fitText=fit==="loose"?"mang rộng/thoải mái":"mang vừa";
        saveContext({...ctx,lastIntent:"shoes"});
        return `Theo bảng size giày ${genderText}, bàn chân ${foot}cm và bạn muốn ${fitText}, bạn nên chọn size EU ${row.eu}. Nếu form giày nhỏ hoặc chân bè, nên ưu tiên tăng thêm nửa size.`;
    }

    if(intent==="size" || weight || height || ["tops","pants","hoodie","jeans","dress"].includes(lastIntent)){
        if(!gender) return "Bạn muốn mình tư vấn size nam hay nữ? Bạn có thể nhập ví dụ: nam, cao 1m70 nặng 70kg.";
        if(!weight) return "Bạn cho mình cân nặng hiện tại nhé, ví dụ: 70kg.";
        if(!fit) return "Bạn thích mặc vừa vặn hay rộng rãi/thoải mái hơn?";
        const row=clothingSize(weight, gender, fit);
        const genderText=gender==="female"?"nữ":"nam";
        const fitText=fit==="loose"?"rộng rãi/thoải mái":"vừa vặn";
        return `Theo bảng size ${genderText}, với cân nặng khoảng ${weight}kg${height?` và chiều cao khoảng ${height}cm`:""}, nếu bạn thích mặc ${fitText} thì nên chọn size ${row.size}. Size này phù hợp khoảng chiều cao ${row.height}.`;
    }

    let intro="Mình gợi ý cho bạn 3 sản phẩm phù hợp trong THE STYLE HUB:";
    if(intent==="jeans") intro="Dưới đây là 3 mẫu quần jean / denim phù hợp:";
    if(intent==="pants") intro="Dưới đây là 3 mẫu quần phù hợp với nhu cầu của bạn:";
    if(intent==="tops") intro="Dưới đây là 3 mẫu áo nổi bật trong web:";
    if(intent==="hoodie") intro="Dưới đây là 3 mẫu hoodie / áo khoác phù hợp:";
    if(intent==="shoes") intro="Dưới đây là 3 mẫu giày/dép nổi bật. Bạn có thể gửi thêm giới tính, chiều dài bàn chân và muốn mang vừa hay rộng để mình tư vấn size chính xác:";
    if(intent==="dress") intro="Dưới đây là 3 mẫu váy/đầm phù hợp:";
    if(cat==="sale") intro="Dưới đây là 3 sản phẩm sale nổi bật:";

    return intro + productCards(products(q)) + "<br>Bạn muốn mình lọc theo màu, size, nam/nữ hay phong cách nào nữa không?";
}

function renderHistory(){
    const body=document.getElementById("tshChatBody");
    const messages=loadMessages();
    body.innerHTML="";
    if(messages.length===0){
        appendBot("Xin chào! Mình là Stylist AI của THE STYLE HUB. Bạn cần tìm áo, quần, giày hay tư vấn size?", false);
    }else{
        messages.forEach(m=>{
            const meta=document.createElement("div"); meta.className="tsh-chat-meta"; meta.textContent=m.meta;
            const msg=document.createElement("div"); msg.className=`tsh-msg ${m.who}`; msg.innerHTML=m.html;
            body.appendChild(meta); body.appendChild(msg);
        });
    }
    body.scrollTop=body.scrollHeight;
}
function storeMessage(who, htmlContent, label){
    const arr=loadMessages();
    arr.push({who, html:htmlContent, meta:`${label}  ${time()}`});
    saveMessages(arr);
}
function appendUser(text, save=true){
    const body=document.getElementById("tshChatBody");
    const meta=document.createElement("div"); meta.className="tsh-chat-meta"; meta.textContent=`Me  ${time()}`;
    const msg=document.createElement("div"); msg.className="tsh-msg user"; msg.innerHTML=esc(text);
    body.append(meta,msg); body.scrollTop=body.scrollHeight;
    if(save) storeMessage("user", esc(text), "Me");
}
function appendBot(content, save=true){
    const body=document.getElementById("tshChatBody");
    const meta=document.createElement("div"); meta.className="tsh-chat-meta"; meta.textContent=`Stylist AI Tư Vấn  ${time()}`;
    const msg=document.createElement("div"); msg.className="tsh-msg bot"; msg.innerHTML=content;
    body.append(meta,msg); body.scrollTop=body.scrollHeight;
    if(save) storeMessage("bot", content, "Stylist AI Tư Vấn");
}
function typing(cb){
    const body=document.getElementById("tshChatBody");
    const t=document.createElement("div"); t.className="tsh-typing"; t.innerHTML="<span></span><span></span><span></span>";
    body.appendChild(t); body.scrollTop=body.scrollHeight;
    setTimeout(()=>{t.remove();cb()},650);
}
function handle(text){
    appendUser(text);
    typing(()=>appendBot(buildReply(text)));
}
function addCart(id){
    const item=db()[id]; if(!item)return;
    let cart=[]; try{cart=JSON.parse(localStorage.getItem("cart"))||[]}catch(e){}
    let ex=cart.find(x=>x.id===id||x.key===id);
    if(ex){ex.qty=(+ex.qty||+ex.quantity||1)+1; ex.quantity=ex.qty}
    else cart.push({id,key:id,name:item.name,price:item.price,priceNum:item.priceNum||0,image:img(item),size:"M",qty:1,quantity:1});
    localStorage.setItem("cart",JSON.stringify(cart));
    document.querySelectorAll("#cart-count,#bag-count").forEach(el=>el.textContent=cart.reduce((s,i)=>s+(+i.qty||+i.quantity||1),0));
    appendBot("Mình đã thêm sản phẩm vào BAG cho bạn rồi nhé.");
}
function setPositionFromStorage(){
    const btn=document.getElementById("tshChatToggle");
    const box=document.getElementById("tshChatBox");
    const saved=Number(localStorage.getItem(STORAGE_POS));
    if(!saved)return;
    const bottom=Math.max(16, Math.min(window.innerHeight-90, saved));
    btn.style.bottom=bottom+"px";
    box.style.bottom=(bottom+76)+"px";
}
function makeDraggable(){
    const btn=document.getElementById("tshChatToggle");
    const box=document.getElementById("tshChatBox");
    let dragging=false, moved=false, startY=0, startBottom=0;
    btn.addEventListener("pointerdown", e=>{
        dragging=true; moved=false; startY=e.clientY; startBottom=parseFloat(getComputedStyle(btn).bottom)||24;
        btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener("pointermove", e=>{
        if(!dragging)return;
        const dy=startY-e.clientY;
        if(Math.abs(dy)>4)moved=true;
        let bottom=startBottom+dy;
        bottom=Math.max(16, Math.min(window.innerHeight-90, bottom));
        btn.style.bottom=bottom+"px";
        box.style.bottom=(bottom+76)+"px";
    });
    btn.addEventListener("pointerup", e=>{
        if(!dragging)return;
        dragging=false;
        const bottom=parseFloat(getComputedStyle(btn).bottom)||24;
        localStorage.setItem(STORAGE_POS, String(bottom));
        if(!moved) openChat();
    });
}
function openChat(){
    const box=document.getElementById("tshChatBox");
    box.classList.add("open");
    renderHistory();
    setTimeout(()=>document.getElementById("tshChatInput").focus(),80);
}
function createWidget(){
    if(document.getElementById(WIDGET_ID))return;
    const wrap=document.createElement("div"); wrap.id=WIDGET_ID;
    wrap.innerHTML=`
<button class="tsh-chat-toggle" id="tshChatToggle" aria-label="Open Stylist AI"><div class="tsh-chat-logo"><span>TSH</span></div></button>
<section class="tsh-chat-box" id="tshChatBox">
    <div class="tsh-chat-header">
        <div class="tsh-chat-logo"><span>TSH</span></div>
        <div class="tsh-chat-header-title">Stylist AI Tư Vấn</div>
        <button class="tsh-chat-close" id="tshChatClose">⌃</button>
    </div>
    <div class="tsh-chat-body" id="tshChatBody"></div>
    <div class="tsh-chat-suggestions">
        <button data-suggest="Tư vấn size áo nam">Size áo nam</button>
        <button data-suggest="Tư vấn size nữ">Size nữ</button>
        <button data-suggest="Tư vấn size giày nam">Size giày nam</button>
        <button data-suggest="Tôi muốn tìm quần jean">Quần jean</button>
        <button data-suggest="Có sản phẩm sale không">Sale</button>
    </div>
    <form class="tsh-chat-inputbar" id="tshChatForm">
        <input class="tsh-chat-input" id="tshChatInput" placeholder="Send a message" autocomplete="off">
        <button class="tsh-chat-send" type="submit">➤</button>
    </form>
</section>`;
    document.body.appendChild(wrap);
    setPositionFromStorage();
    makeDraggable();
    document.getElementById("tshChatClose").onclick=()=>document.getElementById("tshChatBox").classList.remove("open");
    document.getElementById("tshChatForm").onsubmit=e=>{
        e.preventDefault();
        const input=document.getElementById("tshChatInput");
        const text=input.value.trim();
        if(!text)return;
        input.value="";
        handle(text);
    };
    document.querySelectorAll(".tsh-chat-suggestions button").forEach(b=>b.onclick=()=>handle(b.dataset.suggest));
    document.getElementById("tshChatBody").onclick=e=>{
        const b=e.target.closest(".tsh-product-cart");
        if(b)addCart(b.dataset.productId);
    };
    renderHistory();
}
document.addEventListener("DOMContentLoaded",()=>{injectStyle();createWidget()});
})();
