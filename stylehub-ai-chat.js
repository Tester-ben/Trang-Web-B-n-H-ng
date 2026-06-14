/* THE STYLE HUB - STYLIST AI CHATBOT */
(function () {
"use strict";
const STYLE_ID="stylehub-ai-chat-style", WIDGET_ID="stylehub-ai-chat-widget";

function injectStyle(){
 if(document.getElementById(STYLE_ID))return;
 const s=document.createElement("style"); s.id=STYLE_ID;
 s.textContent=`
.tsh-chat-toggle{position:fixed;right:24px;bottom:24px;width:64px;height:64px;border-radius:50%;border:none;background:#092f2f;color:#fff;z-index:99990;cursor:pointer;box-shadow:0 10px 28px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;transition:.25s}
.tsh-chat-toggle:hover{transform:translateY(-3px)}
.tsh-chat-logo{width:46px;height:46px;border-radius:50%;background:#050505;color:#fff;border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-weight:800;letter-spacing:1.5px;position:relative;overflow:hidden}
.tsh-chat-logo:before{content:"";position:absolute;width:28px;height:34px;border:2px solid rgba(255,255,255,.75);border-radius:12px 12px 16px 16px;opacity:.45}
.tsh-chat-logo span{position:relative;z-index:1;font-size:12px}
.tsh-chat-box{position:fixed;right:24px;bottom:100px;width:390px;height:610px;max-width:calc(100vw - 32px);max-height:calc(100vh - 120px);background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 18px 52px rgba(0,0,0,.24);z-index:99991;display:none;flex-direction:column;font-family:Roboto,Arial,sans-serif}
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
.tsh-typing span{width:7px;height:7px;background:#aaa;border-radius:50%;animation:tshBlink 1s infinite ease-in-out}.tsh-typing span:nth-child(2){animation-delay:.15s}.tsh-typing span:nth-child(3){animation-delay:.3s}
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
@media(max-width:520px){.tsh-chat-box{right:10px;left:10px;width:auto;bottom:88px;height:560px}.tsh-chat-toggle{right:18px;bottom:18px}}
 `;
 document.head.appendChild(s);
}
function db(){try{return (typeof database==="object"?database:(window.database||{}))}catch(e){return {}}}
function esc(x){return String(x||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function norm(x){return String(x||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function time(){return new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}
function img(item){return item.mainImg||(Array.isArray(item.images)&&item.images[0])||""}
function old(item){return item.oldPrice||item.originalPrice||item.comparePrice||""}
function inferCat(q){let t=norm(q); if(t.includes("nu")||t.includes("women")||t.includes("vay")||t.includes("dam"))return"women"; if(t.includes("kid")||t.includes("tre")||t.includes("be"))return"kids"; if(t.includes("sale")||t.includes("giam")||t.includes("re"))return"sale"; if(t.includes("giay")||t.includes("dep")||t.includes("shoe"))return"shoes"; if(t.includes("nam")||t.includes("men"))return"men"; return""}
function inferIntent(q){let t=norm(q); if(t.includes("size")||t.includes("cao")||t.includes("nang")||/\d+\s*(kg|m|cm)/.test(t))return"size"; if(t.includes("jean")||t.includes("denim"))return"jeans"; if(t.includes("quan")||t.includes("pant")||t.includes("short"))return"pants"; if(t.includes("hoodie")||t.includes("ao khoac"))return"hoodie"; if(t.includes("ao")||t.includes("top")||t.includes("tee")||t.includes("shirt"))return"tops"; if(t.includes("giay")||t.includes("shoe")||t.includes("sneaker"))return"shoes"; if(t.includes("vay")||t.includes("dam")||t.includes("dress"))return"dress"; return"general"}
function sizeAdvice(q){let t=norm(q), w=null, m=t.match(/(\d{2,3})\s*(kg|ki|kí)/); if(m)w=+m[1]; if(!w){let ns=t.match(/\b\d{2,3}\b/g); if(ns){let a=ns.map(Number).filter(n=>n>=35&&n<=120); if(a.length)w=a[a.length-1]}} if(!w)return""; let size=w<=50?"S":w<=62?"M":w<=75?"L":w<=90?"XL":"XXL"; let loose=size==="S"?"M":size==="M"?"L":size==="L"?"XL":"XXL"; return `Với cân nặng khoảng ${w}kg, bạn nên chọn size ${size} nếu thích mặc vừa vặn, hoặc ${loose} nếu thích rộng rãi hơn.`}
function score(item,id,cat,intent,q){
 let text=norm(`${id} ${item.key||""} ${item.brand||""} ${item.name||""} ${item.category||""} ${item.type||""}`), s=0;
 if(cat==="men"&&(id.includes("men")||text.includes("men")||text.includes("mens")))s+=4;
 if(cat==="women"&&(id.includes("women")||text.includes("women")||text.includes("womens")))s+=4;
 if(cat==="kids"&&(id.includes("kid")||text.includes("kid")))s+=4;
 if(cat==="sale"&&(id.includes("sale")||text.includes("sale")))s+=5;
 if(cat==="shoes"&&(id.includes("shoe")||text.includes("shoe")||text.includes("sneaker")||text.includes("slipper")||text.includes("boot")))s+=5;
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
 let data=db(), cat=inferCat(q), intent=inferIntent(q);
 let arr=Object.keys(data).map(id=>({id,item:data[id],score:score(data[id]||{},id,cat,intent,q)})).filter(x=>x.item&&(x.item.name||x.item.mainImg));
 let ranked=arr.filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
 return ranked.length?ranked:arr.slice(0,3);
}
function cards(list){return `<div class="tsh-product-list">`+list.map(({id,item})=>`<div class="tsh-product-card"><img src="${img(item)}" alt="${esc(item.name)}"><div><a class="tsh-product-name" href="product-detail.html?id=${encodeURIComponent(id)}">${esc(item.name)}</a><span class="tsh-product-price">${esc(item.price)}</span>${old(item)?`<span class="tsh-product-old">${esc(old(item))}</span>`:""}</div><button class="tsh-product-cart" data-product-id="${esc(id)}" title="Add to Bag">🛒</button></div>`).join("")+`</div>`}
function reply(q){
 let t=norm(q), intent=inferIntent(q), cat=inferCat(q), adv=sizeAdvice(q);
 if(t.includes("hi")||t.includes("hello")||t.includes("chao"))return "Chào bạn! Mình là Stylist AI của THE STYLE HUB. Bạn muốn tìm áo, quần, giày, đồ nữ, đồ nam hay đồ sale?";
 if(intent==="size")return (adv||"Bạn cho mình biết chiều cao và cân nặng nhé, mình sẽ gợi ý size phù hợp.")+" Nếu muốn, mình có thể gợi ý thêm sản phẩm hợp dáng.";
 let intro="Mình gợi ý cho bạn 3 sản phẩm phù hợp trong THE STYLE HUB:";
 if(intent==="jeans")intro="Dưới đây là 3 mẫu quần jean / denim phù hợp:";
 if(intent==="pants")intro="Dưới đây là 3 mẫu quần phù hợp với nhu cầu của bạn:";
 if(intent==="tops")intro="Dưới đây là 3 mẫu áo nổi bật trong web:";
 if(intent==="hoodie")intro="Dưới đây là 3 mẫu hoodie / áo khoác phù hợp:";
 if(intent==="shoes")intro="Dưới đây là 3 mẫu giày/dép nổi bật:";
 if(intent==="dress")intro="Dưới đây là 3 mẫu váy/đầm phù hợp:";
 if(cat==="sale")intro="Dưới đây là 3 sản phẩm sale nổi bật:";
 return intro+cards(products(q))+(adv?`<br>${adv}`:"")+"<br>Bạn thích màu nào hoặc muốn mặc rộng/vừa vặn? Mình sẽ lọc tiếp cho bạn.";
}
function create(){
 if(document.getElementById(WIDGET_ID))return;
 let w=document.createElement("div"); w.id=WIDGET_ID;
 w.innerHTML=`<button class="tsh-chat-toggle" id="tshChatToggle"><div class="tsh-chat-logo"><span>TSH</span></div></button><section class="tsh-chat-box" id="tshChatBox"><div class="tsh-chat-header"><div class="tsh-chat-logo"><span>TSH</span></div><div class="tsh-chat-header-title">Stylist AI Tư Vấn</div><button class="tsh-chat-close" id="tshChatClose">⌃</button></div><div class="tsh-chat-body" id="tshChatBody"></div><div class="tsh-chat-suggestions"><button data-suggest="Tôi cao 1m70 nặng 70kg">Tư vấn size</button><button data-suggest="Tôi muốn tìm áo nam">Áo nam</button><button data-suggest="Tôi muốn tìm quần jean">Quần jean</button><button data-suggest="Tôi muốn tìm giày">Giày</button><button data-suggest="Có sản phẩm sale không">Sale</button></div><form class="tsh-chat-inputbar" id="tshChatForm"><input class="tsh-chat-input" id="tshChatInput" placeholder="Send a message" autocomplete="off"><button class="tsh-chat-send" type="submit">➤</button></form></section>`;
 document.body.appendChild(w);
 const box=document.getElementById("tshChatBox"), body=document.getElementById("tshChatBody"), input=document.getElementById("tshChatInput");
 document.getElementById("tshChatToggle").onclick=()=>{box.classList.add("open"); if(!body.dataset.started){bot("Xin chào! Mình là Stylist AI của THE STYLE HUB. Bạn cần tìm áo, quần, giày hay tư vấn size?"); body.dataset.started="1"} setTimeout(()=>input.focus(),80)};
 document.getElementById("tshChatClose").onclick=()=>box.classList.remove("open");
 document.getElementById("tshChatForm").onsubmit=e=>{e.preventDefault(); let text=input.value.trim(); if(!text)return; input.value=""; handle(text)};
 document.querySelectorAll(".tsh-chat-suggestions button").forEach(b=>b.onclick=()=>handle(b.dataset.suggest));
 body.onclick=e=>{let b=e.target.closest(".tsh-product-cart"); if(b)addCart(b.dataset.productId)};
}
function meta(label){let b=document.getElementById("tshChatBody"), m=document.createElement("div"); m.className="tsh-chat-meta"; m.textContent=`${label}  ${time()}`; b.appendChild(m)}
function msg(c,who){let b=document.getElementById("tshChatBody"), m=document.createElement("div"); m.className=`tsh-msg ${who}`; m.innerHTML=c; b.appendChild(m); b.scrollTop=b.scrollHeight}
function bot(c){meta("Stylist AI Tư Vấn"); msg(c,"bot")}
function user(c){meta("Me"); msg(esc(c),"user")}
function typing(cb){let b=document.getElementById("tshChatBody"), t=document.createElement("div"); t.className="tsh-typing"; t.innerHTML="<span></span><span></span><span></span>"; b.appendChild(t); b.scrollTop=b.scrollHeight; setTimeout(()=>{t.remove(); cb()},650)}
function handle(text){user(text); typing(()=>bot(reply(text)))}
function addCart(id){
 let item=db()[id]; if(!item)return; let cart=[]; try{cart=JSON.parse(localStorage.getItem("cart"))||[]}catch(e){}
 let ex=cart.find(x=>x.id===id||x.key===id); if(ex){ex.qty=(+ex.qty||+ex.quantity||1)+1; ex.quantity=ex.qty}else cart.push({id,key:id,name:item.name,price:item.price,priceNum:item.priceNum||0,image:img(item),size:"M",qty:1,quantity:1});
 localStorage.setItem("cart",JSON.stringify(cart));
 document.querySelectorAll("#cart-count,#bag-count").forEach(el=>el.textContent=cart.reduce((s,i)=>s+(+i.qty||+i.quantity||1),0));
 bot("Mình đã thêm sản phẩm vào BAG cho bạn rồi nhé.");
}
document.addEventListener("DOMContentLoaded",()=>{injectStyle(); create()});
})();